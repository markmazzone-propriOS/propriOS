import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, X, Loader, Sparkles, Trash2, Plus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export function AIAssistant() {
  const { user, profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Only show AI assistant for agents
  if (!user || profile?.user_type !== 'agent') return null;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && user) {
      loadConversations();
      setShowNewChat(false);
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (currentConversationId) {
      loadMessages(currentConversationId);
      setShowNewChat(false);
    }
  }, [currentConversationId]);

  const loadConversations = async () => {
    const { data } = await supabase
      .from('ai_conversations')
      .select('*')
      .order('updated_at', { ascending: false });

    if (data) {
      setConversations(data);
    }
  };

  const loadMessages = async (conversationId: string) => {
    const { data } = await supabase
      .from('ai_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (data) {
      setMessages(data);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;

    const userMessage = message;
    setMessage('');
    setIsLoading(true);

    setMessages(prev => [...prev, {
      id: 'temp-user',
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString()
    }]);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('You must be logged in to use the AI assistant');
      }

      console.log('Session check:', {
        hasSession: !!session,
        hasAccessToken: !!session.access_token,
        tokenLength: session.access_token?.length
      });

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-agent-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
          },
          body: JSON.stringify({
            message: userMessage,
            conversationId: currentConversationId
          })
        }
      );

      const result = await response.json();

      console.log('Response status:', response.status);
      console.log('Response body:', result);

      if (result.needsSetup || (!response.ok && result.error?.includes('model'))) {
        setNeedsSetup(true);
        setMessages(prev => prev.slice(0, -1));
      } else if (result.error) {
        console.error('API Error:', result.error);
        throw new Error(result.error);
      } else {
        if (result.conversationId && !currentConversationId) {
          setCurrentConversationId(result.conversationId);
          await loadConversations();
        }

        setMessages(prev => [
          ...prev.filter(m => m.id !== 'temp-user'),
          {
            id: 'temp-user',
            role: 'user',
            content: userMessage,
            created_at: new Date().toISOString()
          },
          {
            id: 'temp-assistant',
            role: 'assistant',
            content: result.message,
            created_at: new Date().toISOString()
          }
        ]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setMessages(prev => [...prev, {
        id: 'temp-error',
        role: 'assistant',
        content: `Sorry, I encountered an error: ${errorMessage}. Please try again.`,
        created_at: new Date().toISOString()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const startNewConversation = () => {
    setCurrentConversationId(null);
    setMessages([]);
    setNeedsSetup(false);
    setShowNewChat(true);
  };

  const deleteConversation = async (conversationId: string) => {
    if (!confirm('Delete this conversation?')) return;

    await supabase
      .from('ai_conversations')
      .delete()
      .eq('id', conversationId);

    if (currentConversationId === conversationId) {
      startNewConversation();
    }
    await loadConversations();
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all z-50 hover:scale-110"
        title="AI Assistant"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 h-[600px] bg-white rounded-lg shadow-2xl z-50 flex flex-col overflow-hidden border border-gray-200">
          <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                <h3 className="font-semibold">AI Assistant</h3>
              </div>
            </div>
            <button
              onClick={startNewConversation}
              className="w-full bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm font-medium"
              title="Start a new conversation"
            >
              <Plus className="w-4 h-4" />
              New Conversation
            </button>
          </div>

          {needsSetup ? (
            <div className="flex-1 flex items-center justify-center p-6 text-center">
              <div>
                <Sparkles className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h4 className="font-semibold text-gray-900 mb-2">AI Service Not Available</h4>
                <p className="text-sm text-gray-600 mb-4">
                  The AI assistant requires a valid Anthropic API key with access to Claude models.
                </p>
                <p className="text-xs text-gray-500">
                  Please ensure your API key is properly configured and has the necessary permissions.
                </p>
              </div>
            </div>
          ) : (
            <>
              {conversations.length > 0 && !currentConversationId && !showNewChat && (
                <div className="flex-1 overflow-y-auto p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Recent Conversations</h4>
                  <div className="space-y-2 mb-4">
                    {conversations.map(conv => (
                      <div
                        key={conv.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer group"
                        onClick={() => setCurrentConversationId(conv.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {conv.title}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(conv.updated_at).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteConversation(conv.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-red-600 hover:text-red-800 transition-opacity"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="text-center text-sm text-gray-500 mt-4">
                    Click "New Conversation" above to start fresh
                  </div>
                </div>
              )}

              {(currentConversationId || conversations.length === 0 || showNewChat) && (
                <>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-center">
                        <div>
                          <Sparkles className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                          <h4 className="font-semibold text-gray-900 mb-2">How can I help you today?</h4>
                          <p className="text-sm text-gray-600">
                            Ask me about your listings, clients, prospects, appointments, offers, or business analytics.
                          </p>
                        </div>
                      </div>
                    ) : (
                      messages.map((msg, idx) => (
                        <div
                          key={msg.id || idx}
                          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-lg p-3 ${
                              msg.role === 'user'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-900'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          </div>
                        </div>
                      ))
                    )}
                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="bg-gray-100 rounded-lg p-3">
                          <Loader className="w-5 h-5 text-gray-600 animate-spin" />
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  <form onSubmit={sendMessage} className="p-4 border-t border-gray-200">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Ask me anything..."
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isLoading}
                      />
                      <button
                        type="submit"
                        disabled={isLoading || !message.trim()}
                        className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </div>
                  </form>
                </>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
