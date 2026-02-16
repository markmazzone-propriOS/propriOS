import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  X,
  Plus,
  Mail,
  Phone,
  User,
  DollarSign,
  MessageSquare,
  TrendingUp,
  Search,
  AlertCircle,
  CheckCircle,
  Activity,
  Edit2,
  Trash2,
  Send
} from 'lucide-react';

type Lead = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  source: string;
  status: string;
  priority: string;
  estimated_value?: number;
  project_description?: string;
  notes?: string;
  conversation_id?: string;
  last_contact_date?: string;
  next_follow_up_date?: string;
  created_at: string;
  updated_at: string;
};

type LeadActivity = {
  id: string;
  activity_type: string;
  description: string;
  old_status?: string;
  new_status?: string;
  email_subject?: string;
  email_body?: string;
  email_attachment_url?: string;
  email_attachment_name?: string;
  created_at: string;
};

type EmailReply = {
  id: string;
  from_email: string;
  subject: string;
  body_text: string | null;
  body_html: string | null;
  received_at: string;
};

const LEAD_STATUSES = [
  { value: 'new', label: 'New', color: 'bg-blue-100 text-blue-800' },
  { value: 'contacted', label: 'Contacted', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'qualified', label: 'Qualified', color: 'bg-green-100 text-green-800' },
  { value: 'proposal_sent', label: 'Proposal Sent', color: 'bg-purple-100 text-purple-800' },
  { value: 'negotiation', label: 'Negotiation', color: 'bg-orange-100 text-orange-800' },
  { value: 'won', label: 'Won', color: 'bg-green-600 text-white' },
  { value: 'lost', label: 'Lost', color: 'bg-red-100 text-red-800' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'text-gray-600' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-600' },
  { value: 'high', label: 'High', color: 'text-red-600' },
];

const SOURCES = ['website', 'referral', 'social_media', 'email', 'phone', 'event', 'other'];

export function LeadsManagement() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showRespondModal, setShowRespondModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [emailReplies, setEmailReplies] = useState<EmailReply[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    source: 'website',
    status: 'new',
    priority: 'medium',
    estimated_value: '',
    project_description: '',
    notes: '',
    next_follow_up_date: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      loadLeads();
    }
  }, [user]);

  const loadLeads = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('service_provider_leads')
        .select('*')
        .eq('service_provider_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setLeads(data);
    } catch (error) {
      console.error('Error loading leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadActivities = async (leadId: string) => {
    try {
      const { data, error } = await supabase
        .from('lead_activities')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setActivities(data);
    } catch (error) {
      console.error('Error loading activities:', error);
    }
  };

  const loadEmailReplies = async (leadId: string) => {
    try {
      const { data, error } = await supabase
        .from('lead_email_replies')
        .select('*')
        .eq('lead_id', leadId)
        .order('received_at', { ascending: false });

      if (error) throw error;
      if (data) setEmailReplies(data);
    } catch (error) {
      console.error('Error loading email replies:', error);
    }
  };

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setError('');

    try {
      const { error: insertError } = await supabase
        .from('service_provider_leads')
        .insert({
          service_provider_id: user.id,
          name: formData.name,
          email: formData.email,
          phone: formData.phone || null,
          source: formData.source,
          status: formData.status,
          priority: formData.priority,
          estimated_value: formData.estimated_value ? parseFloat(formData.estimated_value) : null,
          project_description: formData.project_description || null,
          notes: formData.notes || null,
          next_follow_up_date: formData.next_follow_up_date || null,
        });

      if (insertError) throw insertError;

      setFormData({
        name: '',
        email: '',
        phone: '',
        source: 'website',
        status: 'new',
        priority: 'medium',
        estimated_value: '',
        project_description: '',
        notes: '',
        next_follow_up_date: '',
      });
      setShowAddModal(false);
      await loadLeads();
    } catch (err: any) {
      setError(err.message || 'Failed to add lead');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;

    setSaving(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('service_provider_leads')
        .update({
          name: formData.name,
          email: formData.email,
          phone: formData.phone || null,
          source: formData.source,
          status: formData.status,
          priority: formData.priority,
          estimated_value: formData.estimated_value ? parseFloat(formData.estimated_value) : null,
          project_description: formData.project_description || null,
          notes: formData.notes || null,
          next_follow_up_date: formData.next_follow_up_date || null,
        })
        .eq('id', selectedLead.id);

      if (updateError) throw updateError;

      setShowEditModal(false);
      setSelectedLead(null);
      await loadLeads();
    } catch (err: any) {
      setError(err.message || 'Failed to update lead');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    if (!confirm('Are you sure you want to delete this lead?')) return;

    try {
      const { error } = await supabase
        .from('service_provider_leads')
        .delete()
        .eq('id', leadId);

      if (error) throw error;
      await loadLeads();
    } catch (error) {
      console.error('Error deleting lead:', error);
      alert('Failed to delete lead');
    }
  };


  const openDetailsModal = async (lead: Lead) => {
    setSelectedLead(lead);
    setShowDetailsModal(true);
    await loadActivities(lead.id);
    await loadEmailReplies(lead.id);
  };

  const openEditModal = (lead: Lead) => {
    setSelectedLead(lead);
    setFormData({
      name: lead.name,
      email: lead.email,
      phone: lead.phone || '',
      source: lead.source,
      status: lead.status,
      priority: lead.priority,
      estimated_value: lead.estimated_value?.toString() || '',
      project_description: lead.project_description || '',
      notes: lead.notes || '',
      next_follow_up_date: lead.next_follow_up_date || '',
    });
    setShowEditModal(true);
  };

  const openRespondModal = async (lead: Lead) => {
    setSelectedLead(lead);
    setAttachmentFile(null);

    const { data: providerData } = await supabase
      .from('service_provider_profiles')
      .select('business_name, business_email')
      .eq('id', user?.id)
      .maybeSingle();

    const businessName = providerData?.business_name || 'Our Team';

    setEmailSubject(`Re: Your inquiry - ${businessName}`);
    setEmailMessage(`Hi ${lead.name},

Thank you for reaching out to us${lead.project_description ? ' regarding your project' : ''}. We appreciate your interest in our services.

${lead.project_description ? `Regarding your inquiry:\n"${lead.project_description}"\n\n` : ''}We would love to discuss how we can help you. Please let us know a good time to connect, or feel free to reply to this email with any questions.

Best regards,
${businessName}${providerData?.business_email ? `\n${providerData.business_email}` : ''}`);

    setShowRespondModal(true);
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !user) return;

    setSendingEmail(true);
    setError('');

    try {
      const { data: providerData } = await supabase
        .from('service_provider_profiles')
        .select('business_name, business_email')
        .eq('id', user.id)
        .maybeSingle();

      let attachmentUrl = null;
      let attachmentName = null;

      if (attachmentFile) {
        setUploadingAttachment(true);
        const fileExt = attachmentFile.name.split('.').pop();
        const fileName = `${selectedLead.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('lead-response-attachments')
          .upload(fileName, attachmentFile, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('lead-response-attachments')
          .getPublicUrl(fileName);

        attachmentUrl = urlData.publicUrl;
        attachmentName = attachmentFile.name;
        setUploadingAttachment(false);
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-lead-response`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            leadId: selectedLead.id,
            leadEmail: selectedLead.email,
            leadName: selectedLead.name,
            subject: emailSubject,
            message: emailMessage,
            providerName: providerData?.business_name || 'Service Provider',
            providerEmail: providerData?.business_email || user.email,
            attachmentUrl,
            attachmentName,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send email');
      }

      const activityDescription = attachmentName
        ? `Email sent: "${emailSubject}" (with attachment: ${attachmentName})`
        : `Email sent: "${emailSubject}"`;

      const { error: activityError } = await supabase
        .from('lead_activities')
        .insert({
          lead_id: selectedLead.id,
          activity_type: 'email_sent',
          description: activityDescription,
          email_subject: emailSubject,
          email_body: emailMessage,
          email_attachment_url: attachmentUrl,
          email_attachment_name: attachmentName,
          created_by: user.id,
        });

      if (activityError) throw activityError;

      const { error: updateError } = await supabase
        .from('service_provider_leads')
        .update({
          status: selectedLead.status === 'new' ? 'contacted' : selectedLead.status,
          last_contact_date: new Date().toISOString()
        })
        .eq('id', selectedLead.id);

      if (updateError) throw updateError;

      setShowRespondModal(false);
      setEmailSubject('');
      setEmailMessage('');
      setAttachmentFile(null);
      await loadLeads();
      alert('Email sent successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to send email');
      setUploadingAttachment(false);
    } finally {
      setSendingEmail(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = LEAD_STATUSES.find(s => s.value === status);
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusConfig?.color || 'bg-gray-100 text-gray-800'}`}>
        {statusConfig?.label || status}
      </span>
    );
  };

  const getPriorityIcon = (priority: string) => {
    const priorityConfig = PRIORITIES.find(p => p.value === priority);
    return <TrendingUp size={16} className={priorityConfig?.color || 'text-gray-600'} />;
  };

  const filteredLeads = leads.filter(lead => {
    const matchesStatus = filterStatus === 'all' || lead.status === filterStatus;
    const matchesPriority = filterPriority === 'all' || lead.priority === filterPriority;
    const matchesSearch = !searchQuery ||
      lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesStatus && matchesPriority && matchesSearch;
  });

  const getLeadStats = () => {
    return {
      total: leads.length,
      new: leads.filter(l => l.status === 'new').length,
      qualified: leads.filter(l => l.status === 'qualified').length,
      won: leads.filter(l => l.status === 'won').length,
      totalValue: leads
        .filter(l => l.status === 'won')
        .reduce((sum, l) => sum + (l.estimated_value || 0), 0),
    };
  };

  const stats = getLeadStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Leads</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">{stats.total}</p>
            </div>
            <User className="text-blue-600" size={32} />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">New Leads</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">{stats.new}</p>
            </div>
            <Activity className="text-yellow-600" size={32} />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Qualified</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">{stats.qualified}</p>
            </div>
            <CheckCircle className="text-green-600" size={32} />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Won Value</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">${stats.totalValue.toLocaleString()}</p>
            </div>
            <DollarSign className="text-green-600" size={32} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-800">Leads Pipeline</h2>
            <button
              onClick={() => {
                setFormData({
                  name: '',
                  email: '',
                  phone: '',
                  source: 'website',
                  status: 'new',
                  priority: 'medium',
                  estimated_value: '',
                  project_description: '',
                  notes: '',
                  next_follow_up_date: '',
                });
                setShowAddModal(true);
              }}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
            >
              <Plus size={20} className="mr-2" />
              Add Lead
            </button>
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search leads..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              {LEAD_STATUSES.map(status => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Priorities</option>
              {PRIORITIES.map(priority => (
                <option key={priority.value} value={priority.value}>{priority.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lead
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Value
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Source
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-600">
                    No leads found
                  </td>
                </tr>
              ) : (
                filteredLeads.map(lead => (
                  <tr key={lead.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openDetailsModal(lead)}>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-800">{lead.name}</div>
                      <div className="text-sm text-gray-600">
                        Added {new Date(lead.created_at).toLocaleDateString()}
                      </div>
                      {lead.project_description && (
                        <div className="text-xs text-gray-500 mt-1 italic line-clamp-2">
                          "{lead.project_description.substring(0, 100)}{lead.project_description.length > 100 ? '...' : ''}"
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center text-sm text-gray-600 mb-1">
                        <Mail size={14} className="mr-2" />
                        {lead.email}
                      </div>
                      {lead.phone && (
                        <div className="flex items-center text-sm text-gray-600">
                          <Phone size={14} className="mr-2" />
                          {lead.phone}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(lead.status)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        {getPriorityIcon(lead.priority)}
                        <span className="ml-2 text-sm capitalize">{lead.priority}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {lead.estimated_value ? (
                        <span className="font-medium text-gray-800">
                          ${lead.estimated_value.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600 capitalize">
                        {lead.source.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openRespondModal(lead);
                          }}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-md transition"
                          title="Send email response"
                        >
                          <Send size={16} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(lead);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        {lead.conversation_id && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              window.location.href = `/messages/${lead.conversation_id}`;
                            }}
                            className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-md transition"
                            title="View conversation"
                          >
                            <MessageSquare size={16} />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteLead(lead.id);
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-md transition"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-800">
                {showAddModal ? 'Add New Lead' : 'Edit Lead'}
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                  setError('');
                }}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={showAddModal ? handleAddLead : handleUpdateLead} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded flex items-start">
                  <AlertCircle size={20} className="mr-2 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {LEAD_STATUSES.map(status => (
                      <option key={status.value} value={status.value}>{status.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {PRIORITIES.map(priority => (
                      <option key={priority.value} value={priority.value}>{priority.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Source
                  </label>
                  <select
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {SOURCES.map(source => (
                      <option key={source} value={source}>{source.replace('_', ' ').toUpperCase()}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estimated Value
                  </label>
                  <input
                    type="number"
                    value={formData.estimated_value}
                    onChange={(e) => setFormData({ ...formData, estimated_value: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Next Follow-up Date
                  </label>
                  <input
                    type="date"
                    value={formData.next_follow_up_date}
                    onChange={(e) => setFormData({ ...formData, next_follow_up_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Description
                  </label>
                  <textarea
                    value={formData.project_description}
                    onChange={(e) => setFormData({ ...formData, project_description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Internal Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {saving ? 'Saving...' : showAddModal ? 'Add Lead' : 'Update Lead'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                    setError('');
                  }}
                  disabled={saving}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRespondModal && selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-800">Respond to Lead</h2>
              <button
                onClick={() => {
                  setShowRespondModal(false);
                  setEmailSubject('');
                  setEmailMessage('');
                  setError('');
                }}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSendEmail} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded flex items-start">
                  <AlertCircle size={20} className="mr-2 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-900 mb-2">Sending to:</p>
                <p className="text-gray-800">
                  <span className="font-semibold">{selectedLead.name}</span>
                  <br />
                  <span className="text-gray-600">{selectedLead.email}</span>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subject *
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message *
                </label>
                <textarea
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  required
                  rows={12}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  placeholder="Your message here..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Attachment (optional)
                </label>
                <input
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 10 * 1024 * 1024) {
                        alert('File size must be less than 10MB');
                        e.target.value = '';
                        return;
                      }
                      setAttachmentFile(file);
                    }
                  }}
                  disabled={sendingEmail || uploadingAttachment}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {attachmentFile && (
                  <div className="mt-2 flex items-center justify-between bg-gray-50 p-2 rounded">
                    <span className="text-sm text-gray-700">{attachmentFile.name}</span>
                    <button
                      type="button"
                      onClick={() => setAttachmentFile(null)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X size={18} />
                    </button>
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-1">Max file size: 10MB</p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  This email will be sent from your business email address. The lead can reply directly to continue the conversation.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={sendingEmail || uploadingAttachment}
                  className="flex-1 flex items-center justify-center bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  <Send size={18} className="mr-2" />
                  {uploadingAttachment ? 'Uploading...' : sendingEmail ? 'Sending...' : 'Send Email'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRespondModal(false);
                    setEmailSubject('');
                    setEmailMessage('');
                    setError('');
                  }}
                  disabled={sendingEmail}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetailsModal && selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-800">{selectedLead.name}</h2>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedLead(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 mb-2">Status</p>
                  <select
                    value={selectedLead.status}
                    onChange={async (e) => {
                      const newStatus = e.target.value;
                      try {
                        const { error } = await supabase
                          .from('service_provider_leads')
                          .update({ status: newStatus })
                          .eq('id', selectedLead.id);

                        if (error) throw error;

                        setSelectedLead({ ...selectedLead, status: newStatus });
                        await loadLeads();
                        await loadActivities(selectedLead.id);
                      } catch (error) {
                        console.error('Error updating status:', error);
                        alert('Failed to update status');
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {LEAD_STATUSES.map(status => (
                      <option key={status.value} value={status.value}>{status.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-2">Priority</p>
                  <select
                    value={selectedLead.priority}
                    onChange={async (e) => {
                      const newPriority = e.target.value;
                      try {
                        const { error } = await supabase
                          .from('service_provider_leads')
                          .update({ priority: newPriority })
                          .eq('id', selectedLead.id);

                        if (error) throw error;

                        setSelectedLead({ ...selectedLead, priority: newPriority });
                        await loadLeads();
                      } catch (error) {
                        console.error('Error updating priority:', error);
                        alert('Failed to update priority');
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {PRIORITIES.map(priority => (
                      <option key={priority.value} value={priority.value}>{priority.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Email</p>
                  <p className="font-medium">{selectedLead.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Phone</p>
                  <p className="font-medium">{selectedLead.phone || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Source</p>
                  <p className="font-medium capitalize">{selectedLead.source.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Estimated Value</p>
                  <p className="font-medium">
                    {selectedLead.estimated_value ? `$${selectedLead.estimated_value.toLocaleString()}` : '-'}
                  </p>
                </div>
              </div>

              {selectedLead.project_description && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-blue-900 mb-2 flex items-center">
                    <MessageSquare size={16} className="mr-2" />
                    Initial Message / Project Description
                  </p>
                  <p className="text-gray-800 whitespace-pre-wrap">{selectedLead.project_description}</p>
                </div>
              )}

              {selectedLead.notes && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">Internal Notes</p>
                  <p className="text-gray-800">{selectedLead.notes}</p>
                </div>
              )}

              <div>
                <h3 className="font-semibold text-gray-800 mb-3">Activity Timeline</h3>
                {activities.length === 0 && emailReplies.length === 0 ? (
                  <p className="text-gray-600 text-sm">No activities yet</p>
                ) : (
                  <div className="space-y-3">
                    {activities.map(activity => (
                      <div key={`activity-${activity.id}`} className={`border-l-2 pl-4 py-2 ${
                        activity.activity_type === 'email_sent'
                          ? 'border-blue-200 bg-blue-50 rounded-r'
                          : activity.activity_type === 'email_received'
                          ? 'border-green-200 bg-green-50 rounded-r'
                          : 'border-gray-200'
                      }`}>
                        <div className="flex items-start">
                          {activity.activity_type === 'email_sent' ? (
                            <Send size={16} className="text-blue-600 mr-2 mt-0.5" />
                          ) : activity.activity_type === 'email_received' ? (
                            <Mail size={16} className="text-green-600 mr-2 mt-0.5" />
                          ) : (
                            <Activity size={16} className="text-blue-600 mr-2 mt-0.5" />
                          )}
                          <div className="flex-1">
                            <p className="text-sm text-gray-800">{activity.description}</p>
                            {(activity.activity_type === 'email_sent' || activity.activity_type === 'email_received') && activity.email_body && (
                              <div className={`mt-2 p-3 bg-white rounded border ${
                                activity.activity_type === 'email_received' ? 'border-green-200' : 'border-blue-200'
                              }`}>
                                <p className="text-xs font-semibold text-gray-700 mb-1">Message:</p>
                                <p className="text-sm text-gray-800 whitespace-pre-wrap">
                                  {activity.email_body}
                                </p>
                                {activity.email_attachment_name && (
                                  <div className={`mt-2 pt-2 border-t ${
                                    activity.activity_type === 'email_received' ? 'border-green-100' : 'border-blue-100'
                                  }`}>
                                    <p className="text-xs text-gray-600">
                                      📎 Attachment: <a
                                        href={activity.email_attachment_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:underline"
                                      >
                                        {activity.email_attachment_name}
                                      </a>
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(activity.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {emailReplies.map(reply => (
                      <div key={`reply-${reply.id}`} className="border-l-2 border-green-200 pl-4 py-2 bg-green-50 rounded-r">
                        <div className="flex items-start">
                          <Mail size={16} className="text-green-600 mr-2 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-green-900">
                              Email Reply Received: {reply.subject}
                            </p>
                            <p className="text-xs text-gray-600 mt-1">
                              From: {reply.from_email}
                            </p>
                            {reply.body_text && (
                              <div className="mt-2 p-3 bg-white rounded border border-green-200">
                                <p className="text-sm text-gray-800 whitespace-pre-wrap">
                                  {reply.body_text.length > 300
                                    ? `${reply.body_text.substring(0, 300)}...`
                                    : reply.body_text}
                                </p>
                              </div>
                            )}
                            <p className="text-xs text-gray-500 mt-2">
                              {new Date(reply.received_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    openEditModal(selectedLead);
                  }}
                  className="flex-1 flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                >
                  <Edit2 size={18} className="mr-2" />
                  Edit Lead
                </button>
                {selectedLead.conversation_id && (
                  <button
                    onClick={() => {
                      window.location.href = `/messages/${selectedLead.conversation_id}`;
                    }}
                    className="flex-1 flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition"
                  >
                    <MessageSquare size={18} className="mr-2" />
                    View Messages
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
