import { useState, useEffect } from 'react';
import { MessageSquare, Plus, ArrowLeft, Trash2 } from 'lucide-react';
import { supabase, Conversation, Profile } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useRouter } from '../Navigation/Router';

type ConversationWithDetails = Conversation & {
  participants: { profile: Profile }[];
  lastMessage?: {
    content: string;
    created_at: string;
    sender: Profile;
  };
  unreadCount?: number;
};

export function ConversationList() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { currentRoute } = useRouter();
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (user) {
      loadConversations();

      // Subscribe to new messages
      const messagesSubscription = supabase
        .channel('messages-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
          },
          () => {
            loadConversations();
          }
        )
        .subscribe();

      // Subscribe to new conversations
      const conversationsSubscription = supabase
        .channel('conversations-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'conversations',
          },
          () => {
            loadConversations();
          }
        )
        .subscribe();

      return () => {
        messagesSubscription.unsubscribe();
        conversationsSubscription.unsubscribe();
      };
    }
  }, [user]);

  useEffect(() => {
    if (currentRoute.params?.new) {
      navigate(`/messages/new?recipient=${currentRoute.params.new}`);
    }
  }, [currentRoute.params]);

  const loadConversations = async () => {
    setLoading(true);
    try {
      const { data: participantData, error: participantError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user!.id);

      if (participantError) {
        console.error('Error loading participants:', participantError);
        throw participantError;
      }

      console.log('Participant data:', participantData);
      const conversationIds = participantData.map((p) => p.conversation_id);

      if (conversationIds.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const { data: conversationData, error: conversationError } = await supabase
        .from('conversations')
        .select(`
          *,
          participants:conversation_participants(
            profile:profiles(*)
          )
        `)
        .in('id', conversationIds)
        .order('updated_at', { ascending: false });

      if (conversationError) {
        console.error('Error loading conversations:', conversationError);
        throw conversationError;
      }

      console.log('Raw conversation data:', JSON.stringify(conversationData, null, 2));

      const conversationsWithMessages = await Promise.all(
        (conversationData || []).map(async (conv) => {
          const { data: messageData, error: messageError } = await supabase
            .from('messages')
            .select(`
              content,
              created_at,
              sender:profiles(*)
            `)
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (messageError) {
            console.error('Error loading message:', messageError);
          }

          const { count: unreadCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .eq('is_read', false)
            .neq('sender_id', user!.id);

          return {
            ...conv,
            lastMessage: messageData || undefined,
            unreadCount: unreadCount || 0,
          };
        })
      );

      setConversations(conversationsWithMessages as ConversationWithDetails[]);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const getOtherParticipants = (conv: ConversationWithDetails) => {
    console.log('Getting participants for conv:', conv.id);
    console.log('Current user ID:', user!.id);
    console.log('Conv participants:', conv.participants);
    console.log('Participant count:', conv.participants?.length);

    if (!conv.participants || conv.participants.length === 0) {
      console.log('No participants found!');
      return 'Conversation';
    }

    const others = conv.participants
      .filter((p) => {
        console.log('Checking participant:', p.profile.id, 'vs current user:', user!.id);
        return p.profile.id !== user!.id;
      })
      .map((p) => p.profile.full_name)
      .join(', ');
    console.log('Other participants result:', others);
    return others || 'Conversation';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (diffInHours < 168) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);

      if (error) throw error;

      await loadConversations();
    } catch (error) {
      console.error('Error deleting conversation:', error);
      alert('Failed to delete conversation. Please try again.');
    } finally {
      setDeleting(false);
      setDeleteConfirmId(null);
    }
  };

  console.log('=== RENDER: ConversationList ===');
  console.log('Loading state:', loading);
  console.log('Conversations count:', conversations.length);
  console.log('Conversations data:', conversations);

  return (
    <div>
      <div className="bg-white shadow-sm border-b mb-8">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex flex-col gap-2">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition self-start"
              >
                <ArrowLeft size={20} />
                <span>Back to Dashboard</span>
              </button>
              <h1 className="text-3xl font-bold text-gray-800">Messages</h1>
            </div>
            <button
              onClick={() => navigate('/messages/new')}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition font-medium"
            >
              <Plus size={20} />
              New Message
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading conversations...</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <MessageSquare size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 text-lg mb-4">No conversations yet</p>
            <button
              onClick={() => navigate('/messages/new')}
              className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition font-medium"
            >
              Start a Conversation
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow divide-y">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`flex items-center px-6 py-4 hover:bg-gray-50 transition relative ${
                  conv.unreadCount > 0 ? 'bg-blue-50' : ''
                }`}
              >
                <button
                  onClick={() => navigate(`/messages/${conv.id}`)}
                  className="flex-1 text-left min-w-0"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={`font-semibold truncate ${
                          conv.unreadCount > 0 ? 'text-gray-900' : 'text-gray-800'
                        }`}>
                          {conv.subject ? `${conv.subject} - ${getOtherParticipants(conv)}` : getOtherParticipants(conv)}
                        </h3>
                        {conv.unreadCount > 0 && (
                          <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold text-white bg-blue-600 rounded-full">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                      {conv.lastMessage && (
                        <p className={`text-sm truncate ${
                          conv.unreadCount > 0 ? 'text-gray-900 font-medium' : 'text-gray-600'
                        }`}>
                          <span className="font-medium">
                            {conv.lastMessage.sender?.id === user!.id
                              ? 'You'
                              : conv.lastMessage.sender?.full_name || 'Unknown'}:
                          </span>{' '}
                          {conv.lastMessage.content}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 ml-4 flex-shrink-0">
                      {conv.lastMessage && (
                        <span className="text-xs text-gray-500">
                          {formatDate(conv.lastMessage.created_at)}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirmId(conv.id);
                  }}
                  className="ml-3 text-red-600 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition flex-shrink-0"
                  title="Delete conversation"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Delete Conversation
            </h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this conversation? This will permanently delete all messages and cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirmId(null)}
                disabled={deleting}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteConversation(deleteConfirmId)}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
