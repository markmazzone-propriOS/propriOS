import { useState, useEffect } from 'react';
import { Search, Ban, Trash2, CheckCircle, XCircle, User, ArrowLeft } from 'lucide-react';
import { supabase, Profile } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from '../Navigation/Router';

type UserWithDetails = Profile & {
  agent_profile?: { license_number: string };
  lender_profile?: { company_name: string };
  provider_profile?: { business_name: string };
  properties_count?: number;
  email?: string;
  created_at?: string;
  is_admin?: boolean;
};

export function AdminAccountsManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserWithDetails[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<UserWithDetails | null>(null);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    checkAdminAccess();
  }, [user]);

  useEffect(() => {
    filterUsers();
  }, [searchTerm, filterType, users]);

  const checkAdminAccess = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        navigate('/dashboard');
        return;
      }

      loadUsers();
    } catch (error) {
      console.error('Error checking admin access:', error);
      navigate('/dashboard');
    }
  };

  const loadUsers = async () => {
    try {
      const { data: usersWithEmails, error: usersError } = await supabase
        .rpc('admin_get_users_with_emails');

      if (usersError) throw usersError;

      const usersWithDetails = await Promise.all(
        (usersWithEmails || []).map(async (user: any) => {
          const [agentData, lenderData, providerData, propertiesCount, adminData] = await Promise.all([
            supabase
              .from('agent_profiles')
              .select('license_number')
              .eq('id', user.id)
              .maybeSingle(),
            supabase
              .from('mortgage_lender_profiles')
              .select('company_name')
              .eq('id', user.id)
              .maybeSingle(),
            supabase
              .from('service_provider_profiles')
              .select('business_name')
              .eq('id', user.id)
              .maybeSingle(),
            supabase
              .from('properties')
              .select('*', { count: 'exact', head: true })
              .eq('listed_by', user.id),
            supabase
              .from('admin_users')
              .select('id')
              .eq('id', user.id)
              .maybeSingle()
          ]);

          return {
            ...user,
            agent_profile: agentData.data,
            lender_profile: lenderData.data,
            provider_profile: providerData.data,
            properties_count: propertiesCount.count || 0,
            is_admin: !!adminData.data
          };
        })
      );

      setUsers(usersWithDetails);
      setFilteredUsers(usersWithDetails);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = users;

    if (filterType !== 'all') {
      if (filterType === 'suspended') {
        filtered = filtered.filter((u) => u.is_suspended);
      } else {
        filtered = filtered.filter((u) => u.user_type === filterType);
      }
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.full_name.toLowerCase().includes(term) ||
          u.user_type.toLowerCase().includes(term) ||
          (u.phone_number && u.phone_number.toLowerCase().includes(term)) ||
          (u.email && u.email.toLowerCase().includes(term))
      );
    }

    setFilteredUsers(filtered);
  };

  const handleSuspendUser = async () => {
    if (!selectedUser || !suspensionReason.trim()) return;

    setActionLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          is_suspended: !selectedUser.is_suspended,
          suspended_at: selectedUser.is_suspended ? null : new Date().toISOString(),
          suspension_reason: selectedUser.is_suspended ? null : suspensionReason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedUser.id);

      if (updateError) throw updateError;

      await supabase.from('admin_audit_log').insert({
        admin_id: user!.id,
        action_type: selectedUser.is_suspended ? 'unsuspend_user' : 'suspend_user',
        target_type: 'profile',
        target_id: selectedUser.id,
        details: { reason: suspensionReason, user_type: selectedUser.user_type },
      });

      await loadUsers();
      setShowSuspendModal(false);
      setSelectedUser(null);
      setSuspensionReason('');
    } catch (error: any) {
      console.error('Error suspending user:', error);
      alert(error.message || 'Failed to update user suspension status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    setActionLoading(true);
    try {
      // Log the action first
      await supabase.from('admin_audit_log').insert({
        admin_id: user!.id,
        action_type: 'delete_user',
        target_type: 'profile',
        target_id: selectedUser.id,
        details: { user_type: selectedUser.user_type, full_name: selectedUser.full_name },
      });

      // Use the admin delete function which handles auth.users deletion
      const { error: deleteError } = await supabase.rpc('admin_delete_user', {
        target_user_id: selectedUser.id
      });

      if (deleteError) throw deleteError;

      await loadUsers();
      setShowDeleteModal(false);
      setSelectedUser(null);
    } catch (error: any) {
      console.error('Error deleting user:', error);
      alert(error.message || 'Failed to delete user');
    } finally {
      setActionLoading(false);
    }
  };

  const getUserLabel = (user: UserWithDetails) => {
    if (user.agent_profile) return `License: ${user.agent_profile.license_number}`;
    if (user.lender_profile) return user.lender_profile.company_name;
    if (user.provider_profile) return user.provider_profile.business_name;
    return '';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-4"
          >
            <ArrowLeft size={20} />
            Back to Admin Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-800">Account Management</h1>
          <p className="text-gray-600 mt-2">View, suspend, and manage user accounts</p>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search by name, email, phone, or type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Users</option>
              <option value="buyer">Buyers</option>
              <option value="seller">Sellers</option>
              <option value="agent">Agents</option>
              <option value="service_provider">Service Providers</option>
              <option value="mortgage_lender">Mortgage Lenders</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Signup Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Listings
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((u) => (
                <tr key={u.id} className={u.is_suspended ? 'bg-red-50' : ''}>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                        <User size={20} className="text-gray-500" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{u.full_name}</div>
                        <div className="text-sm text-gray-500">{u.email || 'No email'}</div>
                        <div className="text-xs text-gray-400">{u.phone_number || 'No phone'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {u.is_admin ? (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                        Admin
                      </span>
                    ) : (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                        User
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {u.user_type}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-500 max-w-[200px] truncate" title={getUserLabel(u)}>
                    {getUserLabel(u)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    {u.created_at ? (
                      <>
                        <div>{new Date(u.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}</div>
                        <div className="text-xs text-gray-400">
                          {new Date(u.created_at).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </div>
                      </>
                    ) : (
                      'N/A'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {u.is_suspended ? (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                        Suspended
                      </span>
                    ) : (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                    {u.properties_count || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-4">
                      <button
                        onClick={() => {
                          setSelectedUser(u);
                          setShowSuspendModal(true);
                        }}
                        className={`${
                          u.is_suspended ? 'text-green-600 hover:text-green-900' : 'text-orange-600 hover:text-orange-900'
                        }`}
                        title={u.is_suspended ? 'Unsuspend' : 'Suspend'}
                      >
                        {u.is_suspended ? <CheckCircle size={20} /> : <Ban size={20} />}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedUser(u);
                          setShowDeleteModal(true);
                        }}
                        className="text-red-600 hover:text-red-900"
                        title="Delete"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No users found matching your criteria
            </div>
          )}
        </div>
      </div>

      {showSuspendModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              {selectedUser.is_suspended ? 'Unsuspend Account' : 'Suspend Account'}
            </h3>
            <p className="text-gray-700 mb-4">
              {selectedUser.is_suspended
                ? `Are you sure you want to unsuspend ${selectedUser.full_name}?`
                : `Are you sure you want to suspend ${selectedUser.full_name}?`}
            </p>
            {!selectedUser.is_suspended && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Suspension Reason *
                </label>
                <textarea
                  value={suspensionReason}
                  onChange={(e) => setSuspensionReason(e.target.value)}
                  rows={3}
                  placeholder="Enter reason for suspension..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowSuspendModal(false);
                  setSelectedUser(null);
                  setSuspensionReason('');
                }}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSuspendUser}
                disabled={actionLoading || (!selectedUser.is_suspended && !suspensionReason.trim())}
                className={`flex-1 px-4 py-2 rounded-md transition disabled:opacity-50 font-medium ${
                  selectedUser.is_suspended
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-orange-600 hover:bg-orange-700 text-white'
                }`}
              >
                {actionLoading ? 'Processing...' : selectedUser.is_suspended ? 'Unsuspend' : 'Suspend'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Delete Account</h3>
            <p className="text-gray-700 mb-4">
              Are you sure you want to permanently delete {selectedUser.full_name}'s account? This action cannot be undone.
            </p>
            <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
              <p className="text-sm text-red-800">
                <strong>Warning:</strong> This will also delete all associated data including listings, messages, and documents.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedUser(null);
                }}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={actionLoading}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition disabled:opacity-50 font-medium"
              >
                {actionLoading ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
