import { useState, useEffect } from 'react';
import { UserPlus, Edit2, Trash2, Key, Mail, User, Check, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type ManagedAccount = {
  id: string;
  agent_id: string;
  managed_user_id: string;
  account_name: string;
  can_create_listings: boolean;
  can_edit_listings: boolean;
  can_delete_listings: boolean;
  created_at: string;
  profile: {
    full_name: string;
    email: string;
  };
};

export function ManagedAccountsManagement() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<ManagedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ManagedAccount | null>(null);

  useEffect(() => {
    loadManagedAccounts();
  }, [user]);

  const loadManagedAccounts = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('agent_managed_accounts')
        .select(`
          *,
          profile:profiles!agent_managed_accounts_managed_user_id_fkey(
            full_name
          )
        `)
        .eq('agent_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const accountsWithEmails = (data || []).map((account) => ({
        ...account,
        profile: {
          ...account.profile,
          email: '',
        },
      }));

      setAccounts(accountsWithEmails);
    } catch (error) {
      console.error('Error loading managed accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm('Are you sure you want to remove this managed account?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('agent_managed_accounts')
        .delete()
        .eq('id', accountId);

      if (error) throw error;

      setAccounts(accounts.filter((acc) => acc.id !== accountId));
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Failed to delete managed account');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Managed Accounts</h2>
          <p className="text-gray-600 mt-1">
            Create accounts that can manage listings on your behalf
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
        >
          <UserPlus size={20} />
          Create Account
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading accounts...</p>
        </div>
      ) : accounts.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <User size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-800 mb-2">No managed accounts yet</h3>
          <p className="text-gray-600 mb-4">
            Create accounts for team members to help manage your listings
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition"
          >
            Create First Account
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-800">{account.profile.full_name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{account.account_name}</p>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  {account.can_create_listings ? (
                    <Check size={16} className="text-green-600" />
                  ) : (
                    <X size={16} className="text-gray-400" />
                  )}
                  <span className={account.can_create_listings ? 'text-gray-700' : 'text-gray-400'}>
                    Create listings
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {account.can_edit_listings ? (
                    <Check size={16} className="text-green-600" />
                  ) : (
                    <X size={16} className="text-gray-400" />
                  )}
                  <span className={account.can_edit_listings ? 'text-gray-700' : 'text-gray-400'}>
                    Edit listings
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {account.can_delete_listings ? (
                    <Check size={16} className="text-green-600" />
                  ) : (
                    <X size={16} className="text-gray-400" />
                  )}
                  <span className={account.can_delete_listings ? 'text-gray-700' : 'text-gray-400'}>
                    Delete listings
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setEditingAccount(account)}
                  className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-3 py-2 rounded-md hover:bg-gray-200 transition text-sm"
                >
                  <Edit2 size={16} />
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteAccount(account.id)}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-50 text-red-600 px-3 py-2 rounded-md hover:bg-red-100 transition text-sm"
                >
                  <Trash2 size={16} />
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateManagedAccountModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadManagedAccounts();
          }}
        />
      )}

      {editingAccount && (
        <EditManagedAccountModal
          account={editingAccount}
          onClose={() => setEditingAccount(null)}
          onSuccess={() => {
            setEditingAccount(null);
            loadManagedAccounts();
          }}
        />
      )}
    </div>
  );
}

type CreateManagedAccountModalProps = {
  onClose: () => void;
  onSuccess: () => void;
};

function CreateManagedAccountModal({ onClose, onSuccess }: CreateManagedAccountModalProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    accountName: '',
    fullName: '',
    email: '',
    password: '',
    phoneNumber: '',
    canCreate: true,
    canEdit: true,
    canDelete: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError('');

    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            user_type: 'managed_user',
          },
        },
      });

      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error('Failed to create user');

      const newUserId = authData.user.id;

      if (currentSession) {
        await supabase.auth.setSession({
          access_token: currentSession.access_token,
          refresh_token: currentSession.refresh_token,
        });
      }

      const { error: profileError } = await supabase.from('profiles').insert({
        id: newUserId,
        user_type: 'managed_user',
        full_name: formData.fullName,
        phone_number: formData.phoneNumber || null,
        managed_by_agent_id: user.id,
      });

      if (profileError) throw profileError;

      const { error: managedAccountError } = await supabase
        .from('agent_managed_accounts')
        .insert({
          agent_id: user.id,
          managed_user_id: newUserId,
          account_name: formData.accountName,
          can_create_listings: formData.canCreate,
          can_edit_listings: formData.canEdit,
          can_delete_listings: formData.canDelete,
        });

      if (managedAccountError) {
        console.error('Error inserting managed account:', managedAccountError);
        throw new Error(`Failed to create managed account relationship: ${managedAccountError.message}`);
      }

      onSuccess();
    } catch (err: any) {
      console.error('Error creating managed account:', err);
      setError(err.message || 'Failed to create managed account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Create Managed Account</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Account Title
            </label>
            <input
              type="text"
              value={formData.accountName}
              onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
              placeholder="e.g., Marketing Team, Assistant"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              required
              minLength={6}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number (Optional)
            </label>
            <input
              type="tel"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.canCreate}
                onChange={(e) => setFormData({ ...formData, canCreate: e.target.checked })}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Can create listings</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.canEdit}
                onChange={(e) => setFormData({ ...formData, canEdit: e.target.checked })}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Can edit listings</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.canDelete}
                onChange={(e) => setFormData({ ...formData, canDelete: e.target.checked })}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Can delete listings</span>
            </label>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type EditManagedAccountModalProps = {
  account: ManagedAccount;
  onClose: () => void;
  onSuccess: () => void;
};

function EditManagedAccountModal({ account, onClose, onSuccess }: EditManagedAccountModalProps) {
  const [formData, setFormData] = useState({
    accountName: account.account_name,
    canCreate: account.can_create_listings,
    canEdit: account.can_edit_listings,
    canDelete: account.can_delete_listings,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('agent_managed_accounts')
        .update({
          account_name: formData.accountName,
          can_create_listings: formData.canCreate,
          can_edit_listings: formData.canEdit,
          can_delete_listings: formData.canDelete,
        })
        .eq('id', account.id);

      if (updateError) throw updateError;

      onSuccess();
    } catch (err: any) {
      console.error('Error updating managed account:', err);
      setError(err.message || 'Failed to update managed account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Edit Managed Account</h2>
        <p className="text-gray-600 mb-6">{account.profile.full_name}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Account Title
            </label>
            <input
              type="text"
              value={formData.accountName}
              onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.canCreate}
                onChange={(e) => setFormData({ ...formData, canCreate: e.target.checked })}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Can create listings</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.canEdit}
                onChange={(e) => setFormData({ ...formData, canEdit: e.target.checked })}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Can edit listings</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.canDelete}
                onChange={(e) => setFormData({ ...formData, canDelete: e.target.checked })}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Can delete listings</span>
            </label>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Updating...' : 'Update Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
