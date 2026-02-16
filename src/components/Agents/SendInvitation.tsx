import { useState } from 'react';
import { X, Mail, UserPlus, Briefcase, User, Users, Wrench, Building, Home } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

type SendInvitationProps = {
  onClose: () => void;
  onInvitationSent: () => void;
  prefilledEmail?: string;
  prefilledName?: string;
  prefilledUserType?: 'buyer' | 'seller' | 'agent' | 'service_provider' | 'property_owner' | 'renter';
};

export function SendInvitation({
  onClose,
  onInvitationSent,
  prefilledEmail = '',
  prefilledName = '',
  prefilledUserType = 'buyer'
}: SendInvitationProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    email: prefilledEmail,
    name: prefilledName,
    userType: prefilledUserType,
    message: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { data: currentUserProfile } = await supabase
        .from('profiles')
        .select('user_type')
        .eq('id', user.id)
        .single();

      const currentUserType = currentUserProfile?.user_type;

      const { data: authUsers } = await supabase.auth.admin.listUsers();
      const existingUser = authUsers?.users.find(u => u.email === formData.email);

      if (existingUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, user_type')
          .eq('id', existingUser.id)
          .maybeSingle();

        if (profile) {
          if (formData.userType === 'agent' && profile.user_type !== 'agent') {
            setError('This user is not an agent. Please select Buyer, Seller, or Service Provider.');
            return;
          }

          if (formData.userType !== 'agent' && profile.user_type === 'agent') {
            setError('This user is an agent. Please select Agent Referral to connect.');
            return;
          }

          if (formData.userType === 'agent') {
            setSuccess('This agent already has an account. Agent referral recorded!');
            setTimeout(() => {
              onInvitationSent();
            }, 2000);
            return;
          }

          if (currentUserType === 'agent') {
            const { data: existingRelationship } = await supabase
              .from('agent_clients')
              .select('*')
              .eq('agent_id', user.id)
              .eq('client_id', profile.id)
              .maybeSingle();

            if (existingRelationship) {
              setError('This user is already your client.');
              return;
            }

            await supabase
              .from('agent_clients')
              .insert({
                agent_id: user.id,
                client_id: profile.id,
                client_type: formData.userType,
              });
          }

          setSuccess('This user already has an account and has been added to your list!');
          setTimeout(() => {
            onInvitationSent();
          }, 2000);
          return;
        }
      }

      const invitationCheckQuery = supabase
        .from('invitations')
        .select('*')
        .eq('email', formData.email)
        .eq('status', 'pending');

      if (currentUserType === 'agent') {
        invitationCheckQuery.eq('agent_id', user.id);
      } else if (currentUserType === 'service_provider') {
        invitationCheckQuery.eq('service_provider_id', user.id);
      } else if (currentUserType === 'property_owner') {
        invitationCheckQuery.eq('property_owner_id', user.id);
      }

      const { data: pendingInvitation } = await invitationCheckQuery.maybeSingle();

      if (pendingInvitation) {
        setError('You have already sent a pending invitation to this email address.');
        return;
      }

      const invitationData: any = {
        email: formData.email,
        invitee_name: formData.name || null,
        user_type: formData.userType,
        message: formData.message || null,
      };

      if (currentUserType === 'agent') {
        invitationData.agent_id = user.id;
      } else if (currentUserType === 'service_provider') {
        invitationData.service_provider_id = user.id;
      } else if (currentUserType === 'property_owner') {
        invitationData.property_owner_id = user.id;
      }

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

      const senderName = senderProfile?.full_name || 'Your Contact';

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
              userType: formData.userType,
              token: newInvitation.token,
              message: formData.message || null,
              appUrl,
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

      setSuccess(`Invitation sent successfully to ${formData.email}! Click the link icon in the invitations list to open it.`);

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
          <h2 className="text-2xl font-bold text-gray-800">Send Invitation</h2>
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
                placeholder="client@example.com"
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
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Invite as *
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, userType: 'buyer' })}
                className={`p-4 border-2 rounded-lg transition ${
                  formData.userType === 'buyer'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <UserPlus className={`mx-auto mb-2 ${formData.userType === 'buyer' ? 'text-blue-600' : 'text-gray-600'}`} size={32} />
                <p className={`font-medium ${formData.userType === 'buyer' ? 'text-blue-600' : 'text-gray-700'}`}>
                  Buyer
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Looking to purchase or rent
                </p>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, userType: 'seller' })}
                className={`p-4 border-2 rounded-lg transition ${
                  formData.userType === 'seller'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <Briefcase className={`mx-auto mb-2 ${formData.userType === 'seller' ? 'text-blue-600' : 'text-gray-600'}`} size={32} />
                <p className={`font-medium ${formData.userType === 'seller' ? 'text-blue-600' : 'text-gray-700'}`}>
                  Seller
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Looking to sell or list property
                </p>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, userType: 'service_provider' })}
                className={`p-4 border-2 rounded-lg transition ${
                  formData.userType === 'service_provider'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <Wrench className={`mx-auto mb-2 ${formData.userType === 'service_provider' ? 'text-blue-600' : 'text-gray-600'}`} size={32} />
                <p className={`font-medium ${formData.userType === 'service_provider' ? 'text-blue-600' : 'text-gray-700'}`}>
                  Service Provider
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Inspector, contractor, etc.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, userType: 'property_owner' })}
                className={`p-4 border-2 rounded-lg transition ${
                  formData.userType === 'property_owner'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <Building className={`mx-auto mb-2 ${formData.userType === 'property_owner' ? 'text-blue-600' : 'text-gray-600'}`} size={32} />
                <p className={`font-medium ${formData.userType === 'property_owner' ? 'text-blue-600' : 'text-gray-700'}`}>
                  Property Owner
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Landlord, rental owner
                </p>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, userType: 'renter' })}
                className={`p-4 border-2 rounded-lg transition ${
                  formData.userType === 'renter'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <Home className={`mx-auto mb-2 ${formData.userType === 'renter' ? 'text-blue-600' : 'text-gray-600'}`} size={32} />
                <p className={`font-medium ${formData.userType === 'renter' ? 'text-blue-600' : 'text-gray-700'}`}>
                  Renter
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Looking to rent a property
                </p>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, userType: 'agent' })}
                className={`p-4 border-2 rounded-lg transition ${
                  formData.userType === 'agent'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <Users className={`mx-auto mb-2 ${formData.userType === 'agent' ? 'text-blue-600' : 'text-gray-600'}`} size={32} />
                <p className={`font-medium ${formData.userType === 'agent' ? 'text-blue-600' : 'text-gray-700'}`}>
                  Agent Referral
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Refer another agent
                </p>
              </button>
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
              {formData.userType === 'agent' ? (
                <>
                  <li>• The agent will receive an email with information about your referral</li>
                  <li>• They can create an account as an agent if they don't have one</li>
                  <li>• The referral will be recorded in your invitation history</li>
                  <li>• The invitation will expire in 7 days if not accepted</li>
                </>
              ) : (
                <>
                  <li>• The invitee will receive an email with a link to join Proprieta</li>
                  <li>• They can create an account as a {formData.userType === 'service_provider' ? 'service provider' : formData.userType === 'property_owner' ? 'property owner' : formData.userType === 'renter' ? 'renter' : formData.userType}</li>
                  <li>• Once accepted, they will automatically be added to your {formData.userType === 'service_provider' || formData.userType === 'property_owner' ? 'contact' : 'client'} list</li>
                  <li>• The invitation will expire in 7 days if not accepted</li>
                </>
              )}
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
