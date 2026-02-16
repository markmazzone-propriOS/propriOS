import { useState, useEffect } from 'react';
import { Wrench, Clock, CheckCircle, XCircle, AlertCircle, DollarSign, Calendar, User, MessageSquare, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from '../Navigation/Router';

interface ServiceRequest {
  id: string;
  service_provider_id: string;
  service_category: string;
  description: string;
  status: 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  scheduled_date?: string;
  completion_date?: string;
  estimated_cost?: number;
  actual_cost?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  service_provider: {
    id: string;
    business_name: string;
    business_email?: string;
    business_phone?: string;
    logo_url?: string;
  };
  property?: {
    id: string;
    address_line1: string;
    city: string;
    state: string;
  };
  appointment?: {
    id: string;
    scheduled_date: string;
    scheduled_time: string;
    status: string;
  };
  job?: {
    id: string;
    status: string;
    completion_notes?: string;
  };
  invoice?: {
    id: string;
    invoice_number: string;
    total: number;
    status: string;
  };
}

export function ServiceRequestsTracking() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed'>('active');

  useEffect(() => {
    loadServiceRequests();
  }, [user]);

  const loadServiceRequests = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // First get conversations where the agent is a participant
      const { data: participantData, error: participantError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (participantError) throw participantError;

      const conversationIds = participantData?.map(p => p.conversation_id) || [];

      // Get all direct invoices for this agent
      const { data: directInvoices, error: directInvoicesError } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          total,
          status,
          created_at,
          provider_id,
          customer_name
        `)
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      if (directInvoicesError) throw directInvoicesError;

      // Transform direct invoices into service requests
      const directInvoiceRequests = await Promise.all(
        (directInvoices || []).map(async (invoice) => {
          const { data: providerProfile } = await supabase
            .from('service_provider_profiles')
            .select('id, business_name, business_email, logo_url')
            .eq('id', invoice.provider_id)
            .maybeSingle();

          return {
            id: `invoice-${invoice.id}`,
            service_provider_id: invoice.provider_id,
            service_category: 'Direct Service',
            description: `Invoice ${invoice.invoice_number}`,
            status: invoice.status === 'paid' ? 'completed' as const : 'in_progress' as const,
            scheduled_date: undefined,
            completion_date: invoice.status === 'paid' ? invoice.created_at : undefined,
            estimated_cost: undefined,
            actual_cost: invoice.total,
            notes: undefined,
            created_at: invoice.created_at,
            updated_at: invoice.created_at,
            service_provider: providerProfile ? {
              id: providerProfile.id,
              business_name: providerProfile.business_name,
              business_email: providerProfile.business_email,
              logo_url: providerProfile.logo_url,
            } : null,
            appointment: undefined,
            job: undefined,
            invoice: {
              id: invoice.id,
              invoice_number: invoice.invoice_number,
              total: invoice.total,
              status: invoice.status,
            },
          };
        })
      );

      if (conversationIds.length === 0) {
        setRequests(directInvoiceRequests);
        setLoading(false);
        return;
      }

      // Get leads associated with those conversations
      const { data: leadsData, error: leadsError } = await supabase
        .from('service_provider_leads')
        .select(`
          id,
          service_provider_id,
          contact_type,
          project_description,
          status,
          created_at,
          conversation_id,
          service_provider:service_provider_profiles!service_provider_leads_service_provider_id_fkey(
            id,
            business_name,
            business_email,
            logo_url
          )
        `)
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: false });

      if (leadsError) throw leadsError;

      const requestsWithDetails = await Promise.all(
        (leadsData || []).map(async (lead) => {
          const { data: appointmentData } = await supabase
            .from('service_provider_appointments')
            .select('id, start_time, end_time, status')
            .eq('lead_id', lead.id)
            .maybeSingle();

          let jobData = null;
          let invoiceData = null;

          if (appointmentData) {
            const { data: job } = await supabase
              .from('service_provider_jobs')
              .select('id, status, completion_notes')
              .eq('appointment_id', appointmentData.id)
              .maybeSingle();

            jobData = job;

            if (job) {
              const { data: invoice } = await supabase
                .from('invoices')
                .select('id, invoice_number, total, status')
                .eq('job_id', job.id)
                .maybeSingle();

              invoiceData = invoice;
            }
          }

          let requestStatus: ServiceRequest['status'] = 'pending';
          if (jobData?.status === 'completed') {
            requestStatus = 'completed';
          } else if (jobData?.status === 'in_progress') {
            requestStatus = 'in_progress';
          } else if (appointmentData?.status === 'confirmed') {
            requestStatus = 'scheduled';
          } else if (appointmentData?.status === 'cancelled' || lead.status === 'lost') {
            requestStatus = 'cancelled';
          }

          return {
            id: lead.id,
            service_provider_id: lead.service_provider_id,
            service_category: (lead as any).contact_type || 'General Service',
            description: (lead as any).project_description || '',
            status: requestStatus,
            scheduled_date: appointmentData?.start_time,
            completion_date: jobData?.status === 'completed' ? appointmentData?.start_time : undefined,
            estimated_cost: undefined,
            actual_cost: invoiceData?.total,
            notes: jobData?.completion_notes,
            created_at: lead.created_at,
            updated_at: lead.created_at,
            service_provider: lead.service_provider,
            appointment: appointmentData ? {
              id: appointmentData.id,
              scheduled_date: appointmentData.start_time,
              scheduled_time: new Date(appointmentData.start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
              status: appointmentData.status,
            } : undefined,
            job: jobData,
            invoice: invoiceData,
          };
        })
      );

      // Combine direct invoices and lead-based requests
      const allRequests = [...directInvoiceRequests, ...requestsWithDetails];
      allRequests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setRequests(allRequests);
    } catch (error) {
      console.error('Error loading service requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: ServiceRequest['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="text-yellow-600" size={20} />;
      case 'scheduled':
        return <Calendar className="text-blue-600" size={20} />;
      case 'in_progress':
        return <AlertCircle className="text-orange-600" size={20} />;
      case 'completed':
        return <CheckCircle className="text-green-600" size={20} />;
      case 'cancelled':
        return <XCircle className="text-red-600" size={20} />;
      default:
        return <Clock className="text-gray-600" size={20} />;
    }
  };

  const getStatusColor = (status: ServiceRequest['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-orange-100 text-orange-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: ServiceRequest['status']) => {
    return status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const filteredRequests = requests.filter((request) => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'active') {
      return ['pending', 'scheduled', 'in_progress'].includes(request.status);
    }
    if (filterStatus === 'completed') {
      return ['completed', 'cancelled'].includes(request.status);
    }
    return true;
  });

  const handleContactProvider = (providerId: string) => {
    navigate(`/provider/${providerId}`, { returnTo: '/dashboard?section=services' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Wrench size={28} className="text-blue-600" />
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Service Requests</h2>
              <p className="text-gray-600 text-sm">Track services requested from providers</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setFilterStatus('active')}
            className={`px-4 py-2 rounded-md font-medium transition ${
              filterStatus === 'active'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Active ({requests.filter(r => ['pending', 'scheduled', 'in_progress'].includes(r.status)).length})
          </button>
          <button
            onClick={() => setFilterStatus('completed')}
            className={`px-4 py-2 rounded-md font-medium transition ${
              filterStatus === 'completed'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Completed ({requests.filter(r => ['completed', 'cancelled'].includes(r.status)).length})
          </button>
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-4 py-2 rounded-md font-medium transition ${
              filterStatus === 'all'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All ({requests.length})
          </button>
        </div>
      </div>

      <div className="p-6">
        {filteredRequests.length === 0 ? (
          <div className="text-center py-12">
            <Wrench size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg mb-2">No service requests</p>
            <p className="text-gray-400 text-sm">
              {filterStatus === 'active'
                ? 'You have no active service requests'
                : filterStatus === 'completed'
                ? 'You have no completed service requests'
                : 'Contact service providers to request services'}
            </p>
            <button
              onClick={() => navigate('/service-providers')}
              className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition"
            >
              Browse Service Providers
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRequests.map((request) => (
              <div
                key={request.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3 flex-1">
                    {request.service_provider.logo_url ? (
                      <img
                        src={request.service_provider.logo_url}
                        alt={request.service_provider.business_name}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                        <Wrench size={24} className="text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-800">
                          {request.service_provider.business_name}
                        </h3>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(request.status)}`}>
                          {getStatusText(request.status)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{request.service_category}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(request.status)}
                  </div>
                </div>

                {request.description && (
                  <p className="text-sm text-gray-700 mb-3 pl-15">{request.description}</p>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 pl-15">
                  {request.scheduled_date && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar size={16} className="text-gray-400" />
                      <span className="text-gray-600">
                        {new Date(request.scheduled_date).toLocaleDateString()}
                        {request.appointment?.scheduled_time && ` at ${request.appointment.scheduled_time}`}
                      </span>
                    </div>
                  )}
                  {request.actual_cost && (
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign size={16} className="text-gray-400" />
                      <span className="text-gray-600">
                        ${request.actual_cost.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {request.invoice && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        request.invoice.status === 'paid'
                          ? 'bg-green-100 text-green-800'
                          : request.invoice.status === 'sent'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        Invoice {request.invoice.status}
                      </span>
                    </div>
                  )}
                  <div className="text-xs text-gray-500">
                    Requested {new Date(request.created_at).toLocaleDateString()}
                  </div>
                </div>

                {request.notes && (
                  <div className="bg-gray-50 rounded p-3 mb-3 pl-15">
                    <p className="text-xs font-semibold text-gray-700 mb-1">Notes:</p>
                    <p className="text-sm text-gray-600">{request.notes}</p>
                  </div>
                )}

                <div className="flex items-center gap-2 justify-end pl-15">
                  <button
                    onClick={() => navigate('/messages')}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition"
                  >
                    <MessageSquare size={16} />
                    Message
                  </button>
                  <button
                    onClick={() => handleContactProvider(request.service_provider_id)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition"
                  >
                    <ExternalLink size={16} />
                    View Provider
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
