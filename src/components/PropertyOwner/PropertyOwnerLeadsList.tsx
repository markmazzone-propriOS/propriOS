import { useState, useEffect } from 'react';
import { Mail, Phone, Calendar, MessageSquare, UserPlus, TrendingUp, Trash2, Send, Home } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { SendInvitation } from '../Agents/SendInvitation';
import { ProspectReminders } from '../Agents/ProspectReminders';
import { SendCustomEmail } from '../Agents/SendCustomEmail';

type PropertyOwnerLead = {
  id: string;
  property_owner_id: string;
  property_id: string | null;
  lead_name: string;
  lead_email: string;
  lead_phone: string | null;
  message: string;
  inquiry_type: 'general' | 'viewing_request' | 'application';
  status: 'new' | 'contacted' | 'qualified' | 'viewing_scheduled' | 'application_sent' | 'closed_won' | 'closed_lost';
  source: 'website' | 'referral' | 'direct';
  preferred_move_in_date: string | null;
  preferred_viewing_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  property?: {
    address_line1: string;
    city: string;
    state: string;
  };
};

const STATUS_COLORS = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  qualified: 'bg-green-100 text-green-800',
  viewing_scheduled: 'bg-indigo-100 text-indigo-800',
  application_sent: 'bg-orange-100 text-orange-800',
  closed_won: 'bg-emerald-100 text-emerald-800',
  closed_lost: 'bg-gray-100 text-gray-800',
};

const STATUS_OPTIONS = ['new', 'contacted', 'qualified', 'viewing_scheduled', 'application_sent', 'closed_won', 'closed_lost'];

export function PropertyOwnerLeadsList() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<PropertyOwnerLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [expandedLead, setExpandedLead] = useState<string | null>(null);
  const [showInvitationModal, setShowInvitationModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<PropertyOwnerLead | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showRemindersModal, setShowRemindersModal] = useState(false);

  useEffect(() => {
    if (user) {
      loadLeads();
    }
  }, [user]);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('property_owner_leads')
        .select(`
          *,
          property:properties(address_line1, city, state)
        `)
        .eq('property_owner_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Error loading leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateLeadStatus = async (leadId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('property_owner_leads')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId);

      if (error) throw error;

      setLeads((prev) =>
        prev.map((lead) =>
          lead.id === leadId
            ? { ...lead, status: newStatus as any, updated_at: new Date().toISOString() }
            : lead
        )
      );
    } catch (error) {
      console.error('Error updating lead status:', error);
      alert('Failed to update lead status');
    }
  };

  const filteredLeads =
    selectedStatus === 'all'
      ? leads
      : leads.filter((lead) => lead.status === selectedStatus);

  const statusCounts = {
    all: leads.length,
    new: leads.filter((lead) => lead.status === 'new').length,
    contacted: leads.filter((lead) => lead.status === 'contacted').length,
    qualified: leads.filter((lead) => lead.status === 'qualified').length,
    converted: leads.filter((lead) => lead.status === 'closed_won').length,
    closed: leads.filter((lead) => lead.status === 'closed_lost').length,
  };

  const handleSendInvitation = (lead: PropertyOwnerLead) => {
    setSelectedLead(lead);
    setShowInvitationModal(true);
  };

  const handleInvitationSent = async () => {
    if (selectedLead && selectedLead.status === 'new') {
      await updateLeadStatus(selectedLead.id, 'contacted');
    }
    setShowInvitationModal(false);
    setSelectedLead(null);
  };

  const handleDeleteLead = async (leadId: string) => {
    if (!confirm('Are you sure you want to delete this lead?')) return;

    try {
      const { error } = await supabase
        .from('property_owner_leads')
        .delete()
        .eq('id', leadId);

      if (error) throw error;
      await loadLeads();
    } catch (error) {
      console.error('Error deleting lead:', error);
      alert('Failed to delete lead');
    }
  };

  const handleSendEmail = (lead: PropertyOwnerLead) => {
    setSelectedLead(lead);
    setShowEmailModal(true);
  };

  const handleEmailSent = async () => {
    await loadLeads();
    setShowEmailModal(false);
    setSelectedLead(null);
  };

  const handleShowReminders = (lead: PropertyOwnerLead) => {
    setSelectedLead(lead);
    setShowRemindersModal(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedStatus('all')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            selectedStatus === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
        >
          All ({statusCounts.all})
        </button>
        <button
          onClick={() => setSelectedStatus('new')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            selectedStatus === 'new'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
        >
          New ({statusCounts.new})
        </button>
        <button
          onClick={() => setSelectedStatus('contacted')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            selectedStatus === 'contacted'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
        >
          Contacted ({statusCounts.contacted})
        </button>
        <button
          onClick={() => setSelectedStatus('qualified')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            selectedStatus === 'qualified'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
        >
          Qualified ({statusCounts.qualified})
        </button>
        <button
          onClick={() => setSelectedStatus('closed_won')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            selectedStatus === 'closed_won'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
        >
          Converted ({statusCounts.converted})
        </button>
        <button
          onClick={() => setSelectedStatus('closed_lost')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            selectedStatus === 'closed_lost'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
        >
          Closed ({statusCounts.closed})
        </button>
      </div>

      {filteredLeads.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <MessageSquare className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No leads found</h3>
          <p className="text-gray-600">
            {selectedStatus === 'all'
              ? 'Leads will appear here when people inquire about your properties.'
              : `No leads with status "${selectedStatus}".`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredLeads.map((lead) => (
            <div key={lead.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-gray-900">{lead.lead_name}</h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          STATUS_COLORS[lead.status]
                        }`}
                      >
                        {lead.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Mail size={16} />
                        <a href={`mailto:${lead.lead_email}`} className="text-blue-600 hover:underline">
                          {lead.lead_email}
                        </a>
                      </div>
                      {lead.lead_phone && (
                        <div className="flex items-center gap-2">
                          <Phone size={16} />
                          <a href={`tel:${lead.lead_phone}`} className="text-blue-600 hover:underline">
                            {lead.lead_phone}
                          </a>
                        </div>
                      )}
                      {lead.property && (
                        <div className="flex items-center gap-2">
                          <Home size={16} />
                          <span>{lead.property.address_line1}, {lead.property.city}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setExpandedLead(expandedLead === lead.id ? null : lead.id)}
                    className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                  >
                    {expandedLead === lead.id ? 'Show Less' : 'Show More'}
                  </button>
                </div>

                {expandedLead === lead.id && (
                  <div className="border-t pt-4 mt-4 space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Message</label>
                      <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded">{lead.message}</p>
                    </div>

                    {lead.inquiry_type && (
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Inquiry Type</label>
                        <p className="text-gray-700 capitalize">{lead.inquiry_type.replace('_', ' ')}</p>
                      </div>
                    )}

                    {lead.preferred_move_in_date && (
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Preferred Move-in Date</label>
                        <p className="text-gray-700">{new Date(lead.preferred_move_in_date).toLocaleDateString()}</p>
                      </div>
                    )}

                    {lead.preferred_viewing_date && (
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Preferred Viewing Date</label>
                        <p className="text-gray-700">{new Date(lead.preferred_viewing_date).toLocaleString()}</p>
                      </div>
                    )}

                    {lead.notes && (
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Internal Notes</label>
                        <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded">{lead.notes}</p>
                      </div>
                    )}

                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Update Status</label>
                      <select
                        value={lead.status}
                        onChange={(e) => updateLeadStatus(lead.id, e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status.replace('_', ' ').toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-4 border-t">
                      <button
                        onClick={() => handleSendEmail(lead)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                      >
                        <Send size={16} />
                        Send Email
                      </button>
                      <button
                        onClick={() => handleSendInvitation(lead)}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                      >
                        <UserPlus size={16} />
                        Send Invitation
                      </button>
                      <button
                        onClick={() => handleShowReminders(lead)}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition"
                      >
                        <Calendar size={16} />
                        Set Reminder
                      </button>
                      <button
                        onClick={() => handleDeleteLead(lead.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition ml-auto"
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                    </div>

                    <div className="text-xs text-gray-500 pt-2 border-t">
                      <p>Created: {new Date(lead.created_at).toLocaleString()}</p>
                      <p>Last Updated: {new Date(lead.updated_at).toLocaleString()}</p>
                      <p>Source: {lead.source.toUpperCase()}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showInvitationModal && selectedLead && (
        <SendInvitation
          prefilledEmail={selectedLead.lead_email}
          prefilledName={selectedLead.lead_name}
          prefilledUserType="renter"
          onClose={() => {
            setShowInvitationModal(false);
            setSelectedLead(null);
          }}
          onInvitationSent={handleInvitationSent}
        />
      )}

      {showEmailModal && selectedLead && (
        <SendCustomEmail
          prospectEmail={selectedLead.lead_email}
          prospectName={selectedLead.lead_name}
          prospectId={selectedLead.id}
          onClose={() => {
            setShowEmailModal(false);
            setSelectedLead(null);
          }}
          onSuccess={handleEmailSent}
        />
      )}

      {showRemindersModal && selectedLead && (
        <ProspectReminders
          prospectId={selectedLead.id}
          prospectName={selectedLead.lead_name}
          onClose={() => {
            setShowRemindersModal(false);
            setSelectedLead(null);
          }}
        />
      )}
    </>
  );
}
