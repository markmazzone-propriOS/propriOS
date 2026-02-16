import { useState, useEffect } from 'react';
import { Share2, X, Check, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface DocumentSharingProps {
  documentId: string;
  documentName: string;
  onClose: () => void;
}

interface ShareRecord {
  id: string;
  shared_with: string;
  can_download: boolean;
  shared_at: string;
  expires_at: string | null;
  profile: {
    id: string;
    full_name: string;
    user_type: string;
  };
}

interface AssignedUser {
  id: string;
  full_name: string;
  user_type: string;
}

export function DocumentSharing({ documentId, documentName, onClose }: DocumentSharingProps) {
  const { user, profile } = useAuth();
  const [availableUsers, setAvailableUsers] = useState<AssignedUser[]>([]);
  const [currentShares, setCurrentShares] = useState<ShareRecord[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [canDownload, setCanDownload] = useState(true);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    loadData();
  }, [documentId]);

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
      if (profile?.user_type === 'agent') {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, user_type')
          .eq('assigned_agent_id', user!.id)
          .order('full_name');

        if (error) throw error;
        setAvailableUsers(data || []);
      } else if (profile?.user_type === 'seller') {
        const allUsers: AssignedUser[] = [];

        if (profile.assigned_agent_id) {
          const { data: agent, error: agentError } = await supabase
            .from('profiles')
            .select('id, full_name, user_type')
            .eq('id', profile.assigned_agent_id)
            .maybeSingle();

          if (!agentError && agent) {
            allUsers.push(agent);
          }
        }

        const { data: properties, error: propError } = await supabase
          .from('properties')
          .select('id')
          .eq('seller_id', user!.id);

        if (propError) throw propError;

        if (properties && properties.length > 0) {
          const propertyIds = properties.map(p => p.id);

          const { data: offers, error: offersError } = await supabase
            .from('property_offers')
            .select('buyer_id')
            .in('property_id', propertyIds);

          if (offersError) throw offersError;

          if (offers && offers.length > 0) {
            const buyerIds = [...new Set(offers.map(o => o.buyer_id))];

            const { data: buyers, error: buyersError } = await supabase
              .from('profiles')
              .select('id, full_name, user_type')
              .in('id', buyerIds)
              .order('full_name');

            if (!buyersError && buyers) {
              allUsers.push(...buyers);
            }
          }
        }

        setAvailableUsers(allUsers);
      } else if (profile?.assigned_agent_id) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, user_type')
          .eq('id', profile.assigned_agent_id)
          .maybeSingle();

        if (error) throw error;
        setAvailableUsers(data ? [data] : []);
      }
    } catch (error) {
      console.error('Error loading available users:', error);
    }
  };

  const loadCurrentShares = async () => {
    try {
      const { data, error } = await supabase
        .from('document_shares')
        .select(`
          id,
          shared_with,
          can_download,
          shared_at,
          expires_at,
          profile:profiles!document_shares_shared_with_fkey(id, full_name, user_type)
        `)
        .eq('document_id', documentId);

      if (error) throw error;
      setCurrentShares(data || []);
    } catch (error) {
      console.error('Error loading current shares:', error);
    }
  };

  const handleShare = async () => {
    if (!selectedUser) return;

    setSharing(true);
    try {
      const { error } = await supabase
        .from('document_shares')
        .insert({
          document_id: documentId,
          shared_by: user!.id,
          shared_with: selectedUser,
          can_download: canDownload,
        });

      if (error) throw error;

      setSelectedUser('');
      setCanDownload(true);
      await loadCurrentShares();
    } catch (error: any) {
      console.error('Error sharing document:', error);
      if (error.code === '23505') {
        alert('Document is already shared with this user');
      } else {
        alert('Failed to share document');
      }
    } finally {
      setSharing(false);
    }
  };

  const handleRevokeShare = async (shareId: string) => {
    if (!confirm('Are you sure you want to revoke access to this document?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('document_shares')
        .delete()
        .eq('id', shareId);

      if (error) throw error;
      await loadCurrentShares();
    } catch (error) {
      console.error('Error revoking share:', error);
      alert('Failed to revoke access');
    }
  };

  const handleToggleDownload = async (shareId: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from('document_shares')
        .update({ can_download: !currentValue })
        .eq('id', shareId);

      if (error) throw error;
      await loadCurrentShares();
    } catch (error) {
      console.error('Error updating download permission:', error);
      alert('Failed to update permission');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getUnsharedUsers = () => {
    const sharedUserIds = currentShares.map(s => s.shared_with);
    return availableUsers.filter(u => !sharedUserIds.includes(u.id));
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  const unsharedUsers = getUnsharedUsers();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Share2 className="text-blue-600" size={24} />
            <div>
              <h2 className="text-xl font-bold text-gray-800">Share Document</h2>
              <p className="text-sm text-gray-600">{documentName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        {unsharedUsers.length > 0 ? (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-800 mb-3">Share with:</h3>
            <div className="space-y-3">
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a user...</option>
                {unsharedUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.user_type})
                  </option>
                ))}
              </select>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={canDownload}
                  onChange={(e) => setCanDownload(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Allow download
              </label>

              <button
                onClick={handleShare}
                disabled={!selectedUser || sharing}
                className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
              >
                {sharing ? 'Sharing...' : 'Share Document'}
              </button>
            </div>
          </div>
        ) : (
          availableUsers.length === 0 ? (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
              <p className="text-blue-700">
                {profile?.user_type === 'agent'
                  ? 'No clients assigned to you yet'
                  : 'You are not assigned to an agent'}
              </p>
            </div>
          ) : (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
              <p className="text-blue-700">Document is shared with all available users</p>
            </div>
          )
        )}

        {currentShares.length > 0 ? (
          <div>
            <h3 className="font-semibold text-gray-800 mb-3">Shared with:</h3>
            <div className="space-y-2">
              {currentShares.map((share) => (
                <div
                  key={share.id}
                  className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-md"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{share.profile.full_name}</p>
                    <p className="text-sm text-gray-600 capitalize">{share.profile.user_type}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Shared on {formatDate(share.shared_at)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleDownload(share.id, share.can_download)}
                      className={`p-2 rounded transition ${
                        share.can_download
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                      title={share.can_download ? 'Can download' : 'View only'}
                    >
                      <Download size={18} />
                    </button>
                    <button
                      onClick={() => handleRevokeShare(share.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded transition"
                      title="Revoke access"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-600">
            <p>This document is not shared with anyone yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
