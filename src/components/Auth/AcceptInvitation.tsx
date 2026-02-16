import { useState, useEffect } from 'react';
import { Mail, User, Lock, UserPlus, Briefcase, CheckCircle, Users, Wrench } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from '../Navigation/Router';

type AcceptInvitationProps = {
  token: string;
};

type Invitation = {
  id: string;
  email: string;
  user_type: 'buyer' | 'seller' | 'agent' | 'service_provider';
  message: string | null;
  status: string;
  expires_at: string;
  agent: {
    profile: {
      full_name: string;
    };
  };
};

export function AcceptInvitation({ token }: AcceptInvitationProps) {
  const navigate = useNavigate();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'loading' | 'invalid' | 'form' | 'success' | 'redirecting'>('loading');

  const [formData, setFormData] = useState({
    fullName: '',
    password: '',
    confirmPassword: '',
    phoneNumber: '',
  });

  useEffect(() => {
    console.log('AcceptInvitation mounted with token:', token);
    checkAuthAndLoadInvitation();
  }, [token]);

  const checkAuthAndLoadInvitation = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      console.log('User is already logged in, signing out first');
      await supabase.auth.signOut();
    }
    loadInvitation();
  };

  const loadInvitation = async () => {
    try {
      console.log('Loading invitation with token:', token);

      const { data, error: fetchError } = await supabase
        .from('invitations')
        .select(`
          id,
          email,
          invitee_name,
          user_type,
          message,
          status,
          expires_at,
          agent:agent_profiles(
            profile:profiles!agent_profiles_id_fkey(full_name)
          )
        `)
        .eq('token', token)
        .maybeSingle();

      console.log('Invitation query result:', { data, error: fetchError });

      if (fetchError) throw fetchError;

      if (!data) {
        console.log('No invitation found');
        setStep('invalid');
        setError('Invalid invitation link');
        setLoading(false);
        return;
      }

      if (data.status !== 'pending') {
        console.log('Invitation not pending, status:', data.status);
        setStep('invalid');
        setError('This invitation has already been used or expired');
        setLoading(false);
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        console.log('Invitation expired');
        setStep('invalid');
        setError('This invitation has expired');
        setLoading(false);
        return;
      }

      console.log('Invitation valid, redirecting to signup');
      setStep('redirecting');

      const queryParams = new URLSearchParams({
        email: data.email,
        name: data.invitee_name || '',
        userType: data.user_type,
        invitationToken: token,
      });

      console.log('Query params:', queryParams.toString());
      console.log('Setting hash to:', `/signup?${queryParams.toString()}`);

      setTimeout(() => {
        window.location.hash = `/signup?${queryParams.toString()}`;
      }, 100);
    } catch (err: any) {
      console.error('Error loading invitation:', err);
      setStep('invalid');
      setError(err.message || 'Failed to load invitation');
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation) return;

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: invitation.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            phone_number: formData.phoneNumber || null,
            user_type: invitation.user_type,
          },
        },
      });

      if (signUpError) throw signUpError;

      if (!authData.user) {
        throw new Error('Failed to create account');
      }

      if (!authData.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: invitation.email,
          password: formData.password,
        });

        if (signInError) throw signInError;
      }

      const { error: updateError } = await supabase
        .from('invitations')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
          accepted_by: authData.user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', invitation.id);

      if (updateError) {
        console.error('Error updating invitation:', updateError);
        throw updateError;
      }

      setStep('success');

      setTimeout(() => {
        if (invitation.user_type === 'agent') {
          navigate('/agent/setup');
        } else if (invitation.user_type === 'service_provider') {
          navigate('/dashboard');
        } else {
          navigate('/dashboard');
        }
      }, 2000);
    } catch (err: any) {
      console.error('Error in acceptance flow:', err);
      setError(err.message || 'Failed to create account');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'loading' || step === 'redirecting') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100 p-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">
            {step === 'redirecting' ? 'Redirecting to sign up...' : 'Loading invitation...'}
          </p>
        </div>
      </div>
    );
  }

  if (step === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100 p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail size={32} className="text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Invalid Invitation</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition font-medium"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100 p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome to Proprieta!</h2>
          <p className="text-gray-600 mb-6">
            Your account has been created successfully. You are now connected with your agent and can start exploring properties.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition font-medium"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full overflow-hidden">
        <div className="bg-blue-600 text-white p-8 text-center">
          <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
            {invitation?.user_type === 'buyer' ? (
              <UserPlus size={40} />
            ) : invitation?.user_type === 'seller' ? (
              <Briefcase size={40} />
            ) : invitation?.user_type === 'agent' ? (
              <Users size={40} />
            ) : (
              <Wrench size={40} />
            )}
          </div>
          <h1 className="text-3xl font-bold mb-2">You're Invited!</h1>
          <p className="text-blue-100">
            {invitation?.agent.profile.full_name} has invited you to join Proprieta as a{' '}
            {invitation?.user_type === 'service_provider' ? 'service provider' : invitation?.user_type}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {invitation?.message && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-800 mb-1">Message from your agent:</p>
              <p className="text-gray-700">{invitation.message}</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="email"
                value={invitation?.email || ''}
                disabled
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Full Name *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                required
                placeholder="John Doe"
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number (Optional)
            </label>
            <input
              type="tel"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              placeholder="(555) 123-4567"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password *
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                placeholder="Minimum 6 characters"
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confirm Password *
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
                placeholder="Re-enter your password"
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {submitting ? 'Creating Account...' : 'Accept Invitation & Create Account'}
          </button>

          <p className="text-sm text-gray-600 text-center">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => navigate('/signin')}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Sign In
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
