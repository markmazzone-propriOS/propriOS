import { useState, useEffect } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { supabase, Profile } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useRouter } from '../Navigation/Router';

type ProfileWithEmail = Profile & { email?: string };

export function NewConversation() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { currentRoute } = useRouter();
  const [users, setUsers] = useState<ProfileWithEmail[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<ProfileWithEmail[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (currentRoute.params?.recipient && users.length > 0) {
      setSelectedUsers([currentRoute.params.recipient]);
    }
  }, [currentRoute.params?.recipient, users]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredUsers(
        users.filter(
          (u) =>
            u.full_name.toLowerCase().includes(query) ||
            u.user_type.toLowerCase().includes(query) ||
            (u.email && u.email.toLowerCase().includes(query))
        )
      );
    }
  }, [searchQuery, users]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      let profilesData: Profile[] = [];

      if (profile?.user_type === 'buyer') {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .in('user_type', ['agent', 'mortgage_lender', 'service_provider'])
          .neq('id', user!.id)
          .order('full_name');

        if (error) throw error;
        profilesData = data || [];
      } else if (profile?.user_type === 'renter') {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .in('user_type', ['agent', 'property_owner', 'service_provider'])
          .neq('id', user!.id)
          .order('full_name');

        if (error) throw error;
        profilesData = data || [];
      } else if (profile?.user_type === 'property_owner') {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_type', 'service_provider')
          .neq('id', user!.id)
          .order('full_name');

        if (error) throw error;
        profilesData = data || [];
      } else {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .neq('id', user!.id)
          .order('full_name');

        if (error) throw error;
        profilesData = data || [];
      }

      const usersWithEmails: ProfileWithEmail[] = await Promise.all(
        profilesData.map(async (profile) => {
          try {
            const { data: emailData } = await supabase.rpc('get_user_email', {
              user_id: profile.id,
            });
            return { ...profile, email: emailData || undefined };
          } catch (error) {
            console.error('Error fetching email for user:', profile.id, error);
            return { ...profile, email: undefined };
          }
        })
      );

      setUsers(usersWithEmails);
      setFilteredUsers(usersWithEmails);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleCreateConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (selectedUsers.length === 0) {
      setError('Please select at least one person to message');
      return;
    }

    if (!message.trim()) {
      setError('Please enter a message');
      return;
    }

    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Current session:', session);
      console.log('Session user:', session?.user);
      console.log('Access token present:', !!session?.access_token);

      const { data: conversationData, error: conversationError } = await supabase
        .from('conversations')
        .insert({
          subject: subject.trim() || null,
        })
        .select()
        .single();

      if (conversationError) throw conversationError;

      const participantInserts = [
        { conversation_id: conversationData.id, user_id: user!.id },
        ...selectedUsers.map((userId) => ({
          conversation_id: conversationData.id,
          user_id: userId,
        })),
      ];

      const { error: participantsError } = await supabase
        .from('conversation_participants')
        .insert(participantInserts);

      if (participantsError) throw participantsError;

      const { error: messageError } = await supabase.from('messages').insert({
        conversation_id: conversationData.id,
        sender_id: user!.id,
        content: message.trim(),
      });

      if (messageError) throw messageError;

      navigate(`/messages/${conversationData.id}`);
    } catch (error: any) {
      console.error('Error creating conversation:', error);
      setError(error.message || 'Failed to create conversation');
    } finally {
      setCreating(false);
    }
  };

  const getUserTypeLabel = (userType: string) => {
    const labels: Record<string, string> = {
      buyer: 'Buyer',
      seller: 'Seller',
      renter: 'Renter',
      agent: 'Real Estate Agent',
      service_provider: 'Service Provider',
      property_owner: 'Property Owner',
      mortgage_lender: 'Mortgage Lender',
    };
    return labels[userType] || userType;
  };

  return (
    <div>
      <div className="bg-white shadow-sm border-b mb-8">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/messages')}
              className="text-gray-600 hover:text-gray-800 transition"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-3xl font-bold text-gray-800">New Conversation</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4">
        <form onSubmit={handleCreateConversation} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="bg-white rounded-lg shadow p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subject (optional)
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What is this conversation about?"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Recipients
            </label>
            <div className="relative mb-4">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                size={20}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, or user type..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {loading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-2">
                {filteredUsers.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-600">No users found matching your search</p>
                  </div>
                ) : (
                  filteredUsers.map((usr) => (
                    <label
                      key={usr.id}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-md cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(usr.id)}
                        onChange={() => toggleUserSelection(usr.id)}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500 rounded"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">{usr.full_name}</p>
                        {usr.email && (
                          <p className="text-sm text-gray-500">{usr.email}</p>
                        )}
                        <p className="text-sm text-gray-600">
                          {getUserTypeLabel(usr.user_type)}
                        </p>
                      </div>
                    </label>
                  ))
                )}
              </div>
            )}

            {selectedUsers.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-gray-600">
                  {selectedUsers.length} recipient{selectedUsers.length !== 1 ? 's' : ''}{' '}
                  selected
                </p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message..."
              rows={6}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={creating || selectedUsers.length === 0 || !message.trim()}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {creating ? 'Creating Conversation...' : 'Send Message'}
          </button>
        </form>
      </div>
    </div>
  );
}
