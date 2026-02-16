import { useState, useEffect } from 'react';
import { Plus, Home, MapPin, DollarSign, Bed, Bath, Square, Edit, Trash2, Eye, Calendar, ArrowLeft, BarChart3 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from '../Navigation/Router';

type Property = {
  id: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  zip_code: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  square_footage: number;
  description: string;
  status: string;
  listing_type: string;
  created_at: string;
  available_date: string | null;
  terms: string | null;
  main_photo?: string | null;
};

export function PropertyOwnerListings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadProperties();
  }, [user]);

  const loadProperties = async () => {
    if (!user) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('properties')
        .select('*')
        .eq('listed_by', user.id)
        .eq('listing_type', 'rent')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Fetch the main photo for each property
      const propertiesWithPhotos = await Promise.all(
        (data || []).map(async (property) => {
          const { data: photos } = await supabase
            .from('property_photos')
            .select('photo_url')
            .eq('property_id', property.id)
            .order('display_order', { ascending: true })
            .limit(1)
            .maybeSingle();

          return {
            ...property,
            main_photo: photos?.photo_url || null
          };
        })
      );

      setProperties(propertiesWithPhotos);
    } catch (err: any) {
      setError(err.message || 'Failed to load properties');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (propertyId: string) => {
    if (!confirm('Are you sure you want to delete this listing? This action cannot be undone.')) {
      return;
    }

    setDeleting(propertyId);
    setError('');

    try {
      const { error: deleteError } = await supabase
        .from('properties')
        .delete()
        .eq('id', propertyId);

      if (deleteError) throw deleteError;

      setProperties(properties.filter(p => p.id !== propertyId));
    } catch (err: any) {
      setError(err.message || 'Failed to delete property');
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <button
        onClick={() => navigate('/property-owner/dashboard')}
        className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-6 transition"
      >
        <ArrowLeft size={20} />
        Back to Dashboard
      </button>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <Home className="text-blue-600" size={32} />
            My Rental Listings
          </h1>
          <p className="text-gray-600 mt-2">Manage your rental properties</p>
        </div>
        <button
          onClick={() => navigate('/property-owner/listings/create')}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-medium"
        >
          <Plus size={20} />
          Create New Listing
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {properties.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <Home className="mx-auto text-gray-400 mb-4" size={64} />
          <h3 className="text-xl font-semibold text-gray-800 mb-2">No Listings Yet</h3>
          <p className="text-gray-600 mb-6">Create your first rental listing to get started</p>
          <button
            onClick={() => navigate('/property-owner/listings/create')}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-medium"
          >
            <Plus size={20} />
            Create Listing
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((property) => (
            <div key={property.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition">
              {property.main_photo ? (
                <div className="h-48 overflow-hidden">
                  <img
                    src={property.main_photo}
                    alt={property.address_line1}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                </div>
              ) : (
                <div className="h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                  <Home size={48} className="text-gray-400" />
                </div>
              )}
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">
                      {property.address_line1}
                    </h3>
                    <div className="flex items-center gap-2 text-gray-600 text-sm mb-3">
                      <MapPin size={16} />
                      <span>{property.city}, {property.state} {property.zip_code}</span>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    property.status === 'active' ? 'bg-green-100 text-green-800' :
                    property.status === 'rented' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {property.status}
                  </span>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-2 text-gray-700">
                    <DollarSign size={18} className="text-blue-600" />
                    <span className="font-semibold text-lg">
                      ${property.price.toLocaleString()}/mo
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Bed size={16} />
                      <span>{property.bedrooms} bed</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Bath size={16} />
                      <span>{property.bathrooms} bath</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Square size={16} />
                      <span>{property.square_footage.toLocaleString()} sqft</span>
                    </div>
                  </div>
                </div>

                <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                  {property.description}
                </p>

                {property.terms && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-gray-500 uppercase mb-1">Lease Terms</p>
                    <p className="text-gray-600 text-sm line-clamp-2">
                      {property.terms}
                    </p>
                  </div>
                )}

                {property.available_date && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-4 pb-4 border-b">
                    <Calendar size={16} className="text-blue-600" />
                    <span>Available: {new Date(property.available_date).toLocaleDateString()}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => navigate(`/properties/${property.id}`)}
                    className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm font-medium text-gray-700"
                  >
                    <Eye size={16} />
                    View
                  </button>
                  <button
                    onClick={() => navigate(`/property-owner/listings/${property.id}/analytics`)}
                    className="flex items-center justify-center gap-2 px-4 py-2 border border-emerald-300 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition text-sm font-medium"
                  >
                    <BarChart3 size={16} />
                    Analytics
                  </button>
                  <button
                    onClick={() => navigate(`/property-owner/listings/${property.id}/edit`)}
                    className="flex items-center justify-center gap-2 px-4 py-2 border border-blue-300 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition text-sm font-medium"
                  >
                    <Edit size={16} />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(property.id)}
                    disabled={deleting === property.id}
                    className="flex items-center justify-center gap-2 px-4 py-2 border border-red-300 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition text-sm font-medium disabled:opacity-50"
                  >
                    {deleting === property.id ? (
                      <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
