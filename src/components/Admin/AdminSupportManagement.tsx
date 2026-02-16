import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from '../Navigation/Router';
import {
  MessageSquare,
  CheckCircle,
  Clock,
  Send,
  Filter,
  User,
  Calendar,
  ArrowLeft,
  Trash2,
  BarChart3,
  Search,
  Hash
} from 'lucide-react';

interface Ticket {
  id: string;
  user_id: string | null;
  email: string | null;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'technical' | 'login' | 'billing' | 'feature_request' | 'sales_inquiry' | 'other';
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  users: {
    email: string;
  } | null;
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

interface AdminUser {
  id: string;
  email: string;
}

export default function AdminSupportManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [responses, setResponses] = useState<TicketResponse[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [searchTicketId, setSearchTicketId] = useState<string>('');

  const [newResponse, setNewResponse] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);

  useEffect(() => {
    if (user) {
      loadTickets();
      loadAdmins();
    }
  }, [user, filterStatus, filterPriority, searchTicketId]);

  useEffect(() => {
    if (selectedTicket) {
      loadResponses(selectedTicket.id);
    }
  }, [selectedTicket]);

  const loadTickets = async () => {
    try {
      let query = supabase
        .from('support_tickets')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      if (filterPriority !== 'all') {
        query = query.eq('priority', filterPriority);
      }

      if (searchTicketId.trim()) {
        query = query.or(`id.ilike.%${searchTicketId.trim()}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Get user emails using the database function
      const ticketsWithUsers = await Promise.all((data || []).map(async (ticket) => {
        const { data: userInfo } = await supabase.rpc('admin_get_ticket_user_info', {
          ticket_user_id: ticket.user_id,
          ticket_description: ticket.description,
          ticket_email: ticket.email
        });

        return {
          ...ticket,
          users: userInfo || { email: 'Unknown' }
        };
      }));

      setTickets(ticketsWithUsers);
    } catch (error) {
      console.error('Error loading tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAdmins = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('id')
        .order('created_at');

      if (error) throw error;

      const adminIds = data?.map(a => a.id) || [];

      if (adminIds.length > 0) {
        const adminUsers = await Promise.all(
          adminIds.map(async (id) => {
            const { data: email } = await supabase.rpc('get_user_email', { user_id: id });
            return email ? { id, email } : null;
          })
        );

        setAdmins(adminUsers.filter(a => a !== null) as AdminUser[]);
      }
    } catch (error) {
      console.error('Error loading admins:', error);
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

      // Get user emails for responses
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

  const handleUpdateStatus = async (ticketId: string, status: string) => {
    try {
      const updates: any = { status };

      if (status === 'resolved' || status === 'closed') {
        updates.resolved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('support_tickets')
        .update(updates)
        .eq('id', ticketId);

      if (error) throw error;

      loadTickets();
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, status: status as any });
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status. Please try again.');
    }
  };

  const handleAssignTicket = async (ticketId: string, adminId: string | null) => {
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ assigned_to: adminId })
        .eq('id', ticketId);

      if (error) throw error;

      loadTickets();
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, assigned_to: adminId });
      }
    } catch (error) {
      console.error('Error assigning ticket:', error);
      alert('Failed to assign ticket. Please try again.');
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
          message: newResponse,
          is_internal_note: isInternalNote
        }]);

      if (error) throw error;

      setNewResponse('');
      setIsInternalNote(false);
      loadResponses(selectedTicket.id);
      loadTickets();
    } catch (error) {
      console.error('Error adding response:', error);
      alert('Failed to add response. Please try again.');
    }
  };

  const handleDeleteTicket = async (ticketId: string) => {
    if (!confirm('Are you sure you want to delete this support ticket? It will be removed from the active list but preserved for analytics.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user?.id
        })
        .eq('id', ticketId);

      if (error) {
        console.error('Delete error:', error);
        alert(`Failed to delete ticket: ${error.message}`);
        return;
      }

      alert('Support ticket deleted successfully.');
      setSelectedTicket(null);
      await loadTickets();
    } catch (error: any) {
      console.error('Error deleting ticket:', error);
      alert(`Failed to delete ticket: ${error?.message || 'Unknown error'}`);
    }
  };

  const formatTicketId = (id: string) => {
    return `#${id.slice(0, 8).toUpperCase()}`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return null;
      case 'in_progress':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'resolved':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'closed':
        return null;
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

  const getTicketStats = () => {
    return {
      open: tickets.filter(t => t.status === 'open').length,
      in_progress: tickets.filter(t => t.status === 'in_progress').length,
      resolved: tickets.filter(t => t.status === 'resolved').length,
      closed: tickets.filter(t => t.status === 'closed').length
    };
  };

  const stats = getTicketStats();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Admin Dashboard</span>
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Support Ticket Management</h2>
            <p className="text-gray-600 mt-1">View and respond to user support requests</p>
          </div>
          <button
            onClick={() => navigate('/admin/support/analytics')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <BarChart3 className="w-5 h-5" />
            View Analytics
          </button>
        </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 font-medium">Open</p>
              <p className="text-2xl font-bold text-blue-900">{stats.open}</p>
            </div>
          </div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-600 font-medium">In Progress</p>
              <p className="text-2xl font-bold text-yellow-900">{stats.in_progress}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 font-medium">Resolved</p>
              <p className="text-2xl font-bold text-green-900">{stats.resolved}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Closed</p>
              <p className="text-2xl font-bold text-gray-900">{stats.closed}</p>
            </div>
          </div>
        </div>
      </div>

      {!selectedTicket && (
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex gap-4 items-center flex-wrap">
            <Filter className="w-5 h-5 text-gray-500" />

            <div className="relative flex-1 min-w-[280px]">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                value={searchTicketId}
                onChange={(e) => setSearchTicketId(e.target.value)}
                placeholder="Search by Ticket ID (e.g., #A1B2C3D4)"
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>

            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            {(searchTicketId || filterStatus !== 'all' || filterPriority !== 'all') && (
              <button
                onClick={() => {
                  setSearchTicketId('');
                  setFilterStatus('all');
                  setFilterPriority('all');
                }}
                className="text-sm text-red-600 hover:text-red-700 font-medium"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      )}

      {selectedTicket ? (
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setSelectedTicket(null)}
                className="text-blue-600 hover:text-blue-700"
              >
                ← Back to tickets
              </button>
              <button
                onClick={() => handleDeleteTicket(selectedTicket.id)}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                <Trash2 className="w-4 h-4" />
                Delete Ticket
              </button>
            </div>

            <div className="bg-blue-50 border-l-4 border-blue-600 p-4 mb-4 rounded">
              <div className="flex items-center gap-2">
                <Hash className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-600">Ticket ID:</span>
                <span className="text-lg font-bold text-blue-900 font-mono">{formatTicketId(selectedTicket.id)}</span>
              </div>
            </div>

            <div className="flex items-start justify-between mb-4">
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

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={selectedTicket.status}
                  onChange={(e) => handleUpdateStatus(selectedTicket.id, e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assign To
                </label>
                <select
                  value={selectedTicket.assigned_to || ''}
                  onChange={(e) => handleAssignTicket(selectedTicket.id, e.target.value || null)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Unassigned</option>
                  {admins.map((admin) => (
                    <option key={admin.id} value={admin.id}>
                      {admin.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 flex gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <User className="w-4 h-4" />
                {selectedTicket.users?.email || 'Guest User'}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Created: {new Date(selectedTicket.created_at).toLocaleString()}
              </span>
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
                      response.is_internal_note
                        ? 'bg-yellow-50 border-l-4 border-yellow-400'
                        : response.user_id === selectedTicket.user_id
                        ? 'bg-blue-50 ml-8'
                        : 'bg-gray-50 mr-8'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">
                        {response.is_internal_note && '🔒 Internal Note - '}
                        {response.users.email}
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

            <form onSubmit={handleAddResponse} className="mt-6 space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Add Response
              </label>
              <textarea
                value={newResponse}
                onChange={(e) => setNewResponse(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Type your response..."
                required
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isInternalNote}
                    onChange={(e) => setIsInternalNote(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Internal note (not visible to user)</span>
                </label>
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Send
                </button>
              </div>
            </form>
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
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {ticket.users?.email || 'Guest User'}
                        </span>
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
              <p className="text-gray-600">No support tickets found</p>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}