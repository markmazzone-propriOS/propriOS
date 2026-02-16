import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { UserType, supabase } from '../../lib/supabase';
import { useNavigate } from '../Navigation/Router';

type SignUpProps = {
  onToggle: () => void;
  redirectPath?: string;
};

export function SignUp({ onToggle, redirectPath }: SignUpProps) {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [userType, setUserType] = useState<UserType>('buyer');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [invitationToken, setInvitationToken] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get('email');
    const nameParam = params.get('name');
    const userTypeParam = params.get('userType');
    const tokenParam = params.get('invitationToken');

    if (emailParam) setEmail(emailParam);
    if (nameParam) setFullName(nameParam);
    if (userTypeParam) setUserType(userTypeParam as UserType);
    if (tokenParam) setInvitationToken(tokenParam);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      await signUp(email, password, fullName, userType, phoneNumber);

      if (invitationToken) {
        await new Promise(resolve => setTimeout(resolve, 500));

        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { error: updateError } = await supabase
            .from('invitations')
            .update({
              status: 'accepted',
              accepted_at: new Date().toISOString(),
              accepted_by: session.user.id,
              updated_at: new Date().toISOString(),
            })
            .eq('token', invitationToken);

          if (updateError) {
            console.error('Error updating invitation:', updateError);
          }
        }
      }

      if (redirectPath && redirectPath !== '/signup' && redirectPath !== '/') {
        navigate(redirectPath);
      } else if (userType === 'agent') {
        navigate('/agent/setup');
      } else if (userType === 'service_provider') {
        navigate('/dashboard');
      } else if (userType === 'mortgage_lender') {
        navigate('/lender/setup');
      } else if (userType === 'property_owner') {
        navigate('/property-owner/setup');
      } else if (userType === 'brokerage') {
        navigate('/brokerage/setup');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">
        {invitationToken ? 'Complete Your Invitation' : 'Create Account'}
      </h2>

      {invitationToken && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-4">
          You've been invited! Complete the form below to create your account.
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Full Name
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={!!invitationToken}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-600"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Confirm Password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone Number
          </label>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            I am a...
          </label>
          <select
            value={userType}
            onChange={(e) => setUserType(e.target.value as UserType)}
            disabled={!!invitationToken}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-600"
          >
            <option value="buyer">Buyer</option>
            <option value="seller">Seller</option>
            <option value="renter">Renter</option>
            <option value="property_owner">Property Owner</option>
            <option value="agent">Real Estate Agent</option>
            <option value="service_provider">Service Provider</option>
            <option value="mortgage_lender">Mortgage Lender</option>
            <option value="brokerage">Brokerage</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating Account...' : 'Sign Up'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-gray-600">
        Already have an account?{' '}
        <button
          onClick={onToggle}
          className="text-blue-600 hover:text-blue-700 font-medium"
        >
          Sign In
        </button>
      </p>
    </div>
  );
}
