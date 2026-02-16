import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Eye,
  Edit2,
  Trash2,
  Send,
  CheckCircle,
  Clock,
  XCircle,
  Download,
  ArrowLeft,
  User,
  Mail,
  Phone,
  DollarSign
} from 'lucide-react';

type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

type Invoice = {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  customer_address?: string;
  issue_date: string;
  due_date: string;
  status: InvoiceStatus;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  notes?: string;
  created_at: string;
};

type InvoiceItem = {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
};

const statusConfig: Record<InvoiceStatus, { label: string; color: string; icon: any }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: FileText },
  sent: { label: 'Sent', color: 'bg-blue-100 text-blue-700', icon: Send },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-700', icon: Clock },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500', icon: XCircle }
};

export function InvoicesPage() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendingInvoice, setSendingInvoice] = useState(false);

  useEffect(() => {
    loadInvoices();
  }, [user]);

  const loadInvoices = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('provider_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteInvoice = async (invoiceId: string) => {
    if (!confirm('Are you sure you want to delete this invoice?')) return;

    try {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceId);

      if (error) throw error;
      loadInvoices();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      alert('Failed to delete invoice');
    }
  };

  const updateInvoiceStatus = async (invoiceId: string, newStatus: InvoiceStatus) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ status: newStatus })
        .eq('id', invoiceId);

      if (error) throw error;
      loadInvoices();
    } catch (error) {
      console.error('Error updating invoice status:', error);
      alert('Failed to update invoice status');
    }
  };

  const sendInvoice = async () => {
    if (!selectedInvoice) return;

    setSendingInvoice(true);
    try {
      const { data: items, error: itemsError } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', selectedInvoice.id);

      if (itemsError) throw itemsError;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invoice`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            invoice: selectedInvoice,
            items: items || []
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to send invoice');
      }

      await updateInvoiceStatus(selectedInvoice.id, 'sent');
      setShowSendModal(false);
      setSelectedInvoice(null);
      alert('Invoice sent successfully!');
    } catch (error) {
      console.error('Error sending invoice:', error);
      alert('Failed to send invoice. Please try again.');
    } finally {
      setSendingInvoice(false);
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = invoice.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const stats = {
    total: invoices.length,
    draft: invoices.filter(i => i.status === 'draft').length,
    sent: invoices.filter(i => i.status === 'sent').length,
    paid: invoices.filter(i => i.status === 'paid').length,
    overdue: invoices.filter(i => {
      if (i.status === 'paid' || i.status === 'cancelled' || i.status === 'draft') return false;
      const dueDate = new Date(i.due_date);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate < today;
    }).length,
    totalRevenue: invoices.filter(i => i.status === 'paid').reduce((sum, inv) => sum + inv.total, 0),
    outstanding: invoices.filter(i => {
      if (i.status === 'paid' || i.status === 'cancelled' || i.status === 'draft') return false;
      return true;
    }).reduce((sum, inv) => sum + inv.total, 0)
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading invoices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => window.history.back()}
            className="text-gray-600 hover:text-blue-600 transition"
            title="Back"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Invoices</h1>
            <p className="text-gray-600 mt-2">Create and manage your invoices</p>
          </div>
        </div>
        <button
          onClick={() => {
            setSelectedInvoice(null);
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
        >
          <Plus size={20} />
          Create Invoice
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-2">Total Invoices</p>
          <p className="text-3xl font-bold text-gray-800">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-2">Paid Revenue</p>
          <p className="text-3xl font-bold text-green-600">${stats.totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-2">Outstanding</p>
          <p className="text-3xl font-bold text-orange-600">${stats.outstanding.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-2">Overdue</p>
          <p className="text-3xl font-bold text-red-600">{stats.overdue}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search by customer name or invoice number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter size={20} className="text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | 'all')}
                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Issue Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <FileText size={48} className="mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium">No invoices found</p>
                    <p className="text-sm mt-1">Create your first invoice to get started</p>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => {
                  const StatusIcon = statusConfig[invoice.status].icon;
                  return (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">{invoice.invoice_number}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{invoice.customer_name}</p>
                          <p className="text-xs text-gray-500">{invoice.customer_email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(invoice.issue_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(invoice.due_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">${invoice.total.toLocaleString()}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig[invoice.status].color}`}>
                          <StatusIcon size={14} />
                          {statusConfig[invoice.status].label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setShowViewModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-900"
                            title="View"
                          >
                            <Eye size={18} />
                          </button>
                          {invoice.status === 'draft' && (
                            <button
                              onClick={() => {
                                setSelectedInvoice(invoice);
                                setShowCreateModal(true);
                              }}
                              className="text-gray-600 hover:text-gray-900"
                              title="Edit"
                            >
                              <Edit2 size={18} />
                            </button>
                          )}
                          {invoice.status === 'draft' && (
                            <button
                              onClick={() => {
                                setSelectedInvoice(invoice);
                                setShowSendModal(true);
                              }}
                              className="text-green-600 hover:text-green-900"
                              title="Send Invoice"
                            >
                              <Send size={18} />
                            </button>
                          )}
                          {(invoice.status === 'sent' || invoice.status === 'overdue') && (
                            <button
                              onClick={() => updateInvoiceStatus(invoice.id, 'paid')}
                              className="text-green-600 hover:text-green-900"
                              title="Mark as Paid"
                            >
                              <CheckCircle size={18} />
                            </button>
                          )}
                          {(invoice.status === 'draft' || invoice.status === 'sent') && (
                            <button
                              onClick={() => {
                                if (confirm('Are you sure you want to cancel this invoice?')) {
                                  updateInvoiceStatus(invoice.id, 'cancelled');
                                }
                              }}
                              className="text-orange-600 hover:text-orange-900"
                              title="Cancel Invoice"
                            >
                              <XCircle size={18} />
                            </button>
                          )}
                          <button
                            onClick={() => deleteInvoice(invoice.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && (
        <CreateInvoiceModal
          invoice={selectedInvoice}
          onClose={() => {
            setShowCreateModal(false);
            setSelectedInvoice(null);
          }}
          onSuccess={() => {
            setShowCreateModal(false);
            setSelectedInvoice(null);
            loadInvoices();
          }}
        />
      )}

      {showViewModal && selectedInvoice && (
        <ViewInvoiceModal
          invoice={selectedInvoice}
          onClose={() => {
            setShowViewModal(false);
            setSelectedInvoice(null);
          }}
        />
      )}

      {showSendModal && selectedInvoice && (
        <SendInvoiceModal
          invoice={selectedInvoice}
          onClose={() => {
            setShowSendModal(false);
            setSelectedInvoice(null);
          }}
          onSend={sendInvoice}
          sending={sendingInvoice}
        />
      )}
    </div>
  );
}

type Job = {
  id: string;
  job_number: string;
  title: string;
  property_owner_id: string;
  property_owner?: {
    full_name: string;
    email: string;
    phone_number: string;
  };
};

type AgentCustomer = {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
};

function CreateInvoiceModal({ invoice, onClose, onSuccess }: {
  invoice: Invoice | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [agentCustomers, setAgentCustomers] = useState<AgentCustomer[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [formData, setFormData] = useState({
    customer_name: invoice?.customer_name || '',
    customer_email: invoice?.customer_email || '',
    customer_phone: invoice?.customer_phone || '',
    customer_address: invoice?.customer_address || '',
    issue_date: invoice?.issue_date || new Date().toISOString().split('T')[0],
    due_date: invoice?.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    tax_rate: invoice?.tax_rate || 0,
    notes: invoice?.notes || ''
  });
  const [items, setItems] = useState<InvoiceItem[]>([
    { description: '', quantity: 1, unit_price: 0, amount: 0 }
  ]);

  useEffect(() => {
    loadJobs();
    loadAgentCustomers();
    if (invoice) {
      loadInvoiceItems();
    }
  }, [invoice]);

  const loadJobs = async () => {
    if (!user) return;

    try {
      console.log('Loading jobs for service provider:', user.id);

      const { data: jobsData, error } = await supabase
        .from('service_provider_jobs')
        .select(`
          id,
          job_number,
          title,
          property_owner_id
        `)
        .eq('service_provider_id', user.id)
        .order('created_at', { ascending: false });

      console.log('Jobs query result:', { data: jobsData, error });

      if (error) throw error;

      if (!jobsData || jobsData.length === 0) {
        setJobs([]);
        console.log('No jobs found');
        return;
      }

      // Fetch property owner details for each job
      const jobsWithOwners = await Promise.all(
        jobsData.map(async (job) => {
          const [profileResult, emailResult] = await Promise.all([
            supabase
              .from('profiles')
              .select('full_name, phone_number')
              .eq('id', job.property_owner_id)
              .maybeSingle(),
            supabase.rpc('get_user_email', { user_id: job.property_owner_id })
          ]);

          return {
            ...job,
            property_owner: {
              full_name: profileResult.data?.full_name || 'Unknown',
              email: emailResult.data || '',
              phone_number: profileResult.data?.phone_number || ''
            }
          };
        })
      );

      setJobs(jobsWithOwners);
      console.log('Loaded jobs with owners:', jobsWithOwners.length);
    } catch (error) {
      console.error('Error loading jobs:', error);
    }
  };

  const loadAgentCustomers = async () => {
    if (!user) return;

    try {
      // Get all leads with conversation IDs for this service provider
      const { data: leadsData, error: leadsError } = await supabase
        .from('service_provider_leads')
        .select('conversation_id')
        .eq('service_provider_id', user.id)
        .not('conversation_id', 'is', null);

      if (leadsError) throw leadsError;

      if (!leadsData || leadsData.length === 0) {
        setAgentCustomers([]);
        return;
      }

      const conversationIds = leadsData.map(lead => lead.conversation_id);

      // Get all participants from these conversations
      const { data: participantsData, error: participantsError } = await supabase
        .from('conversation_participants')
        .select('user_id')
        .in('conversation_id', conversationIds)
        .neq('user_id', user.id); // Exclude the service provider themselves

      if (participantsError) throw participantsError;

      if (!participantsData || participantsData.length === 0) {
        setAgentCustomers([]);
        return;
      }

      // Get unique user IDs (potential agents)
      const userIds = [...new Set(participantsData.map(p => p.user_id))];

      // Fetch agent profiles (filter for agents only)
      const agentsWithEmails = await Promise.all(
        userIds.map(async (userId) => {
          const [profileResult, emailResult] = await Promise.all([
            supabase
              .from('profiles')
              .select('id, full_name, phone_number, user_type')
              .eq('id', userId)
              .eq('user_type', 'agent')
              .maybeSingle(),
            supabase.rpc('get_user_email', { user_id: userId })
          ]);

          if (!profileResult.data) return null;

          return {
            id: profileResult.data.id,
            full_name: profileResult.data.full_name,
            email: emailResult.data || '',
            phone_number: profileResult.data.phone_number || ''
          };
        })
      );

      setAgentCustomers(agentsWithEmails.filter((a): a is AgentCustomer => a !== null));
      console.log('Loaded agent customers:', agentsWithEmails.filter((a): a is AgentCustomer => a !== null).length);
    } catch (error) {
      console.error('Error loading agent customers:', error);
    }
  };

  const handleJobSelect = (jobId: string) => {
    setSelectedJobId(jobId);
    setSelectedCustomerId(''); // Clear customer selection when job is selected

    if (jobId) {
      const selectedJob = jobs.find(j => j.id === jobId);
      if (selectedJob && selectedJob.property_owner) {
        setFormData({
          ...formData,
          customer_name: selectedJob.property_owner.full_name,
          customer_email: selectedJob.property_owner.email,
          customer_phone: selectedJob.property_owner.phone_number || '',
        });
      }
    }
  };

  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setSelectedJobId(''); // Clear job selection when customer is selected

    if (customerId) {
      const selectedCustomer = agentCustomers.find(c => c.id === customerId);
      if (selectedCustomer) {
        setFormData({
          ...formData,
          customer_name: selectedCustomer.full_name,
          customer_email: selectedCustomer.email,
          customer_phone: selectedCustomer.phone_number || '',
        });
      }
    }
  };

  const loadInvoiceItems = async () => {
    if (!invoice) return;

    try {
      const { data, error } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoice.id);

      if (error) throw error;
      if (data && data.length > 0) {
        setItems(data);
      }
    } catch (error) {
      console.error('Error loading invoice items:', error);
    }
  };

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, unit_price: 0, amount: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === 'quantity' || field === 'unit_price') {
      newItems[index].amount = newItems[index].quantity * newItems[index].unit_price;
    }

    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      // Calculate totals from items
      const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
      const taxRate = parseFloat(formData.tax_rate.toString());
      const taxAmount = (subtotal * taxRate) / 100;
      const total = subtotal + taxAmount;

      let invoiceId = invoice?.id;

      if (!invoiceId) {
        const { data: invoiceNumberData } = await supabase.rpc('generate_invoice_number');
        const invoiceNumber = invoiceNumberData;

        const { data: newInvoice, error: invoiceError } = await supabase
          .from('invoices')
          .insert({
            ...formData,
            provider_id: user.id,
            customer_id: selectedCustomerId || null,
            invoice_number: invoiceNumber,
            status: 'draft',
            job_id: selectedJobId || null,
            subtotal,
            tax_rate: taxRate,
            tax_amount: taxAmount,
            total
          })
          .select()
          .single();

        if (invoiceError) throw invoiceError;
        invoiceId = newInvoice.id;
      } else {
        const { error: updateError } = await supabase
          .from('invoices')
          .update({
            ...formData,
            tax_rate: taxRate,
            subtotal,
            tax_amount: taxAmount,
            total
          })
          .eq('id', invoiceId);

        if (updateError) throw updateError;

        await supabase
          .from('invoice_items')
          .delete()
          .eq('invoice_id', invoiceId);
      }

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(
          items.map(item => ({
            invoice_id: invoiceId,
            description: item.description,
            quantity: parseFloat(item.quantity.toString()),
            unit_price: parseFloat(item.unit_price.toString()),
            amount: parseFloat(item.amount.toString())
          }))
        );

      if (itemsError) throw itemsError;

      onSuccess();
    } catch (error: any) {
      console.error('Error saving invoice:', error);
      alert(`Failed to save invoice: ${error.message || JSON.stringify(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-2xl font-bold text-gray-800">
            {invoice ? 'Edit Invoice' : 'Create New Invoice'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XCircle size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Link Invoice To:</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Agent Customer (Direct Billing)
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => handleCustomerSelect(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Select an agent...</option>
                  {agentCustomers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.full_name} - {customer.email}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Invoice an agent who has contacted you for services
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Job (Property Owner Workflow)
                </label>
                <select
                  value={selectedJobId}
                  onChange={(e) => handleJobSelect(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Select a job...</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.job_number} - {job.title} {job.property_owner && `(${job.property_owner.full_name})`}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Link to an existing job for a property owner
                </p>
              </div>
            </div>

            {!selectedCustomerId && !selectedJobId && (
              <p className="text-xs text-gray-600 mt-3 text-center">
                Or leave both blank to enter customer information manually
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Customer Name *
              </label>
              <input
                type="text"
                required
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Customer Email *
              </label>
              <input
                type="email"
                required
                value={formData.customer_email}
                onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Customer Phone
              </label>
              <input
                type="tel"
                value={formData.customer_phone}
                onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Customer Address
              </label>
              <input
                type="text"
                value={formData.customer_address}
                onChange={(e) => setFormData({ ...formData, customer_address: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Issue Date *
              </label>
              <input
                type="date"
                required
                value={formData.issue_date}
                onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Due Date *
              </label>
              <input
                type="date"
                required
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Items</h3>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <Plus size={16} />
                Add Item
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex gap-2 items-end">
                <div className="flex-1 px-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                </div>
                <div className="w-24 px-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1 text-center">Quantity</label>
                </div>
                <div className="w-32 px-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1 text-center">Unit Price</label>
                </div>
                <div className="w-32 px-3 flex items-center justify-center">
                  <label className="text-xs font-medium text-gray-600 mb-1">Total</label>
                </div>
                <div className="w-10"></div>
              </div>

              {items.map((item, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Description"
                    required
                    value={item.description}
                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    placeholder="Qty"
                    required
                    min="0"
                    step="0.01"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                    className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                  />
                  <input
                    type="number"
                    placeholder="Price"
                    required
                    min="0"
                    step="0.01"
                    value={item.unit_price}
                    onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                    className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                  />
                  <input
                    type="number"
                    placeholder="Amount"
                    value={item.amount.toFixed(2)}
                    readOnly
                    className="w-32 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-center"
                  />
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="p-2 text-red-600 hover:text-red-900"
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tax Rate (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={formData.tax_rate}
              onChange={(e) => setFormData({ ...formData, tax_rate: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Additional notes or payment terms..."
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? 'Saving...' : invoice ? 'Update Invoice' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ViewInvoiceModal({ invoice, onClose }: {
  invoice: Invoice;
  onClose: () => void;
}) {
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadItems();
  }, [invoice]);

  const loadItems = async () => {
    try {
      const { data, error } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoice.id);

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error loading items:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = () => {
    const printContent = document.createElement('div');
    printContent.className = 'print-only';
    printContent.style.cssText = 'display: none;';

    printContent.innerHTML = `
      <style>
        @media screen {
          .print-only {
            display: none !important;
          }
        }
        @media print {
          .print-only {
            display: block !important;
            position: static !important;
          }
          @page {
            size: letter;
            margin: 0.5in;
          }
          body {
            margin: 0;
            padding: 0;
          }
        }
      </style>
      <div style="font-family: Arial, sans-serif; max-width: 750px; margin: 0 auto; font-size: 12px;">
        <div style="text-align: center; margin-bottom: 25px;">
          <div style="font-size: 28px; font-weight: bold; color: #1f2937;">INVOICE</div>
          <div style="font-size: 16px; color: #6b7280; margin-top: 4px;">${invoice.invoice_number}</div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
          <div style="padding: 15px; background: #f9fafb; border-radius: 6px;">
            <div style="font-weight: 600; color: #374151; margin-bottom: 6px; font-size: 13px;">Bill To:</div>
            <div style="color: #6b7280; font-size: 12px;">
              <div style="font-weight: 600; color: #1f2937; margin-bottom: 3px;">${invoice.customer_name}</div>
              <div>${invoice.customer_email}</div>
              ${invoice.customer_phone ? `<div>${invoice.customer_phone}</div>` : ''}
              ${invoice.customer_address ? `<div>${invoice.customer_address}</div>` : ''}
            </div>
          </div>
          <div style="padding: 15px; background: #f9fafb; border-radius: 6px;">
            <div style="margin-bottom: 8px;">
              <div style="font-weight: 600; color: #374151; margin-bottom: 4px; font-size: 13px;">Issue Date:</div>
              <div style="color: #6b7280; font-size: 12px;">${new Date(invoice.issue_date).toLocaleDateString()}</div>
            </div>
            <div style="margin-bottom: 8px;">
              <div style="font-weight: 600; color: #374151; margin-bottom: 4px; font-size: 13px;">Due Date:</div>
              <div style="color: #6b7280; font-size: 12px;">${new Date(invoice.due_date).toLocaleDateString()}</div>
            </div>
            <div>
              <div style="font-weight: 600; color: #374151; margin-bottom: 4px; font-size: 13px;">Status:</div>
              <span style="display: inline-block; padding: 3px 10px; border-radius: 10px; font-size: 11px; font-weight: 500; background-color: ${statusConfig[invoice.status].color}20; color: ${statusConfig[invoice.status].color};">
                ${statusConfig[invoice.status].label}
              </span>
            </div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background-color: #f9fafb;">
              <th style="padding: 10px; text-align: left; border-bottom: 1px solid #e5e7eb; font-weight: 600; font-size: 12px;">Description</th>
              <th style="padding: 10px; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: 600; font-size: 12px;">Qty</th>
              <th style="padding: 10px; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: 600; font-size: 12px;">Price</th>
              <th style="padding: 10px; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: 600; font-size: 12px;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
              <tr>
                <td style="padding: 10px; text-align: left; border-bottom: 1px solid #e5e7eb; font-size: 12px;">${item.description}</td>
                <td style="padding: 10px; text-align: right; border-bottom: 1px solid #e5e7eb; font-size: 12px;">${item.quantity}</td>
                <td style="padding: 10px; text-align: right; border-bottom: 1px solid #e5e7eb; font-size: 12px;">$${item.unit_price.toFixed(2)}</td>
                <td style="padding: 10px; text-align: right; border-bottom: 1px solid #e5e7eb; font-size: 12px;">$${item.amount.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="margin-top: 15px; text-align: right;">
          <div style="display: flex; justify-content: flex-end; gap: 80px; margin: 6px 0; font-size: 12px;">
            <span style="font-weight: 600;">Subtotal:</span>
            <span>$${invoice.subtotal.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 80px; margin: 6px 0; font-size: 12px;">
            <span style="font-weight: 600;">Tax (${invoice.tax_rate}%):</span>
            <span>$${invoice.tax_amount.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 80px; margin: 6px 0; font-size: 16px; font-weight: bold; color: #1f2937; margin-top: 10px; padding-top: 10px; border-top: 2px solid #e5e7eb;">
            <span style="font-weight: 600;">Total:</span>
            <span>$${invoice.total.toFixed(2)}</span>
          </div>
        </div>

        ${invoice.notes ? `
          <div style="margin-top: 20px; padding: 15px; background: #f9fafb; border-radius: 6px;">
            <div style="font-weight: 600; color: #374151; margin-bottom: 6px; font-size: 13px;">Notes:</div>
            <div style="color: #6b7280; font-size: 12px;">${invoice.notes}</div>
          </div>
        ` : ''}
      </div>
    `;

    document.body.appendChild(printContent);

    const originalTitle = document.title;
    document.title = `Invoice_${invoice.invoice_number}`;

    // Wait for print dialog to complete before cleaning up
    setTimeout(() => {
      window.print();

      // Clean up after a delay to ensure print dialog has processed
      setTimeout(() => {
        document.title = originalTitle;
        if (document.body.contains(printContent)) {
          document.body.removeChild(printContent);
        }
      }, 100);
    }, 100);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 no-print">
      <style>
        {`
          @media print {
            body > *:not(.print-only) {
              display: none !important;
            }
            .no-print {
              display: none !important;
            }
            body {
              margin: 0;
              padding: 0;
            }
          }
        `}
      </style>
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white no-print">
          <h2 className="text-2xl font-bold text-gray-800">Invoice Details</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={downloadPDF}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Download size={18} />
              Download PDF
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <XCircle size={24} />
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">INVOICE</h1>
            <p className="text-xl text-gray-600">{invoice.invoice_number}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="font-semibold text-gray-800 mb-3">Bill To:</h3>
              <p className="font-medium text-gray-900">{invoice.customer_name}</p>
              <p className="text-gray-600">{invoice.customer_email}</p>
              {invoice.customer_phone && <p className="text-gray-600">{invoice.customer_phone}</p>}
              {invoice.customer_address && <p className="text-gray-600">{invoice.customer_address}</p>}
            </div>

            <div className="bg-gray-50 p-6 rounded-lg">
              <div className="mb-3">
                <span className="text-sm text-gray-600">Issue Date:</span>
                <p className="font-medium">{new Date(invoice.issue_date).toLocaleDateString()}</p>
              </div>
              <div className="mb-3">
                <span className="text-sm text-gray-600">Due Date:</span>
                <p className="font-medium">{new Date(invoice.due_date).toLocaleDateString()}</p>
              </div>
              <div>
                <span className="text-sm text-gray-600">Status:</span>
                <div className="mt-1">
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${statusConfig[invoice.status].color}`}>
                    {statusConfig[invoice.status].label}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <p className="text-center text-gray-500">Loading items...</p>
          ) : (
            <>
              <table className="w-full mb-6">
                <thead className="bg-gray-50 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Description</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Quantity</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Unit Price</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((item, index) => (
                    <tr key={index}>
                      <td className="px-4 py-3 text-gray-900">{item.description}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{item.quantity}</td>
                      <td className="px-4 py-3 text-right text-gray-600">${item.unit_price.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">${item.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end mb-8">
                <div className="w-64">
                  <div className="flex justify-between py-2 text-gray-600">
                    <span>Subtotal:</span>
                    <span>${invoice.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-2 text-gray-600">
                    <span>Tax ({invoice.tax_rate}%):</span>
                    <span>${invoice.tax_amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-3 text-xl font-bold text-gray-900 border-t-2 border-gray-300">
                    <span>Total:</span>
                    <span>${invoice.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {invoice.notes && (
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="font-semibold text-gray-800 mb-2">Notes:</h3>
                  <p className="text-gray-600 whitespace-pre-wrap">{invoice.notes}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SendInvoiceModal({ invoice, onClose, onSend, sending }: {
  invoice: Invoice;
  onClose: () => void;
  onSend: () => void;
  sending: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800">Send Invoice</h2>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <p className="text-gray-700 mb-4">
              You are about to send invoice <span className="font-semibold">{invoice.invoice_number}</span> to:
            </p>

            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex items-start gap-2">
                <User size={18} className="text-gray-500 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-600">Customer Name</p>
                  <p className="font-medium text-gray-900">{invoice.customer_name}</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Mail size={18} className="text-gray-500 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-600">Email Address</p>
                  <p className="font-medium text-gray-900">{invoice.customer_email}</p>
                </div>
              </div>

              {invoice.customer_phone && (
                <div className="flex items-start gap-2">
                  <Phone size={18} className="text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-600">Phone Number</p>
                    <p className="font-medium text-gray-900">{invoice.customer_phone}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2 pt-2 border-t border-gray-200">
                <DollarSign size={18} className="text-gray-500 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-600">Invoice Total</p>
                  <p className="font-medium text-gray-900 text-lg">${invoice.total.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                The customer will receive an email with the invoice details and a PDF attachment.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={sending}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onSend}
              disabled={sending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              {sending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Sending...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Send Invoice
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
