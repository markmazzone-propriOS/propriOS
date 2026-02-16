import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, Home as HomeIcon, Trash2, Paperclip, X, File, Download } from 'lucide-react';
import { supabase, Message, Profile } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from '../Navigation/Router';

type MessageAttachment = {
  id: string;
  message_id: string;
  file_name: string;
  file_url: string;
  file_size: number;
  file_type: string;
  uploaded_by: string;
  created_at: string;
};

type MessageWithSender = Message & {
  sender: Profile;
  attachments?: MessageAttachment[];
};

type ConversationViewProps = {
  conversationId: string;
};

export function ConversationView({ conversationId }: ConversationViewProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [participants, setParticipants] = useState<Profile[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (conversationId) {
      loadConversation();
      loadMessages();
      markAsRead();

      const channel = supabase
        .channel(`conversation-${conversationId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            loadMessages();
            markAsRead();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversation = async () => {
    try {
      const { data, error } = await supabase
        .from('conversation_participants')
        .select('profile:profiles(*)')
        .eq('conversation_id', conversationId);

      if (error) throw error;

      const participantProfiles = data.map((p: any) => p.profile);
      setParticipants(participantProfiles);
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  };

  const loadMessages = async () => {
    setLoading(true);
    try {
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles(*)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      const messageIds = messagesData?.map((m) => m.id) || [];

      if (messageIds.length > 0) {
        const { data: attachmentsData, error: attachmentsError } = await supabase
          .from('message_attachments')
          .select('*')
          .in('message_id', messageIds);

        if (attachmentsError) throw attachmentsError;

        const messagesWithAttachments = (messagesData || []).map((message) => ({
          ...message,
          attachments: attachmentsData?.filter((att) => att.message_id === message.id) || [],
        })) as MessageWithSender[];

        setMessages(messagesWithAttachments);
      } else {
        setMessages((messagesData || []) as MessageWithSender[]);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async () => {
    try {
      await supabase.rpc('mark_messages_as_read', {
        p_conversation_id: conversationId,
        p_user_id: user!.id
      });

      await supabase
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', user!.id);
    } catch (error) {
      console.error('Error marking conversation as read:', error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...newFiles]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const uploadAttachments = async (messageId: string) => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    try {
      for (const file of selectedFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user!.id}/${messageId}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('message-attachments')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('message-attachments')
          .getPublicUrl(fileName);

        const { error: attachmentError } = await supabase
          .from('message_attachments')
          .insert({
            message_id: messageId,
            file_name: file.name,
            file_url: urlData.publicUrl,
            file_size: file.size,
            file_type: file.type,
            uploaded_by: user!.id,
          });

        if (attachmentError) throw attachmentError;
      }

      setSelectedFiles([]);
    } catch (error) {
      console.error('Error uploading attachments:', error);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && selectedFiles.length === 0) || sending || uploading) return;

    setSending(true);
    const messageContent = newMessage.trim() || '📎 Attachment';
    setNewMessage('');

    try {
      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user!.id,
          content: messageContent,
        })
        .select()
        .single();

      if (messageError) throw messageError;

      if (selectedFiles.length > 0) {
        await uploadAttachments(messageData.id);
      }

      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      await loadMessages();
    } catch (error) {
      console.error('Error sending message:', error);
      setNewMessage(messageContent);
    } finally {
      setSending(false);
    }
  };

  const downloadAttachment = async (attachment: MessageAttachment) => {
    try {
      const pathParts = attachment.file_url.split('/message-attachments/');
      if (pathParts.length !== 2) {
        throw new Error('Invalid file URL');
      }
      const filePath = pathParts[1];

      const { data, error } = await supabase.storage
        .from('message-attachments')
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading attachment:', error);
      alert('Failed to download attachment. Please try again.');
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getOtherParticipants = () => {
    return participants
      .filter((p) => p.id !== user!.id)
      .map((p) => p.full_name)
      .join(', ');
  };

  const handleDeleteConversation = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);

      if (error) throw error;

      navigate('/messages');
    } catch (error) {
      console.error('Error deleting conversation:', error);
      alert('Failed to delete conversation. Please try again.');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const renderMessageContent = (message: MessageWithSender) => {
    const propertyUrlPattern = /\/properties\/([a-f0-9-]+)/;
    const match = message.content.match(propertyUrlPattern);
    const isOwnMessage = message.sender_id === user!.id;

    if (match) {
      const lines = message.content.split('\n');
      const propertyId = match[1];
      let propertyAddress = '';

      for (const line of lines) {
        if (line.trim() && !line.includes('wanted to share') && !line.includes('/properties/')) {
          propertyAddress = line.trim();
          break;
        }
      }

      return (
        <div>
          <p className="whitespace-pre-wrap mb-3">{lines[0]}</p>
          <div className="bg-white/10 rounded-lg p-3 border border-current/20">
            <div className="flex items-start gap-2 mb-2">
              <HomeIcon size={18} className="flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-sm">{propertyAddress || 'Property'}</p>
              </div>
            </div>
            <button
              onClick={() => navigate(`/properties/${propertyId}?from=messages&conversation=${conversationId}`)}
              className="w-full bg-white/20 hover:bg-white/30 py-2 px-3 rounded transition text-sm font-medium"
            >
              View Property
            </button>
          </div>
        </div>
      );
    }

    return (
      <div>
        {message.content !== '📎 Attachment' && (
          <p className="whitespace-pre-wrap">{message.content}</p>
        )}
        {message.attachments && message.attachments.length > 0 && (
          <div className={`space-y-2 ${message.content !== '📎 Attachment' ? 'mt-3' : ''}`}>
            {message.attachments.map((attachment) => (
              <div
                key={attachment.id}
                className={`flex items-center justify-between gap-3 ${
                  isOwnMessage
                    ? 'bg-white/10 border-white/20'
                    : 'bg-gray-50 border-gray-200'
                } border rounded-lg p-3`}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <File size={20} className="flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{attachment.file_name}</p>
                    <p className={`text-xs ${isOwnMessage ? 'text-blue-100' : 'text-gray-500'}`}>
                      {formatFileSize(attachment.file_size)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => downloadAttachment(attachment)}
                  className={`p-2 rounded-lg transition flex-shrink-0 ${
                    isOwnMessage
                      ? 'hover:bg-white/20'
                      : 'hover:bg-gray-200'
                  }`}
                  title="Download attachment"
                >
                  <Download size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/messages')}
                className="text-gray-600 hover:text-gray-800 transition"
              >
                <ArrowLeft size={24} />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-800">
                  {getOtherParticipants() || 'Conversation'}
                </h1>
                <p className="text-sm text-gray-600">
                  {participants.length} participant{participants.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-red-600 hover:text-red-700 transition p-2 hover:bg-red-50 rounded-lg"
              title="Delete conversation"
            >
              <Trash2 size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50 px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((message, index) => {
              const isOwnMessage = message.sender_id === user!.id;
              const previousMessage = index > 0 ? messages[index - 1] : null;
              const showSenderName = !previousMessage || previousMessage.sender_id !== message.sender_id;

              return (
                <div
                  key={message.id}
                  className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} ${
                    showSenderName ? 'mt-4' : 'mt-1'
                  }`}
                >
                  <div className="flex flex-col max-w-md">
                    {showSenderName && (
                      <p className={`text-xs font-semibold mb-1 px-1 ${
                        isOwnMessage ? 'text-right text-gray-600' : 'text-left text-gray-600'
                      }`}>
                        {message.sender.full_name}
                      </p>
                    )}
                    <div
                      className={`${
                        isOwnMessage
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-800'
                      } rounded-lg px-4 py-3 shadow`}
                    >
                      {renderMessageContent(message)}
                      <p
                        className={`text-xs mt-1 ${
                          isOwnMessage ? 'text-blue-100' : 'text-gray-500'
                        }`}
                      >
                        {formatTime(message.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="bg-white border-t px-4 py-4">
        <div className="max-w-4xl mx-auto">
          {selectedFiles.length > 0 && (
            <div className="mb-3 space-y-2">
              {selectedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <File size={20} className="text-gray-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="p-1.5 hover:bg-gray-200 rounded-lg transition flex-shrink-0"
                    title="Remove file"
                  >
                    <X size={16} className="text-gray-600" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              multiple
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-3 text-gray-600 hover:bg-gray-100 rounded-lg transition border border-gray-300"
              title="Attach file"
            >
              <Paperclip size={20} />
            </button>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={(!newMessage.trim() && selectedFiles.length === 0) || sending || uploading}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <Send size={20} />
              )}
            </button>
          </form>
        </div>
      </div>

      {showDeleteConfirm && (
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
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConversation}
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
