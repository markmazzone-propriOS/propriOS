import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Wrench, AlertCircle, CheckCircle, Clock, User, Home, Calendar } from 'lucide-react';

interface MaintenanceRequest {
  id: string;
  rental_agreement_id: string | null;
  property_id: string;
  requester_id: string | null;
  title: string;
  description: string;
  priority: string;
  status: string;
  category: string;
  requested_at: string;
  started_at: string | null;
  completed_at: string | null;
  property: {
    address_line1: string;
    city: string;
  };
  requester: {
    full_name: string;
    phone_number: string;
  } | null;
}

interface MaintenanceRequestsProps {
  onUpdate: () => void;
}

export default function MaintenanceRequests({ onUpdate }: MaintenanceRequestsProps) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');

  useEffect(() => {
    if (user) {
      fetchRequests();
    }
  }, [user]);

  const fetchRequests = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('maintenance_requests')
        .select(`
          *,
          property:properties!maintenance_requests_property_id_fkey(
            address_line1,
            city,
            listed_by
          ),
          requester:profiles!maintenance_requests_requester_id_fkey(
            full_name,
            phone_number
          )
        `)
        .order('requested_at', { ascending: false });

      if (error) throw error;

      const ownerRequests = (data as any[])?.filter(
        (req) => req.property?.listed_by === user.id
      ) || [];

      setRequests(ownerRequests);
    } catch (error) {
      console.error('Error fetching maintenance requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (requestId: string, newStatus: string) => {
    try {
      const updates: any = { status: newStatus };

      if (newStatus === 'in_progress' && !requests.find(r => r.id === requestId)?.started_at) {
        updates.started_at = new Date().toISOString();
      } else if (newStatus === 'completed') {
        updates.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('maintenance_requests')
        .update(updates)
        .eq('id', requestId);

      if (error) throw error;

      fetchRequests();
      onUpdate();
    } catch (error: any) {
      console.error('Error updating request:', error);
      alert('Failed to update request: ' + error.message);
    }
  };

  const getPriorityBadge = (priority: string) => {
    const badges = {
      low: { color: 'bg-gray-100 text-gray-800', icon: Clock },
      medium: { color: 'bg-blue-100 text-blue-800', icon: AlertCircle },
      high: { color: 'bg-orange-100 text-orange-800', icon: AlertCircle },
      urgent: { color: 'bg-red-100 text-red-800', icon: AlertCircle },
    };

    const badge = badges[priority as keyof typeof badges] || badges.medium;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      in_progress: { color: 'bg-blue-100 text-blue-800', icon: Wrench },
      completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      cancelled: { color: 'bg-gray-100 text-gray-800', icon: Clock },
    };

    const badge = badges[status as keyof typeof badges] || badges.pending;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {status.replace('_', ' ').charAt(0).toUpperCase() + status.replace('_', ' ').slice(1)}
      </span>
    );
  };

  const getFilteredRequests = () => {
    if (filter === 'all') return requests;
    return requests.filter(r => r.status === filter);
  };

  const filteredRequests = getFilteredRequests();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Maintenance Requests</h2>
        <p className="text-gray-600 mt-1">Manage maintenance requests for your properties</p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All ({requests.length})
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'pending'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Pending ({requests.filter(r => r.status === 'pending').length})
        </button>
        <button
          onClick={() => setFilter('in_progress')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'in_progress'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          In Progress ({requests.filter(r => r.status === 'in_progress').length})
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'completed'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Completed ({requests.filter(r => r.status === 'completed').length})
        </button>
      </div>

      {filteredRequests.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Wrench className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Maintenance Requests</h3>
          <p className="text-gray-600">
            {filter !== 'all'
              ? `No ${filter.replace('_', ' ')} requests`
              : 'All maintenance requests will appear here'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((request) => (
            <div
              key={request.id}
              className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{request.title}</h3>
                    {getPriorityBadge(request.priority)}
                    {getStatusBadge(request.status)}
                  </div>
                  {request.description && (
                    <p className="text-gray-700 mb-3">{request.description}</p>
                  )}
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <Home className="w-4 h-4" />
                      {request.property?.address_line1}, {request.property?.city}
                    </span>
                    {request.requester && (
                      <span className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {request.requester.full_name}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {new Date(request.requested_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {request.category && (
                <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
                  <span className="text-sm text-gray-600">Category:</span>
                  <span className="text-sm font-medium text-gray-900 capitalize">
                    {request.category.replace('_', ' ')}
                  </span>
                </div>
              )}

              {request.status !== 'completed' && request.status !== 'cancelled' && (
                <div className="flex gap-2 mt-4">
                  {request.status === 'pending' && (
                    <button
                      onClick={() => handleStatusUpdate(request.id, 'in_progress')}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Start Work
                    </button>
                  )}
                  {request.status === 'in_progress' && (
                    <button
                      onClick={() => handleStatusUpdate(request.id, 'completed')}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Mark as Completed
                    </button>
                  )}
                  <button
                    onClick={() => handleStatusUpdate(request.id, 'cancelled')}
                    className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {request.completed_at && (
                <div className="mt-4 bg-green-50 rounded-lg p-3">
                  <p className="text-sm text-green-800">
                    Completed on {new Date(request.completed_at).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
