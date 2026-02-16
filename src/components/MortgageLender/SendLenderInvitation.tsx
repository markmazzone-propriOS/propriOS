import { useState } from 'react';
import { X, Mail, User, UserPlus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

type SendLenderInvitationProps = {
  onClose: () => void;
  onInvitationSent: () => void;
  prefilledEmail?: string;
  prefilledName?: string;
};

export function SendLenderInvitation({
  onClose,
  onInvitationSent,
  prefilledEmail = '',
  prefilledName = ''
}: SendLenderInvitationProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    email: prefilledEmail,
    name: prefilledName,
    message: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
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

        if (profile && profile.user_type === 'buyer') {
          setSuccess('This user already has an account and has been added as a lead!');

          const { data: lenderProfile } = await supabase
            .from('mortgage_lender_profiles')
            .select('id')
            .eq('id', user.id)
            .single();

          if (lenderProfile) {
            const { data: existingLead } = await supabase
              .from('lender_leads')
              .select('id')
              .eq('lender_id', lenderProfile.id)
              .eq('email', formData.email)
              .maybeSingle();

            if (!existingLead) {
              await supabase
                .from('lender_leads')
                .insert({
                  lender_id: lenderProfile.id,
                  name: formData.name || profile.id,
                  email: formData.email,
                  status: 'contacted',
                  lead_source: 'invitation'
                });
            }
          }

          setTimeout(() => {
            onInvitationSent();
          }, 2000);
          return;
        }
      }

      const { data: lenderProfile } = await supabase
        .from('mortgage_lender_profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (!lenderProfile) {
        setError('Lender profile not found. Please complete your profile setup.');
        return;
      }

      const invitationCheckQuery = supabase
        .from('invitations')
        .select('*')
        .eq('email', formData.email)
        .eq('status', 'pending')
        .eq('mortgage_lender_id', lenderProfile.id);

      const { data: pendingInvitation } = await invitationCheckQuery.maybeSingle();

      if (pendingInvitation) {
        setError('You have already sent a pending invitation to this email address.');
        return;
      }

      const invitationData: any = {
        email: formData.email,
        invitee_name: formData.name || null,
        user_type: 'buyer',
        message: formData.message || null,
        mortgage_lender_id: lenderProfile.id
      };

      const { data: newInvitation, error: inviteError } = await supabase
        .from('invitations')
        .insert(invitationData)
        .select()
        .single();

      if (inviteError) throw inviteError;

      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      const senderName = senderProfile?.full_name || 'Your Mortgage Lender';

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
              userType: 'buyer',
              token: newInvitation.token,
              message: formData.message || null,
              appUrl,
              senderType: 'lender',
            }),
          }
        );

        const emailResult = await emailResponse.json();

        if (!emailResponse.ok) {
          console.error('Failed to send email:', emailResult);
        }
      } catch (emailError) {
        console.error('Error calling email function:', emailError);
      }

      const { data: existingLead } = await supabase
        .from('lender_leads')
        .select('id')
        .eq('lender_id', lenderProfile.id)
        .eq('email', formData.email)
        .maybeSingle();

      if (!existingLead) {
        await supabase
          .from('lender_leads')
          .insert({
            lender_id: lenderProfile.id,
            name: formData.name || 'New Lead',
            email: formData.email,
            status: 'new',
            lead_source: 'invitation'
          });
      }

      setSuccess(`Invitation sent successfully to ${formData.email}!`);

      setTimeout(() => {
        onInvitationSent();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-800">Invite Buyer to Platform</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              {success}
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
                placeholder="buyer@example.com"
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Doe"
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
              placeholder="Add a personal message to your invitation..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-gray-800 mb-2">What happens next?</h3>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• The buyer will receive an email invitation to join Proprieta</li>
              <li>• They can create an account and start their home buying journey</li>
              <li>• Once registered, they will be added to your leads list</li>
              <li>• The invitation will expire in 7 days if not accepted</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? 'Sending...' : 'Send Invitation'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
