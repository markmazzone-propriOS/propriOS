import { useState } from 'react';
import { X, UserPlus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type InviteAgentModalProps = {
  brokerageId: string;
  onClose: () => void;
  onInviteSent: (invitation: any) => Promise<void>;
};

export function InviteAgentModal({ brokerageId, onClose, onInviteSent }: InviteAgentModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [agentEmail, setAgentEmail] = useState('');
  const [agentName, setAgentName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError('');

    try {
      const { data: existingInvitation } = await supabase
        .from('brokerage_invitations')
        .select('*')
        .eq('brokerage_id', brokerageId)
        .eq('invitee_email', agentEmail)
        .eq('status', 'pending')
        .maybeSingle();

      if (existingInvitation) {
        setError('An invitation has already been sent to this email address');
        setLoading(false);
        return;
      }

      const { data: newInvitation, error: invitationError } = await supabase
        .from('brokerage_invitations')
        .insert({
          brokerage_id: brokerageId,
          inviter_id: user.id,
          invitee_email: agentEmail,
          invitee_name: agentName || null,
          status: 'pending',
        })
        .select()
        .single();

      if (invitationError) throw invitationError;

      await onInviteSent(newInvitation);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <UserPlus className="text-blue-600" size={20} />
            </div>
            <h3 className="text-xl font-bold text-gray-800">Invite Agent</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Agent Name
            </label>
            <input
              type="text"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="John Doe"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Agent Email *
            </label>
            <input
              type="email"
              value={agentEmail}
              onChange={(e) => setAgentEmail(e.target.value)}
              required
              placeholder="agent@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-sm text-gray-500 mt-1">
              The agent will receive an email invitation to join your brokerage
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
