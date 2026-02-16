import { useState, useEffect } from 'react';
import { X, Share2, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface ShareCalendarEventModalProps {
  eventId: string;
  eventTitle: string;
  onClose: () => void;
}

interface AssignedUser {
  id: string;
  full_name: string;
  user_type: string;
}

interface ShareRecord {
  id: string;
  shared_with: string;
  can_edit: boolean;
  profile: {
    id: string;
    full_name: string;
    user_type: string;
  };
}

export function ShareCalendarEventModal({ eventId, eventTitle, onClose }: ShareCalendarEventModalProps) {
  const { user } = useAuth();
  const [availableUsers, setAvailableUsers] = useState<AssignedUser[]>([]);
  const [currentShares, setCurrentShares] = useState<ShareRecord[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    loadData();
  }, [eventId]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadAvailableUsers(), loadCurrentShares()]);
    } catch (error) {
      console.error('Error loading sharing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, user_type')
        .eq('assigned_agent_id', user!.id)
        .order('full_name');

      if (error) throw error;
      setAvailableUsers(data || []);
    } catch (error) {
      console.error('Error loading available users:', error);
    }
  };

  const loadCurrentShares = async () => {
    try {
      const { data, error } = await supabase
        .from('calendar_event_shares')
        .select(`
          id,
          shared_with,
          can_edit,
          profile:profiles!calendar_event_shares_shared_with_fkey(id, full_name, user_type)
        `)
        .eq('event_id', eventId);

      if (error) throw error;
      setCurrentShares(data || []);
    } catch (error) {
      console.error('Error loading current shares:', error);
    }
  };

  const handleShare = async () => {
    if (!selectedUser || sharing) return;

    setSharing(true);
    try {
      const { error } = await supabase
        .from('calendar_event_shares')
        .insert({
          event_id: eventId,
          shared_by: user!.id,
          shared_with: selectedUser,
          can_edit: canEdit,
        });

      if (error) throw error;

      setSelectedUser('');
      setCanEdit(false);
      await loadCurrentShares();
    } catch (error) {
      console.error('Error sharing event:', error);
      alert('Failed to share event');
    } finally {
      setSharing(false);
    }
  };

  const handleRevoke = async (shareId: string) => {
    try {
      const { error } = await supabase
        .from('calendar_event_shares')
        .delete()
        .eq('id', shareId);

      if (error) throw error;
      await loadCurrentShares();
    } catch (error) {
      console.error('Error revoking share:', error);
      alert('Failed to revoke access');
    }
  };

  const availableToShare = availableUsers.filter(
    (u) => !currentShares.some((s) => s.shared_with === u.id)
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Share2 size={24} className="text-blue-600" />
            Share Calendar Event
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-900 mb-1">Event</p>
            <p className="text-sm text-blue-800">{eventTitle}</p>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : (
            <>
              <div>
                <h3 className="font-semibold text-gray-800 mb-3">Share with Client</h3>

                {availableToShare.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">
                    {availableUsers.length === 0
                      ? 'No assigned clients to share with'
                      : 'All assigned clients already have access'}
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Select Client
                      </label>
                      <select
                        value={selectedUser}
                        onChange={(e) => setSelectedUser(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Choose a client...</option>
                        {availableToShare.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.full_name} ({u.user_type})
                          </option>
                        ))}
                      </select>
                    </div>

                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={canEdit}
                        onChange={(e) => setCanEdit(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700">Allow editing</span>
                    </label>

                    <button
                      onClick={handleShare}
                      disabled={!selectedUser || sharing}
                      className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Share2 size={18} />
                      {sharing ? 'Sharing...' : 'Share Event'}
                    </button>
                  </div>
                )}
              </div>

              {currentShares.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-800 mb-3">Currently Shared With</h3>
                  <div className="space-y-2">
                    {currentShares.map((share) => (
                      <div
                        key={share.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-800">
                            {share.profile.full_name}
                          </p>
                          <p className="text-sm text-gray-600">
                            {share.profile.user_type}
                            {share.can_edit && ' • Can edit'}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRevoke(share.id)}
                          className="text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                          Revoke
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
