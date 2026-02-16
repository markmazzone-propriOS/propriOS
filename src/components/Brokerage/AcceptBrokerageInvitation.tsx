import { useState, useEffect } from 'react';
import { Building2, CheckCircle, XCircle, Mail, AlertCircle } from 'lucide-react';
import { supabase, BrokerageInvitation } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from '../Navigation/Router';

type InvitationWithBrokerage = BrokerageInvitation & {
  brokerage: {
    id: string;
    company_name: string;
    logo_url: string | null;
    city: string | null;
    state: string | null;
    phone_number: string | null;
    email: string | null;
  };
};

export function AcceptBrokerageInvitation() {
  const { user } = useAuth();
  const { currentRoute, navigate } = useRouter();
  const [invitation, setInvitation] = useState<InvitationWithBrokerage | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const invitationId = currentRoute.params?.id;

  useEffect(() => {
    if (invitationId && user) {
      loadInvitation();
    } else if (!user) {
      setLoading(false);
    }
  }, [invitationId, user]);

  const loadInvitation = async () => {
    if (!invitationId || !user) return;

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user?.email) {
        setError('Unable to verify your email address');
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('brokerage_invitations')
        .select(`
          *,
          brokerage:brokerages(
            id,
            company_name,
            logo_url,
            city,
            state,
            phone_number,
            email
          )
        `)
        .eq('id', invitationId)
        .eq('status', 'pending')
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!data) {
        setError('This invitation is no longer available or has already been processed');
        setLoading(false);
        return;
      }

      if (data.invitee_email.toLowerCase() !== userData.user.email.toLowerCase()) {
        setError('This invitation was sent to a different email address');
        setLoading(false);
        return;
      }

      setInvitation(data as InvitationWithBrokerage);
    } catch (err: any) {
      console.error('Error loading invitation:', err);
      setError(err.message || 'Failed to load invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!user || !invitation) return;

    setProcessing(true);
    setError('');

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

      navigate('/agents/dashboard');
    } catch (err: any) {
      console.error('Error accepting invitation:', err);
      setError(err.message || 'Failed to accept invitation');
      setProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!invitation) return;

    setProcessing(true);
    setError('');

    try {
      await supabase
        .from('brokerage_invitations')
        .update({ status: 'declined' })
        .eq('id', invitation.id);

      navigate('/agents/dashboard');
    } catch (err: any) {
      console.error('Error declining invitation:', err);
      setError(err.message || 'Failed to decline invitation');
      setProcessing(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="text-blue-600" size={32} />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Sign In Required</h2>
            <p className="text-gray-600">
              Please sign in to view and accept this brokerage invitation
            </p>
          </div>
          <button
            onClick={() => navigate('/auth', { redirect: `/brokerage/accept-invitation?id=${invitationId}` })}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition font-medium"
          >
            Sign In
          </button>
          <p className="text-center text-gray-600 mt-4 text-sm">
            Don't have an account?{' '}
            <button
              onClick={() => navigate('/signup', { redirect: `/brokerage/accept-invitation?id=${invitationId}` })}
              className="text-blue-600 hover:underline font-medium"
            >
              Sign Up
            </button>
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="text-red-600" size={32} />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Unable to Load Invitation</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => navigate('/agents/dashboard')}
              className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition font-medium"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!invitation) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-8">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            {invitation.brokerage.logo_url ? (
              <img
                src={invitation.brokerage.logo_url}
                alt={invitation.brokerage.company_name}
                className="w-24 h-24 rounded-lg object-cover border-2 border-gray-200"
              />
            ) : (
              <div className="w-24 h-24 bg-blue-100 rounded-lg flex items-center justify-center border-2 border-blue-200">
                <Building2 className="text-blue-600" size={40} />
              </div>
            )}
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">You're Invited!</h1>
          <p className="text-gray-600 text-lg">
            Join {invitation.brokerage.company_name} on Proprieta
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-3">
            {invitation.brokerage.company_name}
          </h3>
          {(invitation.brokerage.city || invitation.brokerage.state) && (
            <p className="text-gray-700 mb-2">
              {invitation.brokerage.city}, {invitation.brokerage.state}
            </p>
          )}
          {invitation.brokerage.phone_number && (
            <p className="text-gray-700 mb-2">
              Phone: {invitation.brokerage.phone_number}
            </p>
          )}
          {invitation.brokerage.email && (
            <p className="text-gray-700">
              Email: {invitation.brokerage.email}
            </p>
          )}
        </div>

        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">What You'll Get</h3>
          <ul className="space-y-2 text-gray-700">
            <li className="flex items-start gap-2">
              <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
              <span>Access to Proprieta's full suite of agent tools and features</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
              <span>Collaboration with other agents in your brokerage</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
              <span>Shared calendar and team visibility for better coordination</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
              <span>Streamlined client management and transaction tracking</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
              <span>Professional association with {invitation.brokerage.company_name}</span>
            </li>
          </ul>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={handleAccept}
            disabled={processing}
            className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white px-6 py-4 rounded-md hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium text-lg"
          >
            <CheckCircle size={24} />
            {processing ? 'Accepting...' : 'Accept Invitation'}
          </button>
          <button
            onClick={handleDecline}
            disabled={processing}
            className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white px-6 py-4 rounded-md hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium text-lg"
          >
            <XCircle size={24} />
            {processing ? 'Declining...' : 'Decline'}
          </button>
        </div>

        <p className="text-center text-gray-500 text-sm mt-6">
          Invited on {new Date(invitation.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </p>
      </div>
    </div>
  );
}
