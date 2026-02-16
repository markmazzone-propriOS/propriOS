import { useState, useEffect } from 'react';
import { Mail, Phone, Calendar, Tag, MessageSquare, UserPlus, TrendingUp, Trash2, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { SendInvitation } from './SendInvitation';
import { UpdateBuyerProgress } from './UpdateBuyerProgress';
import { ProspectReminders } from './ProspectReminders';
import { SendCustomEmail } from './SendCustomEmail';

type Prospect = {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  message: string;
  status: string;
  source: string;
  created_at: string;
  contacted_at: string | null;
};

const STATUS_COLORS = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  qualified: 'bg-green-100 text-green-800',
  converted: 'bg-purple-100 text-purple-800',
  closed: 'bg-gray-100 text-gray-800',
};

const STATUS_OPTIONS = ['new', 'contacted', 'qualified', 'converted', 'closed'];

export function ProspectsList() {
  const { user } = useAuth();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [expandedProspect, setExpandedProspect] = useState<string | null>(null);
  const [showInvitationModal, setShowInvitationModal] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [selectedBuyer, setSelectedBuyer] = useState<{ id: string; name: string } | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);

  useEffect(() => {
    if (user) {
      loadProspects();
    }
  }, [user]);

  const loadProspects = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('prospects')
        .select('*')
        .eq('agent_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProspects(data || []);
    } catch (error) {
      console.error('Error loading prospects:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateProspectStatus = async (prospectId: string, newStatus: string) => {
    try {
      const updateData: Record<string, string> = { status: newStatus, updated_at: new Date().toISOString() };

      if (newStatus === 'contacted' && !prospects.find((p) => p.id === prospectId)?.contacted_at) {
        updateData.contacted_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('prospects')
        .update(updateData)
        .eq('id', prospectId);

      if (error) throw error;

      setProspects((prev) =>
        prev.map((p) =>
          p.id === prospectId
            ? { ...p, status: newStatus, contacted_at: updateData.contacted_at || p.contacted_at }
            : p
        )
      );
    } catch (error) {
      console.error('Error updating prospect status:', error);
    }
  };

  const filteredProspects =
    selectedStatus === 'all'
      ? prospects
      : prospects.filter((p) => p.status === selectedStatus);

  const statusCounts = {
    all: prospects.length,
    new: prospects.filter((p) => p.status === 'new').length,
    contacted: prospects.filter((p) => p.status === 'contacted').length,
    qualified: prospects.filter((p) => p.status === 'qualified').length,
    converted: prospects.filter((p) => p.status === 'converted').length,
    closed: prospects.filter((p) => p.status === 'closed').length,
  };

  const handleSendInvitation = (prospect: Prospect) => {
    setSelectedProspect(prospect);
    setShowInvitationModal(true);
  };

  const handleInvitationSent = async () => {
    if (selectedProspect && selectedProspect.status === 'new') {
      await updateProspectStatus(selectedProspect.id, 'contacted');
    }
    setShowInvitationModal(false);
    setSelectedProspect(null);
  };

  const handleUpdateProgress = async (prospect: Prospect) => {
    try {
      // First check if this prospect has a user account
      const { data: authUsers } = await supabase.auth.admin.listUsers();
      const existingUser = authUsers?.users.find(u => u.email === prospect.email);

      if (!existingUser) {
        alert('This prospect needs to accept an invitation and create an account before you can track their progress.');
        return;
      }

      // Check if they're in the agent_clients table
      const { data: clientRelation } = await supabase
        .from('agent_clients')
        .select('client_id, client_type')
        .eq('agent_id', user?.id)
        .eq('client_id', existingUser.id)
        .maybeSingle();

      if (!clientRelation) {
        alert('This prospect needs to accept your invitation to become a client before you can track their progress.');
        return;
      }

      if (clientRelation.client_type !== 'buyer') {
        alert('Progress tracking is only available for buyers. This client is registered as a ' + clientRelation.client_type + '.');
        return;
      }

      // Check if they have a buyer journey record
      const { data: buyerJourney } = await supabase
        .from('buyer_journey_progress')
        .select('buyer_id')
        .eq('buyer_id', existingUser.id)
        .maybeSingle();

      if (!buyerJourney) {
        alert('No buyer journey found for this client. The journey is created automatically when they accept your invitation and sign up.');
        return;
      }

      // All checks passed, open the progress modal
      setSelectedBuyer({ id: existingUser.id, name: prospect.full_name });
      setShowProgressModal(true);
    } catch (error) {
      console.error('Error checking buyer status:', error);
      alert('Failed to check buyer status');
    }
  };

  const handleDeleteProspect = async (prospectId: string) => {
    if (!confirm('Are you sure you want to delete this prospect?')) return;

    try {
      const { error } = await supabase
        .from('prospects')
        .delete()
        .eq('id', prospectId);

      if (error) throw error;
      await loadProspects();
    } catch (error) {
      console.error('Error deleting prospect:', error);
      alert('Failed to delete prospect');
    }
  };

  const handleSendEmail = (prospect: Prospect) => {
    setSelectedProspect(prospect);
    setShowEmailModal(true);
  };

  const handleEmailSent = async () => {
    await loadProspects();
    setShowEmailModal(false);
    setSelectedProspect(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedStatus('all')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            selectedStatus === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          All ({statusCounts.all})
        </button>
        {STATUS_OPTIONS.map((status) => (
          <button
            key={status}
            onClick={() => setSelectedStatus(status)}
            className={`px-4 py-2 rounded-lg font-medium transition capitalize ${
              selectedStatus === status
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {status} ({statusCounts[status as keyof typeof statusCounts]})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredProspects.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <p className="text-gray-600">No prospects found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredProspects.map((prospect) => (
            <div
              key={prospect.id}
              className="bg-white rounded-lg shadow-md overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-800 mb-2">
                      {prospect.full_name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Mail size={16} />
                        <a
                          href={`mailto:${prospect.email}`}
                          className="hover:text-blue-600"
                        >
                          {prospect.email}
                        </a>
                      </div>
                      {prospect.phone_number && (
                        <div className="flex items-center gap-1">
                          <Phone size={16} />
                          <a
                            href={`tel:${prospect.phone_number}`}
                            className="hover:text-blue-600"
                          >
                            {prospect.phone_number}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      STATUS_COLORS[prospect.status as keyof typeof STATUS_COLORS]
                    }`}
                  >
                    {prospect.status}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar size={16} />
                    <span>
                      Received: {new Date(prospect.created_at).toLocaleString()}
                    </span>
                  </div>
                  {prospect.contacted_at && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar size={16} />
                      <span>
                        Contacted: {new Date(prospect.contacted_at).toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Tag size={16} />
                    <span className="capitalize">Source: {prospect.source}</span>
                  </div>
                </div>

                <div className="mb-4">
                  <button
                    onClick={() =>
                      setExpandedProspect(
                        expandedProspect === prospect.id ? null : prospect.id
                      )
                    }
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
                  >
                    <MessageSquare size={16} />
                    {expandedProspect === prospect.id ? 'Hide' : 'Show'} Message
                  </button>
                  {expandedProspect === prospect.id && (
                    <div className="mt-2 p-4 bg-gray-50 rounded-md text-sm text-gray-700">
                      {prospect.message}
                    </div>
                  )}
                </div>

                <div className="mb-4 border-t pt-4">
                  <ProspectReminders
                    prospectId={prospect.id}
                    prospectName={prospect.full_name}
                    onReminderSet={() => loadProspects()}
                  />
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">
                      Update Status:
                    </span>
                    <select
                      value={prospect.status}
                      onChange={(e) =>
                        updateProspectStatus(prospect.id, e.target.value)
                      }
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleSendEmail(prospect)}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition text-sm font-medium whitespace-nowrap"
                    >
                      <Send size={16} />
                      Send Email
                    </button>
                    <button
                      onClick={() => handleUpdateProgress(prospect)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition text-sm font-medium whitespace-nowrap"
                    >
                      <TrendingUp size={16} />
                      Update Progress
                    </button>
                    <button
                      onClick={() => handleSendInvitation(prospect)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition text-sm font-medium whitespace-nowrap"
                    >
                      <UserPlus size={16} />
                      Send Invitation
                    </button>
                    <button
                      onClick={() => handleDeleteProspect(prospect.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition text-sm font-medium"
                      title="Delete prospect"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showProgressModal && selectedBuyer && (
        <UpdateBuyerProgress
          buyerId={selectedBuyer.id}
          buyerName={selectedBuyer.name}
          onClose={() => {
            setShowProgressModal(false);
            setSelectedBuyer(null);
          }}
          onUpdate={() => {
            loadProspects();
          }}
        />
      )}

      {showInvitationModal && selectedProspect && (
        <SendInvitation
          onClose={() => {
            setShowInvitationModal(false);
            setSelectedProspect(null);
          }}
          onInvitationSent={handleInvitationSent}
          prefilledEmail={selectedProspect.email}
          prefilledName={selectedProspect.full_name}
        />
      )}

      {showEmailModal && selectedProspect && (
        <SendCustomEmail
          onClose={() => {
            setShowEmailModal(false);
            setSelectedProspect(null);
          }}
          prospectEmail={selectedProspect.email}
          prospectName={selectedProspect.full_name}
          prospectId={selectedProspect.id}
          onEmailSent={handleEmailSent}
        />
      )}
    </div>
  );
}
