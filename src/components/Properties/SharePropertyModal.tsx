import { useState, useEffect } from 'react';
import { X, Share2, MessageSquare } from 'lucide-react';
import { supabase, Profile } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from '../Navigation/Router';

type SharePropertyModalProps = {
  propertyId: string;
  propertyAddress: string;
  onClose: () => void;
};

export function SharePropertyModal({ propertyId, propertyAddress, onClose }: SharePropertyModalProps) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState<Array<{
    id: string;
    subject: string | null;
    otherParticipant: Profile;
  }>>([]);
  const [selectedConversation, setSelectedConversation] = useState<string>('');

  useEffect(() => {
    loadConversations();
  }, [user]);

  const loadConversations = async () => {
    if (!user) return;

    try {
      const { data: participantData, error: participantError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (participantError) throw participantError;

      const conversationIds = participantData.map((p) => p.conversation_id);

      if (conversationIds.length === 0) {
        setConversations([]);
        return;
      }

      const { data: conversationData, error: conversationError } = await supabase
        .from('conversations')
        .select(`
          id,
          subject,
          participants:conversation_participants(
            profile:profiles(*)
          )
        `)
        .in('id', conversationIds);

      if (conversationError) throw conversationError;

      const conversationsWithParticipants = conversationData
        .map((conv: any) => {
          const otherParticipant = conv.participants?.find(
            (p: any) => p.profile.id !== user.id
          )?.profile;

          if (!otherParticipant) return null;

          return {
            id: conv.id,
            subject: conv.subject,
            otherParticipant,
          };
        })
        .filter(Boolean);

      setConversations(conversationsWithParticipants);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const handleShare = async () => {
    if (!user || !selectedConversation) return;

    setLoading(true);
    try {
      const conversation = conversations.find((c) => c.id === selectedConversation);
      if (!conversation) return;

      console.log('Sharing property:', propertyId, 'to conversation:', selectedConversation);

      const { error: shareError } = await supabase
        .from('property_shares')
        .insert({
          property_id: propertyId,
          shared_by_user_id: user.id,
          shared_with_user_id: conversation.otherParticipant.id,
          conversation_id: selectedConversation,
        });

      if (shareError) {
        console.error('Share error:', shareError);
        if (shareError.code === '23505') {
          alert('You have already shared this property with this person.');
        } else {
          throw shareError;
        }
        return;
      }

      console.log('Property share recorded successfully');

      const propertyUrl = `${window.location.origin}/properties/${propertyId}`;
      const shareMessage = `I wanted to share this property with you:\n\n${propertyAddress}\n\n${propertyUrl}`;

      console.log('Sending message:', shareMessage);

      const { error: messageError, data: messageData } = await supabase
        .from('messages')
        .insert({
          conversation_id: selectedConversation,
          sender_id: user.id,
          content: shareMessage,
        })
        .select();

      if (messageError) {
        console.error('Message error:', messageError);
        throw messageError;
      }

      console.log('Message sent successfully:', messageData);

      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', selectedConversation);

      console.log('Navigating to conversation');
      onClose();

      setTimeout(() => {
        navigate(`/messages/${selectedConversation}`);
      }, 100);
    } catch (error) {
      console.error('Error sharing property:', error);
      alert('Failed to share property. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getConversationLabel = (conv: typeof conversations[0]) => {
    if (conv.subject) {
      return `${conv.subject} - ${conv.otherParticipant.full_name}`;
    }
    return conv.otherParticipant.full_name;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white">
          <div className="flex items-center gap-3">
            <Share2 className="text-blue-600" size={24} />
            <h2 className="text-2xl font-bold text-gray-800">Share Property</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <p className="text-gray-700 mb-2">
              <span className="font-medium">Property:</span> {propertyAddress}
            </p>
            <p className="text-sm text-gray-600">
              Share this property in a conversation. The recipient will be assigned this property.
            </p>
          </div>

          {conversations.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare size={48} className="mx-auto text-gray-400 mb-3" />
              <p className="text-gray-600 mb-4">You don't have any conversations yet.</p>
              <button
                onClick={() => {
                  onClose();
                  navigate('/messages/new');
                }}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition font-medium"
              >
                Start a Conversation
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select a conversation:
              </label>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConversation(conv.id)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition ${
                      selectedConversation === conv.id
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-medium text-gray-800">{getConversationLabel(conv)}</p>
                  </button>
                ))}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={onClose}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleShare}
                  disabled={!selectedConversation || loading}
                  className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Sharing...' : 'Share Property'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
