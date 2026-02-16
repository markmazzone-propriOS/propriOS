import { useState, useEffect } from 'react';
import { Building2, CheckCircle, XCircle, Mail } from 'lucide-react';
import { supabase, BrokerageInvitation } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type InvitationWithBrokerage = BrokerageInvitation & {
  brokerage: {
    id: string;
    company_name: string;
    logo_url: string | null;
    city: string | null;
    state: string | null;
  };
};

export function BrokerageInvitations() {
  const { user } = useAuth();
  const [invitations, setInvitations] = useState<InvitationWithBrokerage[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadInvitations();
    }
  }, [user]);

  const loadInvitations = async () => {
    if (!user) return;

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user?.email) return;

      const { data, error } = await supabase
        .from('brokerage_invitations')
        .select(`
          *,
          brokerage:brokerages(
            id,
            company_name,
            logo_url,
            city,
            state
          )
        `)
        .eq('invitee_email', userData.user.email)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setInvitations(data || []);
    } catch (error) {
      console.error('Error loading invitations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (invitation: InvitationWithBrokerage) => {
    if (!user) return;

    setProcessingId(invitation.id);
    try {
      await supabase
        .from('brokerage_agents')
        .insert({
          brokerage_id: invitation.brokerage_id,
          agent_id: user.id,
          status: 'active',
        });

      await supabase
        .from('brokerage_invitations')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', invitation.id);

      await supabase
        .from('agent_profiles')
        .update({ brokerage_id: invitation.brokerage_id })
        .eq('id', user.id);

      setInvitations(invitations.filter(inv => inv.id !== invitation.id));
      alert(`Successfully joined ${invitation.brokerage.company_name}!`);
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      alert(error.message || 'Failed to accept invitation');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (invitationId: string) => {
    setProcessingId(invitationId);
    try {
      await supabase
        .from('brokerage_invitations')
        .update({ status: 'declined' })
        .eq('id', invitationId);

      setInvitations(invitations.filter(inv => inv.id !== invitationId));
    } catch (error: any) {
      console.error('Error declining invitation:', error);
      alert(error.message || 'Failed to decline invitation');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (invitations.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8">
        <div className="text-center py-8">
          <Mail className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-gray-800 mb-2">No Pending Invitations</h3>
          <p className="text-gray-600">You don't have any pending brokerage invitations</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Brokerage Invitations</h2>

      <div className="space-y-4">
        {invitations.map((invitation) => (
          <div
            key={invitation.id}
            className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition"
          >
            <div className="flex items-start gap-4">
              {invitation.brokerage.logo_url ? (
                <img
                  src={invitation.brokerage.logo_url}
                  alt={invitation.brokerage.company_name}
                  className="w-16 h-16 rounded-lg object-cover border-2 border-gray-200"
                />
              ) : (
                <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center border-2 border-blue-200">
                  <Building2 className="text-blue-600" size={28} />
                </div>
              )}

              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-800 mb-1">
                  {invitation.brokerage.company_name}
                </h3>
                {(invitation.brokerage.city || invitation.brokerage.state) && (
                  <p className="text-gray-600 mb-2">
                    {invitation.brokerage.city}, {invitation.brokerage.state}
                  </p>
                )}
                <p className="text-gray-600 mb-4">
                  You've been invited to join this brokerage
                </p>
                <div className="text-sm text-gray-500">
                  Invited {new Date(invitation.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={() => handleAccept(invitation)}
                disabled={processingId === invitation.id}
                className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                <CheckCircle size={20} />
                {processingId === invitation.id ? 'Accepting...' : 'Accept'}
              </button>
              <button
                onClick={() => handleDecline(invitation.id)}
                disabled={processingId === invitation.id}
                className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white px-6 py-3 rounded-md hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                <XCircle size={20} />
                {processingId === invitation.id ? 'Declining...' : 'Decline'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
