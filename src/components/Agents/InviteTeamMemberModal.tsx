import { useState, useEffect } from 'react';
import { X, Mail, Check, XCircle, Clock } from 'lucide-react';
import { supabase, Team, TeamInvitation, Profile } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type InviteTeamMemberModalProps = {
  team: Team;
  onClose: () => void;
  onSuccess: () => void;
};

type InvitationWithInviter = TeamInvitation & {
  inviter: Profile;
};

export function InviteTeamMemberModal({ team, onClose, onSuccess }: InviteTeamMemberModalProps) {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [invitations, setInvitations] = useState<InvitationWithInviter[]>([]);

  useEffect(() => {
    loadInvitations();
  }, [team.id]);

  const loadInvitations = async () => {
    try {
      const { data, error } = await supabase
        .from('team_invitations')
        .select('*, inviter:profiles(*)')
        .eq('team_id', team.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setInvitations(data || []);
    } catch (err) {
      console.error('Error loading invitations:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !name.trim()) {
      setError('Email and name are required');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Check if a user with this email exists and is an agent
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .eq('user_type', 'agent')
        .maybeSingle();

      // If the user exists, check if they're already a team member
      if (profileData) {
        const { data: existingMember } = await supabase
          .from('team_members')
          .select('id')
          .eq('team_id', team.id)
          .eq('agent_id', profileData.id)
          .maybeSingle();

        if (existingMember) {
          setError('This agent is already a member of the team');
          setLoading(false);
          return;
        }
      }

      // Check if there's already a pending invitation for this email
      const { data: existingInvitation } = await supabase
        .from('team_invitations')
        .select('id')
        .eq('team_id', team.id)
        .eq('invitee_email', email.trim().toLowerCase())
        .eq('status', 'pending')
        .maybeSingle();

      if (existingInvitation) {
        setError('An invitation has already been sent to this email');
        setLoading(false);
        return;
      }

      const { error: insertError } = await supabase.from('team_invitations').insert({
        team_id: team.id,
        inviter_id: user!.id,
        invitee_email: email.trim().toLowerCase(),
        invitee_name: name.trim(),
      });

      if (insertError) throw insertError;

      setEmail('');
      setName('');
      await loadInvitations();
      onSuccess();
    } catch (err: any) {
      console.error('Error sending invitation:', err);
      setError(err.message || 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from('team_invitations')
        .update({ status: 'cancelled' })
        .eq('id', invitationId);

      if (error) throw error;

      await loadInvitations();
    } catch (err) {
      console.error('Error cancelling invitation:', err);
      alert('Failed to cancel invitation');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted':
        return <Check size={16} className="text-green-600" />;
      case 'declined':
        return <XCircle size={16} className="text-red-600" />;
      case 'cancelled':
        return <XCircle size={16} className="text-gray-600" />;
      default:
        return <Clock size={16} className="text-yellow-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'bg-green-100 text-green-800';
      case 'declined':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Invite Agent to Team</h2>
              <p className="text-gray-600">{team.name}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4 mb-8">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Agent Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="John Doe"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Agent Email *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="agent@example.com"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                The agent must have an account to accept the invitation
              </p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-50"
            >
              <Mail size={20} />
              {loading ? 'Sending Invitation...' : 'Send Invitation'}
            </button>
          </form>

          {invitations.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-800 mb-4">Recent Invitations</h3>
              <div className="space-y-3">
                {invitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-md"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">{invitation.invitee_name}</p>
                      <p className="text-sm text-gray-600">{invitation.invitee_email}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Invited by {invitation.inviter.full_name} on{' '}
                        {new Date(invitation.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(invitation.status)}
                        <span
                          className={`text-xs px-2 py-1 rounded ${getStatusColor(invitation.status)}`}
                        >
                          {invitation.status}
                        </span>
                      </div>
                      {invitation.status === 'pending' && (
                        <button
                          onClick={() => handleCancelInvitation(invitation.id)}
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
