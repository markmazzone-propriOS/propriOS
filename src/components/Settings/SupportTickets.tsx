import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Plus,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Send,
  Hash
} from 'lucide-react';

interface Ticket {
  id: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'technical' | 'login' | 'billing' | 'sales_inquiry' | 'feature_request' | 'other';
  created_at: string;
  updated_at: string;
}

interface TicketResponse {
  id: string;
  ticket_id: string;
  user_id: string;
  message: string;
  created_at: string;
  is_internal_note: boolean;
  users: {
    email: string;
  };
}

export default function SupportTickets() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [responses, setResponses] = useState<TicketResponse[]>([]);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [loading, setLoading] = useState(true);

  const [newTicket, setNewTicket] = useState({
    subject: '',
    description: '',
    priority: 'medium' as const,
    category: 'technical' as const
  });

  const [newResponse, setNewResponse] = useState('');

  useEffect(() => {
    if (user) {
      loadTickets();
    }
  }, [user]);

  useEffect(() => {
    if (selectedTicket) {
      loadResponses(selectedTicket.id);
    }
  }, [selectedTicket]);

  const loadTickets = async () => {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error('Error loading tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadResponses = async (ticketId: string) => {
    try {
      const { data, error } = await supabase
        .from('support_ticket_responses')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Get user emails for responses using the RPC function
      const responsesWithUsers = await Promise.all((data || []).map(async (response) => {
        const { data: email } = await supabase.rpc('get_user_email', { user_id: response.user_id });
        return {
          ...response,
          users: { email: email || 'Unknown User' }
        };
      }));

      setResponses(responsesWithUsers);
    } catch (error) {
      console.error('Error loading responses:', error);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await supabase
        .from('support_tickets')
        .insert([{
          user_id: user?.id,
          subject: newTicket.subject,
          description: newTicket.description,
          priority: newTicket.priority,
          category: newTicket.category
        }]);

      if (error) throw error;

      setNewTicket({
        subject: '',
        description: '',
        priority: 'medium',
        category: 'technical'
      });
      setShowNewTicket(false);
      loadTickets();
    } catch (error) {
      console.error('Error creating ticket:', error);
      alert('Failed to create ticket. Please try again.');
    }
  };

  const handleAddResponse = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newResponse.trim() || !selectedTicket) return;

    try {
      const { error } = await supabase
        .from('support_ticket_responses')
        .insert([{
          ticket_id: selectedTicket.id,
          user_id: user?.id,
          message: newResponse
        }]);

      if (error) throw error;

      setNewResponse('');
      loadResponses(selectedTicket.id);
      loadTickets();
    } catch (error) {
      console.error('Error adding response:', error);
      alert('Failed to add response. Please try again.');
    }
  };

  const formatTicketId = (id: string) => {
    return `#${id.slice(0, 8).toUpperCase()}`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <AlertCircle className="w-5 h-5 text-blue-500" />;
      case 'in_progress':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'resolved':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'closed':
        return <XCircle className="w-5 h-5 text-gray-500" />;
      default:
        return null;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Support Tickets</h2>
          <p className="text-gray-600 mt-1">Submit and track your support requests</p>
        </div>
        <button
          onClick={() => setShowNewTicket(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          New Ticket
        </button>
      </div>

      {showNewTicket && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold mb-4">Create New Ticket</h3>
          <form onSubmit={handleCreateTicket} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subject
              </label>
              <input
                type="text"
                value={newTicket.subject}
                onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={newTicket.description}
                onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                rows={4}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={newTicket.category}
                  onChange={(e) => setNewTicket({ ...newTicket, category: e.target.value as any })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="technical">Technical Issue</option>
                  <option value="login">Login Problem</option>
                  <option value="billing">Billing</option>
                  <option value="sales_inquiry">Sales Inquiry</option>
                  <option value="feature_request">Feature Request</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  value={newTicket.priority}
                  onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value as any })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
              >
                Submit Ticket
              </button>
              <button
                type="button"
                onClick={() => setShowNewTicket(false)}
                className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {selectedTicket ? (
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-6 border-b">
            <button
              onClick={() => setSelectedTicket(null)}
              className="text-blue-600 hover:text-blue-700 mb-4"
            >
              ← Back to tickets
            </button>

            <div className="bg-blue-50 border-l-4 border-blue-600 p-4 mb-4 rounded">
              <div className="flex items-center gap-2">
                <Hash className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-600">Your Ticket ID:</span>
                <span className="text-lg font-bold text-blue-900 font-mono">{formatTicketId(selectedTicket.id)}</span>
                <span className="text-xs text-blue-600 ml-2">(Reference this ID in communications)</span>
              </div>
            </div>

            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-xl font-semibold">{selectedTicket.subject}</h3>
                <p className="text-gray-600 mt-2">{selectedTicket.description}</p>
              </div>
              <div className="flex items-center gap-3">
                {getStatusIcon(selectedTicket.status)}
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPriorityColor(selectedTicket.priority)}`}>
                  {selectedTicket.priority.toUpperCase()}
                </span>
              </div>
            </div>
            <div className="mt-4 flex gap-4 text-sm text-gray-600">
              <span>Status: <span className="font-medium">{selectedTicket.status.replace('_', ' ')}</span></span>
              <span>Category: <span className="font-medium">{selectedTicket.category.replace('_', ' ')}</span></span>
              <span>Created: <span className="font-medium">{new Date(selectedTicket.created_at).toLocaleDateString()}</span></span>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <h4 className="font-semibold text-gray-900">Responses</h4>
            {responses.length > 0 ? (
              <div className="space-y-4">
                {responses.map((response) => (
                  <div
                    key={response.id}
                    className={`p-4 rounded-lg ${
                      response.user_id === user?.id ? 'bg-blue-50 ml-8' : 'bg-gray-50 mr-8'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">
                        {response.user_id === user?.id ? 'You' : 'Support Team'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(response.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-gray-700">{response.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No responses yet</p>
            )}

            {selectedTicket.status !== 'closed' && (
              <form onSubmit={handleAddResponse} className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Add Response
                </label>
                <div className="flex gap-2">
                  <textarea
                    value={newResponse}
                    onChange={(e) => setNewResponse(e.target.value)}
                    rows={3}
                    className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Type your message..."
                    required
                  />
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Send
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md">
          {tickets.length > 0 ? (
            <div className="divide-y">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => setSelectedTicket(ticket)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getStatusIcon(ticket.status)}
                        <h3 className="font-semibold text-gray-900">{ticket.subject}</h3>
                        <span className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs font-mono text-gray-700">
                          <Hash className="w-3 h-3" />
                          {formatTicketId(ticket.id)}
                        </span>
                      </div>
                      <p className="text-gray-600 text-sm line-clamp-2">{ticket.description}</p>
                      <div className="flex gap-4 mt-3 text-xs text-gray-500">
                        <span>Status: {ticket.status.replace('_', ' ')}</span>
                        <span>Category: {ticket.category.replace('_', ' ')}</span>
                        <span>Updated: {new Date(ticket.updated_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPriorityColor(ticket.priority)}`}>
                      {ticket.priority.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No support tickets yet</p>
              <p className="text-sm text-gray-500 mt-2">Click "New Ticket" to create your first support request</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}