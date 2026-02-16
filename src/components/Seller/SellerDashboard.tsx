import { useState, useEffect } from 'react';
import { Home, Eye, Heart, Tag, Plus, DollarSign, MapPin, Calendar, TrendingUp, Users, BarChart3, Map, CheckSquare } from 'lucide-react';
import { supabase, Property } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useRouter } from '../Navigation/Router';
import { PropertyJourneyTracker } from './PropertyJourneyTracker';
import { PropertyJourneyModal } from './PropertyJourneyModal';
import { InvitationInfo } from '../shared/InvitationInfo';

type PropertyWithDetails = Property & {
  photos?: { photo_url: string }[];
  favorite_count?: number;
  view_count?: number;
  offer_count?: number;
  journey_stage?: string;
};

export function SellerDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { currentRoute } = useRouter();
  const [properties, setProperties] = useState<PropertyWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPropertyForJourney, setSelectedPropertyForJourney] = useState<{ id: string; address: string } | null>(null);
  const [stats, setStats] = useState({
    totalListings: 0,
    activeListings: 0,
    totalViews: 0,
    totalFavorites: 0,
    totalOffers: 0,
  });

  useEffect(() => {
    if (user) {
      loadProperties();
      loadStats();

      const propertiesChannel = supabase
        .channel('seller-properties')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'properties',
            filter: `seller_id=eq.${user.id}`,
          },
          () => {
            loadProperties();
            loadStats();
          }
        )
        .subscribe();

      const offersChannel = supabase
        .channel('seller-offers')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'property_offers',
          },
          () => {
            loadProperties();
            loadStats();
          }
        )
        .subscribe();

      const handleVisibilityChange = () => {
        if (!document.hidden) {
          loadProperties();
          loadStats();
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        supabase.removeChannel(propertiesChannel);
        supabase.removeChannel(offersChannel);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [user, currentRoute.path]);

  const loadProperties = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('properties')
        .select(`
          *,
          photos:property_photos(photo_url)
        `)
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const propertiesWithStats = await Promise.all(
        (data || []).map(async (property) => {
          const [favoritesRes, viewsRes, offersRes, journeyRes] = await Promise.all([
            supabase
              .from('favorites')
              .select('id', { count: 'exact', head: true })
              .eq('property_id', property.id),
            supabase
              .from('property_views')
              .select('view_count')
              .eq('property_id', property.id),
            supabase
              .from('property_offers')
              .select('id', { count: 'exact' })
              .eq('property_id', property.id),
            supabase
              .from('seller_journey_progress')
              .select('current_stage')
              .eq('property_id', property.id)
              .maybeSingle(),
          ]);

          if (offersRes.error) {
            console.error('Error loading offers count for property:', property.id, offersRes.error);
          }

          const totalViews = viewsRes.data?.reduce((sum, v) => sum + (v.view_count || 0), 0) || 0;

          return {
            ...property,
            favorite_count: favoritesRes.count || 0,
            view_count: totalViews,
            offer_count: offersRes.count || 0,
            journey_stage: journeyRes.data?.current_stage,
          };
        })
      );

      setProperties(propertiesWithStats);
    } catch (error) {
      console.error('Error loading properties:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    if (!user) return;

    try {
      const { data: propertiesData } = await supabase
        .from('properties')
        .select('id, status')
        .eq('seller_id', user.id);

      const propertyIds = propertiesData?.map((p) => p.id) || [];

      const [favoritesRes, viewsRes, offersRes] = await Promise.all([
        supabase
          .from('favorites')
          .select('id', { count: 'exact' })
          .in('property_id', propertyIds),
        supabase
          .from('property_views')
          .select('view_count')
          .in('property_id', propertyIds),
        supabase
          .from('property_offers')
          .select('id', { count: 'exact' })
          .in('property_id', propertyIds),
      ]);

      const totalViews = viewsRes.data?.reduce((sum, v) => sum + (v.view_count || 0), 0) || 0;

      setStats({
        totalListings: propertiesData?.length || 0,
        activeListings: propertiesData?.filter((p) => p.status === 'active').length || 0,
        totalViews,
        totalFavorites: favoritesRes.count || 0,
        totalOffers: offersRes.count || 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const getDaysListed = (createdAt: string) => {
    return Math.floor(
      (new Date().getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'sold':
        return 'bg-blue-100 text-blue-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <InvitationInfo />
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back{profile?.full_name ? `, ${profile.full_name}` : ''}!
        </h1>
        <p className="text-gray-600">Manage your property listings and track performance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <button
          onClick={() => navigate('/properties/create')}
          className="flex items-center justify-center gap-3 bg-blue-600 text-white px-6 py-4 rounded-lg hover:bg-blue-700 transition font-medium shadow-md"
        >
          <Plus size={24} />
          <span>Create New Listing</span>
        </button>
        <button
          onClick={() => navigate('/seller/calendar')}
          className="flex items-center justify-center gap-3 bg-green-600 text-white px-6 py-4 rounded-lg hover:bg-green-700 transition font-medium shadow-md"
        >
          <Calendar size={24} />
          <span>View Property Calendar</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <Home className="text-blue-600" size={24} />
            <span className="text-2xl font-bold text-gray-900">{stats.totalListings}</span>
          </div>
          <p className="text-sm text-gray-600">Total Listings</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="text-green-600" size={24} />
            <span className="text-2xl font-bold text-gray-900">{stats.activeListings}</span>
          </div>
          <p className="text-sm text-gray-600">Active Listings</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <Eye className="text-purple-600" size={24} />
            <span className="text-2xl font-bold text-gray-900">{stats.totalViews}</span>
          </div>
          <p className="text-sm text-gray-600">Total Views</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <Heart className="text-red-600" size={24} />
            <span className="text-2xl font-bold text-gray-900">{stats.totalFavorites}</span>
          </div>
          <p className="text-sm text-gray-600">Total Favorites</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <Tag className="text-orange-600" size={24} />
            <span className="text-2xl font-bold text-gray-900">{stats.totalOffers}</span>
          </div>
          <p className="text-sm text-gray-600">Total Offers</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">My Property Listings</h2>
            <button
              onClick={() => navigate('/properties/create')}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition font-medium"
            >
              <Plus size={20} />
              Add New Listing
            </button>
          </div>
        </div>

        {properties.length === 0 ? (
          <div className="p-12 text-center">
            <Home size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No properties listed yet</h3>
            <p className="text-gray-600 mb-6">Start by creating your first property listing</p>
            <button
              onClick={() => navigate('/properties/create')}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition font-medium"
            >
              <Plus size={20} />
              Create Your First Listing
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {properties.map((property) => (
              <div key={property.id} className="p-6 hover:bg-gray-50 transition">
                <div className="flex gap-6">
                  <div className="flex-shrink-0 w-48 h-32 rounded-lg overflow-hidden bg-gray-200">
                    <img
                      src={
                        property.photos?.[0]?.photo_url ||
                        'https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg?auto=compress&cs=tinysrgb&w=400'
                      }
                      alt={property.address_line1}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src =
                          'https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg?auto=compress&cs=tinysrgb&w=400';
                      }}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                          {property.address_line1}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                          <MapPin size={16} />
                          <span>
                            {property.city}, {property.state} {property.zip_code}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                          property.status
                        )}`}
                      >
                        {property.status.charAt(0).toUpperCase() + property.status.slice(1)}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex items-center gap-1">
                        <DollarSign size={18} className="text-gray-500" />
                        <span className="font-semibold text-gray-900">{formatPrice(property.price)}</span>
                        {property.listing_type === 'rent' && (
                          <span className="text-sm text-gray-600">/mo</span>
                        )}
                      </div>
                      <div className="h-4 w-px bg-gray-300"></div>
                      <div className="flex items-center gap-1">
                        <Calendar size={16} className="text-gray-500" />
                        <span className="text-sm text-gray-600">
                          {getDaysListed(property.created_at)} days listed
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 mb-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Eye size={16} />
                        <span>{property.view_count || 0} views</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Heart size={16} />
                        <span>{property.favorite_count || 0} favorites</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Tag size={16} />
                        <span>{property.offer_count || 0} offers</span>
                      </div>
                    </div>

                    <div className="mb-4">
                      <PropertyJourneyTracker
                        propertyId={property.id}
                        propertyAddress={`${property.address_line1}, ${property.city}, ${property.state}`}
                        compact={true}
                      />
                    </div>

                    <div className="flex gap-3 flex-wrap">
                      <button
                        onClick={() => setSelectedPropertyForJourney({
                          id: property.id,
                          address: `${property.address_line1}, ${property.city}, ${property.state}`
                        })}
                        className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition text-sm font-medium flex items-center gap-2"
                      >
                        <Map size={16} />
                        View Journey
                      </button>
                      <button
                        onClick={() => navigate(`/properties/${property.id}/analytics`, {
                          address: `${property.address_line1}, ${property.city}, ${property.state}`
                        })}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition text-sm font-medium flex items-center gap-2"
                      >
                        <BarChart3 size={16} />
                        Analytics
                      </button>
                      <button
                        onClick={() => navigate(`/properties/${property.id}`)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition text-sm font-medium"
                      >
                        View Details
                      </button>
                      {property.offer_count > 0 && (
                        <button
                          onClick={() => navigate('/offers', { propertyId: property.id })}
                          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition text-sm font-medium"
                        >
                          View Offers
                        </button>
                      )}
                      {property.journey_stage === 'final_steps_closing' && (
                        <button
                          onClick={() => navigate('/seller/closing-checklist', {
                            propertyId: property.id,
                            address: `${property.address_line1}, ${property.city}, ${property.state}`
                          })}
                          className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition text-sm font-medium flex items-center gap-2"
                        >
                          <CheckSquare size={16} />
                          Closing Checklist
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedPropertyForJourney && (
        <PropertyJourneyModal
          propertyId={selectedPropertyForJourney.id}
          propertyAddress={selectedPropertyForJourney.address}
          onClose={() => setSelectedPropertyForJourney(null)}
        />
      )}
    </div>
  );
}
