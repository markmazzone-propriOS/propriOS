import { useState, useEffect } from 'react';
import { Mail, Check, X } from 'lucide-react';
import { supabase, TeamInvitation, Team, Profile } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type InvitationWithDetails = TeamInvitation & {
  team: Team;
  inviter: Profile;
};

export function TeamInvitations() {
  const { user } = useAuth();
  const [invitations, setInvitations] = useState<InvitationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadInvitations();
    }
  }, [user]);

  const loadInvitations = async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        console.log('TeamInvitations: No user found');
        return;
      }

      console.log('TeamInvitations: Loading invitations for email:', userData.user.email);

      const { data, error } = await supabase
        .from('team_invitations')
        .select('*, team:teams!team_invitations_team_id_fkey(*), inviter:profiles!team_invitations_inviter_id_fkey(*)')
        .eq('invitee_email', userData.user.email)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      console.log('TeamInvitations: Query result:', { data, error });

      if (error) throw error;

      const filtered = (data || []).filter(inv => inv.team && inv.inviter);
      console.log('TeamInvitations: Filtered invitations:', filtered);
      setInvitations(filtered);
    } catch (error) {
      console.error('Error loading invitations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (invitationId: string) => {
    setProcessing(invitationId);
    try {
      const { error } = await supabase.rpc('accept_team_invitation', {
        p_invitation_id: invitationId,
      });

      if (error) throw error;

      await loadInvitations();
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      alert(error.message || 'Failed to accept invitation');
    } finally {
      setProcessing(null);
    }
  };

  const handleDecline = async (invitationId: string) => {
    setProcessing(invitationId);
    try {
      const { error } = await supabase
        .from('team_invitations')
        .update({ status: 'declined' })
        .eq('id', invitationId);

      if (error) throw error;

      await loadInvitations();
    } catch (error) {
      console.error('Error declining invitation:', error);
      alert('Failed to decline invitation');
    } finally {
      setProcessing(null);
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
    return null;
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Mail className="text-blue-600" size={20} />
        <h3 className="font-semibold text-gray-800">
          Team Invitations ({invitations.length})
        </h3>
      </div>
      <div className="space-y-3">
        {invitations.map((invitation) => (
          <div
            key={invitation.id}
            className="bg-white p-4 rounded-md shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="font-medium text-gray-800 mb-1">
                  {invitation.inviter?.full_name || 'An agent'} invited you to join
                </p>
                <p className="text-lg font-semibold text-blue-600 mb-2">
                  {invitation.team?.name || 'a team'}
                </p>
                {invitation.team?.description && (
                  <p className="text-sm text-gray-600 mb-3">
                    {invitation.team.description}
                  </p>
                )}
                <p className="text-xs text-gray-500">
                  Invited on {new Date(invitation.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => handleAccept(invitation.id)}
                  disabled={processing === invitation.id}
                  className="flex items-center gap-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition disabled:opacity-50 text-sm font-medium"
                >
                  <Check size={16} />
                  Accept
                </button>
                <button
                  onClick={() => handleDecline(invitation.id)}
                  disabled={processing === invitation.id}
                  className="flex items-center gap-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 transition disabled:opacity-50 text-sm font-medium"
                >
                  <X size={16} />
                  Decline
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
