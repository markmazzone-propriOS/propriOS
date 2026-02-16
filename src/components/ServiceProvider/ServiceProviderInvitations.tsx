import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  X,
  Mail,
  User,
  Wrench,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  Trash2,
  Link as LinkIcon,
  Copy,
  AlertCircle
} from 'lucide-react';

type Invitation = {
  id: string;
  email: string;
  invitee_name?: string;
  user_type: string;
  token: string;
  status: string;
  expires_at: string;
  accepted_at?: string;
  message?: string;
  created_at: string;
};

export function ServiceProviderInvitations() {
  const { user } = useAuth();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    message: '',
  });
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadInvitations();
    }
  }, [user]);

  const loadInvitations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .eq('service_provider_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setInvitations(data);
    } catch (error) {
      console.error('Error loading invitations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSending(true);
    setError('');
    setSuccess('');

    try {
      const { data: authUsers } = await supabase.auth.admin.listUsers();
      const existingUser = authUsers?.users.find(u => u.email === formData.email);

      if (existingUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, user_type')
          .eq('id', existingUser.id)
          .maybeSingle();

        if (profile?.user_type === 'service_provider') {
          setError('This user is already a service provider on the platform.');
          return;
        }
      }

      const { data: pendingInvitation } = await supabase
        .from('invitations')
        .select('*')
        .eq('service_provider_id', user.id)
        .eq('email', formData.email)
        .eq('status', 'pending')
        .maybeSingle();

      if (pendingInvitation) {
        setError('You have already sent a pending invitation to this email address.');
        return;
      }

      const { data: newInvitation, error: inviteError } = await supabase
        .from('invitations')
        .insert({
          service_provider_id: user.id,
          email: formData.email,
          invitee_name: formData.name || null,
          user_type: 'service_provider',
          message: formData.message || null,
        })
        .select()
        .single();

      if (inviteError) throw inviteError;

      const { data: providerProfile } = await supabase
        .from('service_provider_profiles')
        .select('business_name, profiles:profiles(full_name)')
        .eq('id', user.id)
        .single();

      const senderName = providerProfile?.business_name || (providerProfile?.profiles as any)?.full_name || 'A Service Provider';

      try {
        const appUrl = window.location.origin;

        const emailResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invitation-email`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              invitationId: newInvitation.id,
              email: formData.email,
              inviteeName: formData.name || null,
              agentName: senderName,
              userType: 'service_provider',
              token: newInvitation.token,
              message: formData.message || null,
              appUrl,
            }),
          }
        );

        if (!emailResponse.ok) {
          console.error('Failed to send email');
        }
      } catch (emailError) {
        console.error('Error calling email function:', emailError);
      }

      setSuccess(`Invitation sent successfully to ${formData.email}!`);
      setFormData({ email: '', name: '', message: '' });
      await loadInvitations();

      setTimeout(() => {
        setShowInviteModal(false);
        setSuccess('');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to send invitation');
    } finally {
      setSending(false);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!confirm('Are you sure you want to cancel this invitation?')) return;

    try {
      const { error } = await supabase
        .from('invitations')
        .update({ status: 'cancelled' })
        .eq('id', invitationId);

      if (error) throw error;
      await loadInvitations();
    } catch (error) {
      console.error('Error cancelling invitation:', error);
      alert('Failed to cancel invitation');
    }
  };

  const handleDeleteInvitation = async (invitationId: string) => {
    if (!confirm('Are you sure you want to delete this invitation?')) return;

    try {
      const { error } = await supabase
        .from('invitations')
        .delete()
        .eq('id', invitationId);

      if (error) throw error;
      await loadInvitations();
    } catch (error) {
      console.error('Error deleting invitation:', error);
      alert('Failed to delete invitation');
    }
  };

  const copyInvitationLink = async (token: string) => {
    const inviteUrl = `${window.location.origin}/accept-invitation?token=${token}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  const getStatusBadge = (invitation: Invitation) => {
    switch (invitation.status) {
      case 'pending':
        return (
          <span className="flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock size={14} className="mr-1" />
            Pending
          </span>
        );
      case 'accepted':
        return (
          <span className="flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle size={14} className="mr-1" />
            Accepted
          </span>
        );
      case 'cancelled':
        return (
          <span className="flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            <XCircle size={14} className="mr-1" />
            Cancelled
          </span>
        );
      default:
        return null;
    }
  };

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Invite Service Providers</h2>
            <p className="text-gray-600 mt-1">
              Help grow the platform by inviting other service providers to join
            </p>
          </div>
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
          >
            <Send size={20} className="mr-2" />
            Send Invitation
          </button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Why Invite Others?</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Expand the network of trusted service providers on the platform</li>
            <li>• Help build a comprehensive marketplace for real estate services</li>
            <li>• Connect with fellow professionals in your industry</li>
            <li>• Create potential collaboration opportunities</li>
          </ul>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-xl font-bold text-gray-800">Invitation History</h3>
        </div>

        <div className="divide-y divide-gray-200">
          {invitations.length === 0 ? (
            <div className="p-12 text-center">
              <Mail className="mx-auto text-gray-400 mb-4" size={48} />
              <p className="text-gray-600">No invitations sent yet</p>
              <button
                onClick={() => setShowInviteModal(true)}
                className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
              >
                Send your first invitation
              </button>
            </div>
          ) : (
            invitations.map((invitation) => (
              <div key={invitation.id} className="p-6 hover:bg-gray-50 transition">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-semibold text-gray-800">
                        {invitation.invitee_name || invitation.email}
                      </h4>
                      {getStatusBadge(invitation)}
                      {invitation.status === 'pending' && isExpired(invitation.expires_at) && (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Expired
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p className="flex items-center">
                        <Mail size={14} className="mr-2" />
                        {invitation.email}
                      </p>
                      <p className="flex items-center">
                        <Clock size={14} className="mr-2" />
                        Sent {new Date(invitation.created_at).toLocaleDateString()} •
                        Expires {new Date(invitation.expires_at).toLocaleDateString()}
                      </p>
                      {invitation.accepted_at && (
                        <p className="flex items-center text-green-600">
                          <CheckCircle size={14} className="mr-2" />
                          Accepted on {new Date(invitation.accepted_at).toLocaleDateString()}
                        </p>
                      )}
                      {invitation.message && (
                        <p className="mt-2 text-gray-700 italic">
                          Message: "{invitation.message}"
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {invitation.status === 'pending' && !isExpired(invitation.expires_at) && (
                      <>
                        <button
                          onClick={() => copyInvitationLink(invitation.token)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition"
                          title="Copy invitation link"
                        >
                          {copiedToken === invitation.token ? (
                            <CheckCircle size={18} />
                          ) : (
                            <Copy size={18} />
                          )}
                        </button>
                        <button
                          onClick={() => handleCancelInvitation(invitation.id)}
                          className="p-2 text-orange-600 hover:bg-orange-50 rounded-md transition"
                          title="Cancel invitation"
                        >
                          <XCircle size={18} />
                        </button>
                      </>
                    )}
                    {invitation.status !== 'pending' && (
                      <button
                        onClick={() => handleDeleteInvitation(invitation.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-md transition"
                        title="Delete invitation"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-800">Invite Service Provider</h2>
              <button
                onClick={() => {
                  setShowInviteModal(false);
                  setError('');
                  setSuccess('');
                }}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSendInvitation} className="p-6 space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded flex items-start">
                  <AlertCircle size={20} className="mr-2 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded flex items-start">
                  <CheckCircle size={20} className="mr-2 flex-shrink-0 mt-0.5" />
                  <span>{success}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    placeholder="provider@example.com"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name or Business Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="John's Plumbing Services"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Personal Message (Optional)
                </label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  rows={4}
                  placeholder="Add a personal message about why they should join the platform..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <Wrench className="text-blue-600 mr-3 mt-1 flex-shrink-0" size={24} />
                  <div>
                    <h3 className="font-medium text-gray-800 mb-2">What happens next?</h3>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• The invitee will receive an email with a link to join Proprieta</li>
                      <li>• They can create an account as a service provider</li>
                      <li>• They'll have access to all platform features for service providers</li>
                      <li>• The invitation will expire in 7 days if not accepted</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={sending}
                  className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {sending ? 'Sending...' : 'Send Invitation'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowInviteModal(false);
                    setError('');
                    setSuccess('');
                  }}
                  disabled={sending}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
