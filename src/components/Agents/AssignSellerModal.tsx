import { useState, useEffect } from 'react';
import { X, User, Search } from 'lucide-react';
import { supabase, Profile } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type AssignSellerModalProps = {
  propertyId: string;
  propertyAddress: string;
  currentSellerId?: string | null;
  onClose: () => void;
  onAssign: () => void;
};

export function AssignSellerModal({
  propertyId,
  propertyAddress,
  currentSellerId,
  onClose,
  onAssign,
}: AssignSellerModalProps) {
  const { user } = useAuth();
  const [sellers, setSellers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(currentSellerId || null);

  useEffect(() => {
    loadSellers();
  }, [user]);

  const loadSellers = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('assigned_agent_id', user.id)
        .eq('user_type', 'seller')
        .order('full_name');

      if (error) throw error;
      setSellers(data || []);
    } catch (err) {
      console.error('Error loading sellers:', err);
      setError('Failed to load sellers');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedSellerId) {
      setError('Please select a seller');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('properties')
        .update({
          seller_id: selectedSellerId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', propertyId);

      if (updateError) throw updateError;

      onAssign();
      onClose();
    } catch (err: any) {
      console.error('Error assigning seller:', err);
      setError(err.message || 'Failed to assign seller');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnassign = async () => {
    if (!confirm('Are you sure you want to unassign the seller from this property?')) {
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('properties')
        .update({
          seller_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', propertyId);

      if (updateError) throw updateError;

      onAssign();
      onClose();
    } catch (err: any) {
      console.error('Error unassigning seller:', err);
      setError(err.message || 'Failed to unassign seller');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredSellers = sellers.filter(seller =>
    seller.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (seller.phone_number && seller.phone_number.includes(searchTerm))
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Assign Seller</h2>
            <p className="text-sm text-gray-600 mt-1">{propertyAddress}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : sellers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">No sellers assigned to you yet.</p>
              <p className="text-sm text-gray-500 mt-2">
                Invite sellers to join your network first.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Search sellers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredSellers.map((seller) => (
                  <button
                    key={seller.id}
                    onClick={() => setSelectedSellerId(seller.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-md border-2 transition ${
                      selectedSellerId === seller.id
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`rounded-full p-2 ${
                      selectedSellerId === seller.id ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                      <User size={20} className={
                        selectedSellerId === seller.id ? 'text-blue-600' : 'text-gray-600'
                      } />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-gray-800">{seller.full_name}</p>
                      {seller.phone_number && (
                        <p className="text-sm text-gray-600">{seller.phone_number}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="p-6 border-t flex gap-3">
          {currentSellerId && (
            <button
              onClick={handleUnassign}
              disabled={submitting}
              className="flex-1 px-4 py-2 border border-red-600 text-red-600 rounded-md hover:bg-red-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Unassign
            </button>
          )}
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={submitting || !selectedSellerId || sellers.length === 0}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Assigning...' : 'Assign Seller'}
          </button>
        </div>
      </div>
    </div>
  );
}
