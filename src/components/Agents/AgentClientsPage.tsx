import { useState, useEffect } from 'react';
import { Users, User, MessageSquare, TrendingUp, X } from 'lucide-react';
import { supabase, Profile } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from '../Navigation/Router';
import { UpdateSellerProgress } from './UpdateSellerProgress';
import { UpdateBuyerProgress } from './UpdateBuyerProgress';

export function AgentClientsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [buyers, setBuyers] = useState<Profile[]>([]);
  const [sellers, setSellers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSellerProgressModal, setShowSellerProgressModal] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState<{ id: string; name: string } | null>(null);
  const [showBuyerProgressModal, setShowBuyerProgressModal] = useState(false);
  const [selectedBuyer, setSelectedBuyer] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (user) {
      loadClients();
    }
  }, [user]);

  const loadClients = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('assigned_agent_id', user!.id);

      if (error) throw error;

      const buyerList = data.filter((p) => p.user_type === 'buyer' || p.user_type === 'renter');
      const sellerList = data.filter((p) => p.user_type === 'seller');

      setBuyers(buyerList);
      setSellers(sellerList);
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnassignSeller = async (sellerId: string, sellerName: string) => {
    try {
      const { error: propertiesError } = await supabase
        .from('properties')
        .update({ agent_id: null, updated_at: new Date().toISOString() })
        .eq('seller_id', sellerId)
        .eq('agent_id', user!.id);

      if (propertiesError) throw propertiesError;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ assigned_agent: null })
        .eq('id', sellerId);

      if (profileError) throw profileError;

      await loadClients();
      alert(`Successfully unassigned ${sellerName}.`);
    } catch (error: any) {
      console.error('Error unassigning seller:', error);
      alert(error.message || 'Failed to unassign seller');
    }
  };

  const handleUnassignBuyer = async (buyerId: string, buyerName: string) => {
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ assigned_agent: null })
        .eq('id', buyerId);

      if (profileError) throw profileError;

      await loadClients();
      alert(`Successfully unassigned ${buyerName}.`);
    } catch (error: any) {
      console.error('Error unassigning buyer:', error);
      alert(error.message || 'Failed to unassign buyer');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-white shadow-sm border-b mb-8">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">My Clients</h1>
          <p className="text-gray-600">
            {buyers.length + sellers.length} total clients ({buyers.length} buyers, {sellers.length} sellers)
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Users size={24} className="text-blue-600" />
                Buyers & Renters
              </h2>
              <span className="text-sm text-gray-600">{buyers.length} total</span>
            </div>
            {buyers.length === 0 ? (
              <div className="text-center py-12">
                <Users size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600">No buyers assigned yet</p>
                <p className="text-sm text-gray-500 mt-2">
                  Buyers will appear here when assigned to you
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {buyers.map((buyer) => (
                  <div
                    key={buyer.id}
                    className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="bg-blue-100 rounded-full p-3">
                        <User size={20} className="text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 truncate">{buyer.full_name}</p>
                        <p className="text-sm text-gray-600 truncate">{buyer.phone_number || 'No phone'}</p>
                        <p className="text-xs text-gray-500 capitalize">{buyer.user_type}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedBuyer({ id: buyer.id, name: buyer.full_name });
                          setShowBuyerProgressModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-700 p-2 rounded-md hover:bg-blue-50 transition"
                        title="Track journey"
                      >
                        <TrendingUp size={18} />
                      </button>
                      <button
                        onClick={() => navigate(`/messages/new`)}
                        className="text-blue-600 hover:text-blue-700 p-2 rounded-md hover:bg-blue-50 transition"
                        title="Send message"
                      >
                        <MessageSquare size={18} />
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm(`Are you sure you want to unassign ${buyer.full_name}?`)) {
                            await handleUnassignBuyer(buyer.id, buyer.full_name);
                          }
                        }}
                        className="text-red-600 hover:text-red-700 p-2 rounded-md hover:bg-red-50 transition"
                        title="Unassign buyer"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Users size={24} className="text-green-600" />
                Sellers
              </h2>
              <span className="text-sm text-gray-600">{sellers.length} total</span>
            </div>
            {sellers.length === 0 ? (
              <div className="text-center py-12">
                <Users size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600">No sellers assigned yet</p>
                <p className="text-sm text-gray-500 mt-2">
                  Sellers will appear here when assigned to you
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {sellers.map((seller) => (
                  <div
                    key={seller.id}
                    className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="bg-green-100 rounded-full p-3">
                        <User size={20} className="text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 truncate">{seller.full_name}</p>
                        <p className="text-sm text-gray-600 truncate">{seller.phone_number || 'No phone'}</p>
                        <p className="text-xs text-gray-500 capitalize">{seller.user_type}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedSeller({ id: seller.id, name: seller.full_name });
                          setShowSellerProgressModal(true);
                        }}
                        className="text-green-600 hover:text-green-700 p-2 rounded-md hover:bg-green-50 transition"
                        title="Track journey"
                      >
                        <TrendingUp size={18} />
                      </button>
                      <button
                        onClick={() => navigate(`/messages/new`)}
                        className="text-blue-600 hover:text-blue-700 p-2 rounded-md hover:bg-blue-50 transition"
                        title="Send message"
                      >
                        <MessageSquare size={18} />
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm(`Are you sure you want to unassign ${seller.full_name}? Their properties will become unassigned.`)) {
                            await handleUnassignSeller(seller.id, seller.full_name);
                          }
                        }}
                        className="text-red-600 hover:text-red-700 p-2 rounded-md hover:bg-red-50 transition"
                        title="Unassign seller"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showSellerProgressModal && selectedSeller && (
        <UpdateSellerProgress
          sellerId={selectedSeller.id}
          sellerName={selectedSeller.name}
          onClose={() => {
            setShowSellerProgressModal(false);
            setSelectedSeller(null);
          }}
        />
      )}

      {showBuyerProgressModal && selectedBuyer && (
        <UpdateBuyerProgress
          buyerId={selectedBuyer.id}
          buyerName={selectedBuyer.name}
          onClose={() => {
            setShowBuyerProgressModal(false);
            setSelectedBuyer(null);
          }}
          onUpdate={() => {}}
        />
      )}
    </div>
  );
}
