import { useState, useEffect } from 'react';
import { ArrowLeft, Home, User, MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from '../Navigation/Router';
import { EnhancedPropertyAnalytics } from '../Seller/EnhancedPropertyAnalytics';

type BrokerageListingAnalyticsProps = {
  propertyId: string;
};

type PropertyInfo = {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  price: number;
  listing_type: string;
  agent_id: string;
  agent_name: string;
  agent_photo_url: string | null;
};

export function BrokerageListingAnalytics({ propertyId }: BrokerageListingAnalyticsProps) {
  const navigate = useNavigate();
  const [property, setProperty] = useState<PropertyInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProperty();
  }, [propertyId]);

  const loadProperty = async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select(`
          id,
          address_line1,
          city,
          state,
          zip_code,
          price,
          listing_type,
          agent_id,
          agent:agent_profiles!properties_agent_id_fkey(
            profile_photo_url,
            profile:profiles!agent_profiles_id_fkey(full_name)
          )
        `)
        .eq('id', propertyId)
        .single();

      if (error) throw error;

      setProperty({
        id: data.id,
        address: data.address_line1,
        city: data.city,
        state: data.state,
        zip_code: data.zip_code,
        price: data.price,
        listing_type: data.listing_type,
        agent_id: data.agent_id,
        agent_name: data.agent?.profile?.full_name || 'Unknown Agent',
        agent_photo_url: data.agent?.profile_photo_url || null,
      });
    } catch (error) {
      console.error('Error loading property:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Home className="mx-auto text-gray-400 mb-4" size={48} />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Property Not Found</h2>
          <button
            onClick={() => navigate('/brokerage/dashboard')}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="bg-white shadow-sm border-b mb-6">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <button
            onClick={() => navigate('/brokerage/dashboard')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4"
          >
            <ArrowLeft size={20} />
            <span>Back to Dashboard</span>
          </button>

          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-800 mb-2">{property.address}</h1>
              <div className="flex items-center gap-2 text-gray-600 mb-3">
                <MapPin size={16} />
                <span>
                  {property.city}, {property.state} {property.zip_code}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-xl font-bold text-gray-800">
                  ${property.price.toLocaleString()}
                  {property.listing_type === 'rent' && (
                    <span className="text-sm font-normal text-gray-600">/mo</span>
                  )}
                </div>
                <span
                  className={`px-3 py-1 text-sm font-medium rounded-full ${
                    property.listing_type === 'sale'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {property.listing_type === 'sale' ? 'For Sale' : 'For Rent'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-gray-50 px-4 py-3 rounded-lg border border-gray-200">
              {property.agent_photo_url ? (
                <img
                  src={property.agent_photo_url}
                  alt={property.agent_name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                  <User size={20} className="text-gray-400" />
                </div>
              )}
              <div>
                <div className="text-xs text-gray-600">Listing Agent</div>
                <div className="font-medium text-gray-800">{property.agent_name}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4">
        <EnhancedPropertyAnalytics
          propertyId={property.id}
          propertyAddress={property.address}
        />
      </div>
    </div>
  );
}
