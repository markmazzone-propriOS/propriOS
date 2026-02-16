import { useState, useEffect } from 'react';
import { MessageSquare, Send, Clock, AlertCircle, CheckCircle, Loader } from 'lucide-react';

interface Ticket {
  id: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  created_at: string;
  updated_at: string;
  email: string;
}

interface Response {
  id: string;
  message: string;
  created_at: string;
  from: string;
  is_admin: boolean;
}

export default function TicketReplyPage() {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [responses, setResponses] = useState<Response[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [replyToken, setReplyToken] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const [, queryString] = hash.split('?');
    const params = new URLSearchParams(queryString || '');
    const token = params.get('token');

    if (!token) {
      setError('Invalid or missing ticket link. Please check your email for the correct link.');
      setLoading(false);
      return;
    }

    setReplyToken(token);
    loadTicket(token);
  }, []);

  const loadTicket = async (token: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reply-to-ticket?reply_token=${token}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load ticket');
      }

      const data = await response.json();
      setTicket(data.ticket);
      setResponses(data.responses || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ticket');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitResponse = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMessage.trim() || !replyToken) return;

    try {
      setSubmitting(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reply-to-ticket`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reply_token: replyToken,
            message: newMessage.trim(),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit response');
      }

      setNewMessage('');
      setSuccessMessage('Your response has been sent successfully!');

      if (replyToken) {
        await loadTicket(replyToken);
      }

      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit response');
    } finally {
      setSubmitting(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'in_progress': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'resolved': return 'bg-green-100 text-green-800 border-green-200';
      case 'closed': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader className="w-12 h-12 text-red-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading your ticket...</p>
        </div>
      </div>
    );
  }

  if (error && !ticket) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Unable to Load Ticket</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <a
            href="/"
            className="inline-flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors"
          >
            Return to Home
          </a>
        </div>
      </div>
    );
  }

  if (!ticket) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-4xl mx-auto p-4 py-8">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-red-600 to-red-700 p-6 text-white">
            <div className="flex items-center gap-3 mb-2">
              <MessageSquare className="w-8 h-8" />
              <h1 className="text-2xl font-bold">Support Ticket</h1>
            </div>
            <p className="text-red-100 text-sm">Ticket ID: #{ticket.id.slice(0, 8).toUpperCase()}</p>
          </div>

          <div className="p-6">
            {successMessage && (
              <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-green-800 text-sm">{successMessage}</p>
              </div>
            )}

            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(ticket.status)}`}>
                  {ticket.status.replace('_', ' ').toUpperCase()}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getPriorityColor(ticket.priority)}`}>
                  {ticket.priority.toUpperCase()} PRIORITY
                </span>
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-2">{ticket.subject}</h2>

              <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>Created {formatDate(ticket.created_at)}</span>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-sm text-gray-600 font-medium mb-2">Original Message:</p>
                <p className="text-gray-800 whitespace-pre-wrap">{ticket.description}</p>
              </div>
            </div>

            {responses.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversation</h3>
                <div className="space-y-4">
                  {responses.map((response) => (
                    <div
                      key={response.id}
                      className={`rounded-lg p-4 border ${
                        response.is_admin
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-sm font-semibold ${
                          response.is_admin ? 'text-blue-900' : 'text-gray-900'
                        }`}>
                          {response.is_admin ? '🛡️ Proprieta Support' : '👤 You'}
                        </span>
                        <span className="text-xs text-gray-500">{formatDate(response.created_at)}</span>
                      </div>
                      <p className="text-gray-800 whitespace-pre-wrap">{response.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {ticket.status !== 'closed' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Add a Reply</h3>
                <form onSubmit={handleSubmitResponse} className="space-y-4">
                  <div>
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your response here..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 min-h-[120px] resize-none"
                      disabled={submitting}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting || !newMessage.trim()}
                    className="w-full bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 font-semibold"
                  >
                    {submitting ? (
                      <>
                        <Loader className="w-5 h-5 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Send Reply
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            {ticket.status === 'closed' && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">This ticket is closed</h3>
                <p className="text-gray-600 text-sm">
                  If you need further assistance, please submit a new support ticket.
                </p>
                <a
                  href="/support"
                  className="inline-block mt-4 text-red-600 hover:text-red-700 font-medium text-sm"
                >
                  Submit New Ticket →
                </a>
              </div>
            )}
          </div>

          <div className="bg-gray-50 border-t border-gray-200 p-6">
            <p className="text-sm text-gray-600 text-center">
              Need help with something else?{' '}
              <a href="/support" className="text-red-600 hover:text-red-700 font-medium">
                Submit a new ticket
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
