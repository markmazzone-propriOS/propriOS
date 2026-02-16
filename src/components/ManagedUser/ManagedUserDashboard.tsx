import { useState, useEffect } from 'react';
import { Building2, Plus, Edit2, Trash2, Eye } from 'lucide-react';
import { supabase, Property } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from '../Navigation/Router';
import { PropertyCard } from '../Properties/PropertyCard';

type PropertyWithPhotos = Property & {
  photos?: { photo_url: string }[];
};

export function ManagedUserDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [properties, setProperties] = useState<PropertyWithPhotos[]>([]);
  const [loading, setLoading] = useState(true);
  const [managedAccount, setManagedAccount] = useState<any>(null);
  const [agentInfo, setAgentInfo] = useState<any>(null);

  useEffect(() => {
    if (user && profile) {
      loadDashboardData();
    }
  }, [user, profile]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadManagedAccountInfo(),
        loadProperties(),
      ]);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadManagedAccountInfo = async () => {
    if (!user) return;

    try {
      const { data: accountData, error: accountError } = await supabase
        .from('agent_managed_accounts')
        .select(`
          *,
          agent:agent_profiles!agent_managed_accounts_agent_id_fkey(
            id,
            profile:profiles!agent_profiles_id_fkey(
              full_name,
              phone_number
            )
          )
        `)
        .eq('managed_user_id', user.id)
        .single();

      if (accountError) throw accountError;

      setManagedAccount(accountData);
      setAgentInfo(accountData.agent);
    } catch (error) {
      console.error('Error loading managed account info:', error);
    }
  };

  const loadProperties = async () => {
    if (!user) return;

    try {
      const { data: accountData } = await supabase
        .from('agent_managed_accounts')
        .select('agent_id')
        .eq('managed_user_id', user.id)
        .single();

      if (!accountData) return;

      const { data, error } = await supabase
        .from('properties')
        .select(`
          *,
          photos:property_photos(photo_url)
        `)
        .eq('agent_id', accountData.agent_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setProperties(data || []);
    } catch (error) {
      console.error('Error loading properties:', error);
    }
  };

  const handleDeleteProperty = async (propertyId: string) => {
    if (!managedAccount?.can_delete_listings) {
      alert('You do not have permission to delete listings');
      return;
    }

    if (!confirm('Are you sure you want to delete this property?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('properties')
        .delete()
        .eq('id', propertyId);

      if (error) throw error;

      setProperties(properties.filter((p) => p.id !== propertyId));
    } catch (error) {
      console.error('Error deleting property:', error);
      alert('Failed to delete property');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Welcome back, {profile?.full_name || 'User'}!
          </h1>
          {agentInfo && (
            <p className="text-gray-600">
              Managing listings for {agentInfo.profile.full_name}
            </p>
          )}
        </div>

        {managedAccount && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Your Permissions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={`p-4 rounded-lg border ${managedAccount.can_create_listings ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center gap-2">
                  <Plus size={20} className={managedAccount.can_create_listings ? 'text-green-600' : 'text-gray-400'} />
                  <span className={`font-medium ${managedAccount.can_create_listings ? 'text-green-700' : 'text-gray-500'}`}>
                    Create Listings
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {managedAccount.can_create_listings ? 'Enabled' : 'Disabled'}
                </p>
              </div>
              <div className={`p-4 rounded-lg border ${managedAccount.can_edit_listings ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center gap-2">
                  <Edit2 size={20} className={managedAccount.can_edit_listings ? 'text-green-600' : 'text-gray-400'} />
                  <span className={`font-medium ${managedAccount.can_edit_listings ? 'text-green-700' : 'text-gray-500'}`}>
                    Edit Listings
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {managedAccount.can_edit_listings ? 'Enabled' : 'Disabled'}
                </p>
              </div>
              <div className={`p-4 rounded-lg border ${managedAccount.can_delete_listings ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center gap-2">
                  <Trash2 size={20} className={managedAccount.can_delete_listings ? 'text-green-600' : 'text-gray-400'} />
                  <span className={`font-medium ${managedAccount.can_delete_listings ? 'text-green-700' : 'text-gray-500'}`}>
                    Delete Listings
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {managedAccount.can_delete_listings ? 'Enabled' : 'Disabled'}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Building2 size={24} className="text-gray-600" />
            <h2 className="text-xl font-bold text-gray-800">
              All Listings ({properties.length})
            </h2>
          </div>
          {managedAccount?.can_create_listings && (
            <button
              onClick={() => navigate('/properties/create')}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
            >
              <Plus size={20} />
              Create Listing
            </button>
          )}
        </div>

        {properties.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Building2 size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-800 mb-2">No listings yet</h3>
            <p className="text-gray-600 mb-4">
              {managedAccount?.can_create_listings
                ? 'Start by creating your first listing'
                : 'No listings available to manage'}
            </p>
            {managedAccount?.can_create_listings && (
              <button
                onClick={() => navigate('/properties/create')}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition"
              >
                Create First Listing
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {properties.map((property) => {
              const primaryPhoto = property.photos && property.photos.length > 0
                ? property.photos[0].photo_url
                : 'https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg?auto=compress&cs=tinysrgb&w=800';

              const formatPrice = (price: number) => {
                return new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                  maximumFractionDigits: 0,
                }).format(price);
              };

              return (
                <div
                  key={property.id}
                  onClick={() => navigate(`/properties/${property.id}`)}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="relative h-48 bg-gray-200">
                    <img
                      src={primaryPhoto}
                      alt={property.address_line1}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        e.currentTarget.src = 'https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg?auto=compress&cs=tinysrgb&w=800';
                      }}
                    />
                    <div className="absolute top-3 left-3 bg-blue-600 text-white px-3 py-1 rounded-md text-sm font-semibold shadow-md">
                      {property.listing_type === 'sale' ? 'For Sale' : 'For Rent'}
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="mb-3">
                      <h3 className="text-xl font-bold text-gray-900 mb-1">
                        {formatPrice(property.price)}
                        {property.listing_type === 'rent' && <span className="text-base font-normal text-gray-600">/mo</span>}
                      </h3>
                      <p className="text-sm text-gray-600 font-medium">{property.address_line1}</p>
                      <p className="text-xs text-gray-500">
                        {property.city}, {property.state} {property.zip_code}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-4 pb-4 border-b">
                      <span>{property.bedrooms} bed</span>
                      <span>{property.bathrooms} bath</span>
                      <span>{property.square_footage.toLocaleString()} sqft</span>
                    </div>

                    <div className="flex gap-2">
                      {managedAccount?.can_edit_listings && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/properties/${property.id}/edit`);
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-gray-100 text-gray-700 px-3 py-2 rounded-md hover:bg-gray-200 transition text-sm font-medium"
                        >
                          <Edit2 size={16} />
                          Edit
                        </button>
                      )}
                      {managedAccount?.can_delete_listings && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProperty(property.id);
                          }}
                          className="flex items-center justify-center gap-1.5 bg-red-50 text-red-600 px-3 py-2 rounded-md hover:bg-red-100 transition text-sm font-medium"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
