import { useState, useEffect } from 'react';
import { Building2, TrendingUp } from 'lucide-react';
import { supabase, Property } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from '../Navigation/Router';
import { PropertyCard } from '../Properties/PropertyCard';

type PropertyWithPhotos = Property & {
  photos?: { photo_url: string }[];
};

export function AgentListingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeListings, setActiveListings] = useState<PropertyWithPhotos[]>([]);
  const [soldListings, setSoldListings] = useState<PropertyWithPhotos[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'sold'>('active');

  useEffect(() => {
    if (user) {
      loadListings();
    }
  }, [user]);

  const loadListings = async () => {
    setLoading(true);
    try {
      const { data: activeData, error: activeError } = await supabase
        .from('properties')
        .select(`
          *,
          photos:property_photos(photo_url),
          seller:profiles!properties_seller_id_fkey(*)
        `)
        .eq('agent_id', user!.id)
        .in('status', ['active', 'pending'])
        .order('created_at', { ascending: false });

      if (activeError) throw activeError;
      setActiveListings(activeData || []);

      const { data: soldData, error: soldError } = await supabase
        .from('properties')
        .select(`
          *,
          photos:property_photos(photo_url),
          seller:profiles!properties_seller_id_fkey(*)
        `)
        .eq('agent_id', user!.id)
        .in('status', ['sold', 'rented'])
        .order('updated_at', { ascending: false });

      if (soldError) throw soldError;
      setSoldListings(soldData || []);
    } catch (error) {
      console.error('Error loading listings:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const calculateTotalValue = (listings: Property[]) => {
    return listings.reduce((sum, prop) => sum + prop.price, 0);
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">My Listings</h1>
              <p className="text-gray-600">
                {activeListings.length} active, {soldListings.length} sold/rented
              </p>
            </div>
            <button
              onClick={() => navigate('/properties/create')}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-medium"
            >
              New Listing
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <Building2 className="text-blue-500" size={28} />
              <span className="text-4xl font-bold text-gray-800">{activeListings.length}</span>
            </div>
            <p className="text-gray-600 mb-1 text-lg">Active Listings</p>
            <p className="text-sm text-gray-500">
              Total Value: {formatCurrency(calculateTotalValue(activeListings))}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="text-green-500" size={28} />
              <span className="text-4xl font-bold text-gray-800">{soldListings.length}</span>
            </div>
            <p className="text-gray-600 mb-1 text-lg">Sold/Rented</p>
            <p className="text-sm text-gray-500">
              Total Value: {formatCurrency(calculateTotalValue(soldListings))}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="border-b">
            <nav className="flex px-6">
              <button
                onClick={() => setActiveTab('active')}
                className={`px-6 py-4 font-medium border-b-2 transition ${
                  activeTab === 'active'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Building2 size={20} />
                  <span>Active ({activeListings.length})</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('sold')}
                className={`px-6 py-4 font-medium border-b-2 transition ${
                  activeTab === 'sold'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <TrendingUp size={20} />
                  <span>Sold/Rented ({soldListings.length})</span>
                </div>
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'active' && (
              <>
                {activeListings.length === 0 ? (
                  <div className="text-center py-16">
                    <Building2 size={64} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-600 text-lg mb-4">No active listings yet</p>
                    <button
                      onClick={() => navigate('/properties/create')}
                      className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-medium"
                    >
                      Create Your First Listing
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {activeListings.map((property) => (
                      <PropertyCard
                        key={property.id}
                        property={property}
                        onSellerAssigned={loadListings}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
            {activeTab === 'sold' && (
              <>
                {soldListings.length === 0 ? (
                  <div className="text-center py-16">
                    <TrendingUp size={64} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-600 text-lg">No sold or rented properties yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {soldListings.map((property) => (
                      <PropertyCard
                        key={property.id}
                        property={property}
                        onSellerAssigned={loadListings}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
