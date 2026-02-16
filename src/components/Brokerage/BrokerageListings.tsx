import { useState, useEffect } from 'react';
import { Home, Eye, DollarSign, MapPin, User, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from '../Navigation/Router';

type PropertyWithAgent = {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  square_feet: number;
  listing_type: string;
  status: string;
  photo_url: string | null;
  agent_id: string;
  agent_name: string;
  agent_photo_url: string | null;
  view_count: number;
  favorite_count: number;
  viewing_count: number;
  offer_count: number;
};

type BrokerageListingsProps = {
  brokerageId: string;
};

export function BrokerageListings({ brokerageId }: BrokerageListingsProps) {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<PropertyWithAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'sale' | 'rent'>('all');

  useEffect(() => {
    loadProperties();
  }, [brokerageId, filter]);

  const loadProperties = async () => {
    try {
      const { data: agentIds, error: agentError } = await supabase
        .from('brokerage_agents')
        .select('agent_id')
        .eq('brokerage_id', brokerageId)
        .eq('status', 'active');

      if (!agentIds || agentIds.length === 0) {
        setProperties([]);
        setLoading(false);
        return;
      }

      let query = supabase
        .from('properties')
        .select(`
          *,
          agent:agent_profiles!properties_agent_id_fkey(
            profile_photo_url,
            profile:profiles!agent_profiles_id_fkey(full_name)
          ),
          property_photos(photo_url)
        `)
        .in('agent_id', agentIds.map(a => a.agent_id))
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('listing_type', filter);
      }

      const { data: propertiesData, error } = await query;

      if (error) throw error;

      const propertiesWithStats = await Promise.all(
        (propertiesData || []).map(async (property: any) => {
          const [
            { count: viewCount },
            { count: favoriteCount },
            { count: viewingCount },
            { count: offerCount }
          ] = await Promise.all([
            supabase
              .from('property_views')
              .select('*', { count: 'exact', head: true })
              .eq('property_id', property.id),
            supabase
              .from('favorites')
              .select('*', { count: 'exact', head: true })
              .eq('property_id', property.id),
            supabase
              .from('calendar_events')
              .select('*', { count: 'exact', head: true })
              .eq('property_id', property.id)
              .eq('event_type', 'viewing'),
            supabase
              .from('offers')
              .select('*', { count: 'exact', head: true })
              .eq('property_id', property.id)
          ]);

          return {
            id: property.id,
            address: property.address_line1,
            city: property.city,
            state: property.state,
            zip_code: property.zip_code,
            price: property.price,
            bedrooms: property.bedrooms,
            bathrooms: property.bathrooms,
            square_feet: property.square_footage,
            listing_type: property.listing_type,
            status: property.status,
            photo_url: property.property_photos?.[0]?.photo_url || null,
            agent_id: property.agent_id,
            agent_name: property.agent?.profile?.full_name || 'Unknown Agent',
            agent_photo_url: property.agent?.profile_photo_url || null,
            view_count: viewCount || 0,
            favorite_count: favoriteCount || 0,
            viewing_count: viewingCount || 0,
            offer_count: offerCount || 0,
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

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <Home className="mx-auto text-gray-400 mb-4" size={48} />
        <h3 className="text-lg font-semibold text-gray-800 mb-2">No Listings Yet</h3>
        <p className="text-gray-600">Your agents haven't created any listings yet</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-md font-medium transition ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All Listings
        </button>
        <button
          onClick={() => setFilter('sale')}
          className={`px-4 py-2 rounded-md font-medium transition ${
            filter === 'sale'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          For Sale
        </button>
        <button
          onClick={() => setFilter('rent')}
          className={`px-4 py-2 rounded-md font-medium transition ${
            filter === 'rent'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          For Rent
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {properties.map((property) => (
          <div
            key={property.id}
            className="bg-white rounded-lg shadow-md hover:shadow-lg transition border border-gray-200 overflow-hidden"
          >
            <div className="flex gap-4 p-4">
              <div
                className="w-48 h-36 flex-shrink-0 bg-gray-200 rounded-lg overflow-hidden cursor-pointer"
                onClick={() => navigate(`/properties/${property.id}`)}
              >
                {property.photo_url ? (
                  <img
                    src={property.photo_url}
                    alt={property.address}
                    className="w-full h-full object-cover hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Home className="text-gray-400" size={48} />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3
                    className="font-semibold text-gray-800 hover:text-blue-600 cursor-pointer truncate"
                    onClick={() => navigate(`/properties/${property.id}`)}
                  >
                    {property.address}
                  </h3>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full flex-shrink-0 ${
                      property.listing_type === 'sale'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {property.listing_type === 'sale' ? 'For Sale' : 'For Rent'}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-sm text-gray-600 mb-2">
                  <MapPin size={14} />
                  <span className="truncate">
                    {property.city}, {property.state} {property.zip_code}
                  </span>
                </div>

                <div className="text-lg font-bold text-gray-800 mb-2">
                  ${property.price.toLocaleString()}
                  {property.listing_type === 'rent' && (
                    <span className="text-sm font-normal text-gray-600">/mo</span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                  <span>{property.bedrooms} bd</span>
                  <span>{property.bathrooms} ba</span>
                  <span>{property.square_feet.toLocaleString()} sqft</span>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {property.agent_photo_url ? (
                      <img
                        src={property.agent_photo_url}
                        alt={property.agent_name}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                        <User size={14} className="text-gray-400" />
                      </div>
                    )}
                    <span className="text-sm text-gray-600 truncate">{property.agent_name}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-4 pb-4 flex items-center justify-between gap-4 border-t border-gray-200 pt-3">
              <div className="grid grid-cols-4 gap-4 flex-1">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-gray-600 mb-1">
                    <Eye size={16} />
                    <span className="text-sm font-semibold">{property.view_count}</span>
                  </div>
                  <div className="text-xs text-gray-500">Views</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-gray-600 mb-1">
                    <Eye size={16} />
                    <span className="text-sm font-semibold">{property.favorite_count}</span>
                  </div>
                  <div className="text-xs text-gray-500">Favorites</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-gray-600 mb-1">
                    <Eye size={16} />
                    <span className="text-sm font-semibold">{property.viewing_count}</span>
                  </div>
                  <div className="text-xs text-gray-500">Viewings</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-gray-600 mb-1">
                    <DollarSign size={16} />
                    <span className="text-sm font-semibold">{property.offer_count}</span>
                  </div>
                  <div className="text-xs text-gray-500">Offers</div>
                </div>
              </div>
              <button
                onClick={() => navigate(`/brokerage/listings/${property.id}/analytics`)}
                className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center gap-1 flex-shrink-0"
              >
                <TrendingUp size={16} />
                View Analytics
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
