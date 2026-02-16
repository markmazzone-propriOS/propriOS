import { useState, useEffect } from 'react';
import { Search, Trash2, Eye, ArrowLeft, Building2 } from 'lucide-react';
import { supabase, Property } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from '../Navigation/Router';

type PropertyWithDetails = Property & {
  lister: { full_name: string };
  agent: { profile: { full_name: string } } | null;
  photos: { photo_url: string }[];
};

export function AdminListingsManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [properties, setProperties] = useState<PropertyWithDetails[]>([]);
  const [filteredProperties, setFilteredProperties] = useState<PropertyWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedProperty, setSelectedProperty] = useState<PropertyWithDetails | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    checkAdminAccess();
  }, [user]);

  useEffect(() => {
    filterProperties();
  }, [searchTerm, filterStatus, filterType, properties]);

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

      loadProperties();
    } catch (error) {
      console.error('Error checking admin access:', error);
      navigate('/dashboard');
    }
  };

  const loadProperties = async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select(`
          *,
          lister:profiles!properties_listed_by_fkey(full_name),
          agent:agent_profiles!properties_agent_id_fkey(
            profile:profiles!agent_profiles_id_fkey(full_name)
          ),
          photos:property_photos(photo_url)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProperties(data || []);
      setFilteredProperties(data || []);
    } catch (error) {
      console.error('Error loading properties:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterProperties = () => {
    let filtered = properties;

    if (filterStatus !== 'all') {
      filtered = filtered.filter((p) => p.status === filterStatus);
    }

    if (filterType !== 'all') {
      filtered = filtered.filter((p) => p.listing_type === filterType);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.address_line1.toLowerCase().includes(term) ||
          p.city.toLowerCase().includes(term) ||
          p.state.toLowerCase().includes(term) ||
          p.lister.full_name.toLowerCase().includes(term)
      );
    }

    setFilteredProperties(filtered);
  };

  const handleDeleteProperty = async () => {
    if (!selectedProperty) return;

    setActionLoading(true);
    try {
      await supabase.from('admin_audit_log').insert({
        admin_id: user!.id,
        action_type: 'delete_listing',
        target_type: 'property',
        target_id: selectedProperty.id,
        details: {
          address: selectedProperty.address_line1,
          city: selectedProperty.city,
          state: selectedProperty.state,
        },
      });

      const { error: deleteError } = await supabase
        .from('properties')
        .delete()
        .eq('id', selectedProperty.id);

      if (deleteError) throw deleteError;

      await loadProperties();
      setShowDeleteModal(false);
      setSelectedProperty(null);
    } catch (error: any) {
      console.error('Error deleting property:', error);
      alert(error.message || 'Failed to delete property');
    } finally {
      setActionLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(price);
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
          <h1 className="text-3xl font-bold text-gray-800">Listings Management</h1>
          <p className="text-gray-600 mt-2">View and manage property listings</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search by address, city, or lister..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="sold">Sold</option>
              <option value="rented">Rented</option>
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="sale">For Sale</option>
              <option value="rent">For Rent</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProperties.map((property) => (
            <div key={property.id} className="bg-white rounded-lg shadow overflow-hidden hover:shadow-lg transition">
              <div className="relative h-48 bg-gray-200">
                <img
                  src={property.photos[0]?.photo_url || 'https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg?auto=compress&cs=tinysrgb&w=400'}
                  alt={property.address_line1}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = 'https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg?auto=compress&cs=tinysrgb&w=400';
                  }}
                />
                <div className="absolute top-2 right-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    property.status === 'active' ? 'bg-green-500 text-white' :
                    property.status === 'pending' ? 'bg-yellow-500 text-white' :
                    'bg-gray-500 text-white'
                  }`}>
                    {property.status}
                  </span>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-2xl font-bold text-gray-800">
                    {formatPrice(property.price)}
                    {property.listing_type === 'rent' && <span className="text-lg text-gray-600">/mo</span>}
                  </h3>
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                    {property.listing_type === 'sale' ? 'For Sale' : 'For Rent'}
                  </span>
                </div>
                <p className="text-gray-700 font-medium mb-1">{property.address_line1}</p>
                <p className="text-gray-600 text-sm mb-3">
                  {property.city}, {property.state} {property.zip_code}
                </p>
                <div className="flex items-center gap-4 text-sm text-gray-600 mb-3 pb-3 border-b">
                  <span>{property.bedrooms} bed</span>
                  <span>{property.bathrooms} bath</span>
                  <span>{property.square_footage.toLocaleString()} sqft</span>
                </div>
                <div className="text-sm text-gray-600 mb-4">
                  <p><strong>Listed by:</strong> {property.lister.full_name}</p>
                  {property.agent && (
                    <p><strong>Agent:</strong> {property.agent.profile.full_name}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/properties/${property.id}`)}
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition text-sm"
                  >
                    <Eye size={16} />
                    View
                  </button>
                  <button
                    onClick={() => {
                      setSelectedProperty(property);
                      setShowDeleteModal(true);
                    }}
                    className="flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition text-sm"
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredProperties.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Building2 size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500 text-lg">No listings found matching your criteria</p>
          </div>
        )}
      </div>

      {showDeleteModal && selectedProperty && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Delete Listing</h3>
            <p className="text-gray-700 mb-4">
              Are you sure you want to permanently delete this property listing?
            </p>
            <div className="bg-gray-50 rounded p-3 mb-4">
              <p className="text-sm font-medium text-gray-800">{selectedProperty.address_line1}</p>
              <p className="text-sm text-gray-600">
                {selectedProperty.city}, {selectedProperty.state} {selectedProperty.zip_code}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Listed by: {selectedProperty.lister.full_name}
              </p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
              <p className="text-sm text-red-800">
                <strong>Warning:</strong> This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedProperty(null);
                }}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProperty}
                disabled={actionLoading}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition disabled:opacity-50 font-medium"
              >
                {actionLoading ? 'Deleting...' : 'Delete Listing'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
