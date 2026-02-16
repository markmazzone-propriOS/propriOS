import { useState, useEffect, useRef } from 'react';
import { Star, Phone, MapPin, Video, Users, ArrowLeft, User, Globe, ExternalLink } from 'lucide-react';
import { supabase, AgentProfile as AgentProfileType, Property } from '../../lib/supabase';
import { PropertyCard } from '../Properties/PropertyCard';
import { useNavigate } from '../Navigation/Router';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type AgentProfileProps = {
  agentId: string;
};

type AgentWithProfile = AgentProfileType & {
  profile: {
    full_name: string;
    phone_number: string | null;
  };
};

type Review = {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  is_imported?: boolean;
  external_source?: string | null;
  external_url?: string | null;
  external_reviewer_name?: string | null;
};

export function AgentProfile({ agentId }: AgentProfileProps) {
  const navigate = useNavigate();
  const [agent, setAgent] = useState<AgentWithProfile | null>(null);
  const [properties, setProperties] = useState<(Property & { photos?: { photo_url: string }[] })[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    loadAgentData();
  }, [agentId]);

  useEffect(() => {
    if (!mapRef.current || properties.length === 0) return;

    const propertiesWithCoords = properties.filter(p => p.latitude && p.longitude);
    if (propertiesWithCoords.length === 0) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
    }

    const lats = propertiesWithCoords.map(p => Number(p.latitude));
    const lngs = propertiesWithCoords.map(p => Number(p.longitude));

    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;

    const map = L.map(mapRef.current).setView([centerLat, centerLng], 12);
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const customIcon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    propertiesWithCoords.forEach(property => {
      const marker = L.marker([Number(property.latitude), Number(property.longitude)], { icon: customIcon })
        .addTo(map);

      const popupContent = `
        <div style="min-width: 200px;">
          <strong style="font-size: 16px;">${property.listing_type === 'sale' ? 'For Sale' : 'For Rent'}</strong><br/>
          <strong style="font-size: 14px;">$${property.price.toLocaleString()}</strong><br/>
          <span>${property.bedrooms} bed, ${property.bathrooms} bath</span><br/>
          <span>${property.square_footage?.toLocaleString()} sqft</span>
        </div>
      `;
      marker.bindPopup(popupContent);
    });

    if (propertiesWithCoords.length > 1) {
      const bounds = L.latLngBounds(
        propertiesWithCoords.map(p => [Number(p.latitude), Number(p.longitude)])
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [properties]);

  const loadAgentData = async () => {
    try {
      const { data: agentData, error: agentError } = await supabase
        .from('agent_profiles')
        .select(`
          *,
          profile:profiles(full_name, phone_number)
        `)
        .eq('id', agentId)
        .single();

      if (agentError) throw agentError;
      setAgent(agentData);

      const { data: propertiesData, error: propertiesError } = await supabase
        .from('properties')
        .select(`
          *,
          photos:property_photos(photo_url)
        `)
        .eq('agent_id', agentId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (propertiesError) throw propertiesError;
      setProperties(propertiesData || []);

      const { data: reviewsData, error: reviewsError } = await supabase
        .from('agent_reviews')
        .select('id, rating, comment, created_at, is_imported, external_source, external_url, external_reviewer_name')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false });

      if (reviewsError) throw reviewsError;
      setReviews(reviewsData || []);
    } catch (error) {
      console.error('Error loading agent data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = () => {
    navigate(`/messages?new=${agentId}`);
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Loading agent profile...</p>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 text-lg">Agent not found</p>
      </div>
    );
  }

  const propertiesWithCoords = properties.filter(p => p.latitude && p.longitude);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <button
        onClick={() => window.history.back()}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6 transition"
      >
        <ArrowLeft size={20} />
        <span>Back</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="flex items-start gap-6 mb-6">
              <div className="flex-shrink-0">
                {agent.profile_photo_url ? (
                  <img
                    src={agent.profile_photo_url}
                    alt={agent.profile.full_name}
                    className="w-32 h-32 rounded-full object-cover border-4 border-gray-200"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-gray-100 flex items-center justify-center border-4 border-gray-200">
                    <User size={48} className="text-gray-400" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">
                  {agent.profile.full_name}
                </h1>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        size={20}
                        className={i < Math.floor(parseFloat(String(agent.star_rating))) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                      />
                    ))}
                  </div>
                  <span className="text-gray-700 font-medium">{parseFloat(String(agent.star_rating)).toFixed(1)}</span>
                  {reviews.length > 0 && (
                    <span className="text-gray-500 text-sm">({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})</span>
                  )}
                </div>
                <p className="text-gray-600">License #{agent.license_number}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 pb-6 border-b">
              {agent.profile.phone_number && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Phone size={20} />
                  <span>{agent.profile.phone_number}</span>
                </div>
              )}
              {agent.languages.length > 0 && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Users size={20} />
                  <span>Speaks: {agent.languages.join(', ')}</span>
                </div>
              )}
              {agent.meet_in_person && (
                <div className="flex items-center gap-2 text-gray-700">
                  <MapPin size={20} />
                  <span>In-person meetings available</span>
                </div>
              )}
              {agent.video_chat && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Video size={20} />
                  <span>Video chat available</span>
                </div>
              )}
            </div>

            {agent.locations.length > 0 && (
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-3">Service Areas</h2>
                <div className="flex flex-wrap gap-2">
                  {agent.locations.map((location, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                    >
                      {location}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {agent.bio && (
              <div>
                <h2 className="text-xl font-bold text-gray-800 mb-3">About</h2>
                <p className="text-gray-700 leading-relaxed whitespace-pre-line">{agent.bio}</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Contact Agent</h3>
            <div className="space-y-3">
              <button
                onClick={handleSendMessage}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition font-medium"
              >
                Send Message
              </button>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-2">
              {properties.length} Active Listings
            </h3>
            <p className="text-gray-700 text-sm">
              Browse all properties managed by this agent
            </p>
          </div>
        </div>
      </div>

      {reviews.length > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Client Reviews</h2>
          <div className="bg-white rounded-lg shadow-md divide-y">
            {reviews.map((review) => (
              <div key={review.id} className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            size={16}
                            className={i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                          />
                        ))}
                      </div>
                      <span className="text-gray-500 text-sm">
                        {new Date(review.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                    {review.is_imported && review.external_source && (
                      <div className="flex items-center gap-2 mb-2">
                        <Globe size={14} className="text-blue-600" />
                        <span className="text-sm text-gray-600">
                          Originally posted on <span className="font-medium text-blue-600">{review.external_source}</span>
                        </span>
                        {review.external_url && (
                          <a
                            href={review.external_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                    )}
                    {review.external_reviewer_name && (
                      <p className="text-sm text-gray-600 mb-2">
                        By {review.external_reviewer_name}
                      </p>
                    )}
                  </div>
                </div>
                <p className="text-gray-700 leading-relaxed">{review.comment}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Current Listings</h2>
        {properties.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-600">This agent currently has no active listings.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {properties.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        )}
      </div>

      {propertiesWithCoords.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Listing Locations</h2>
          <div ref={mapRef} className="rounded-lg overflow-hidden h-96 w-full"></div>
        </div>
      )}
    </div>
  );
}
