import { useState, useEffect } from 'react';
import { Home, Bed, Bath, Maximize, Star, User, Heart, Share2, Tag, UserPlus, Calendar, BarChart3 } from 'lucide-react';
import { Property, supabase, Profile } from '../../lib/supabase';
import { useNavigate } from '../Navigation/Router';
import { useAuth } from '../../contexts/AuthContext';
import { SharePropertyModal } from './SharePropertyModal';
import { MakeOfferModal } from '../Buyer/MakeOfferModal';
import { AssignSellerModal } from '../Agents/AssignSellerModal';
import { ScheduleViewingModal } from './ScheduleViewingModal';
import { MortgageEstimate } from './MortgageEstimate';

type PropertyCardProps = {
  property: Property & {
    photos?: { photo_url: string }[];
    agent?: {
      profile: {
        full_name: string;
      };
      star_rating: number;
    };
    seller?: Profile;
  };
  showAgentInfo?: boolean;
  onSellerAssigned?: () => void;
};

export function PropertyCard({ property, showAgentInfo = false, onSellerAssigned }: PropertyCardProps) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [isFavorite, setIsFavorite] = useState(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showAssignSellerModal, setShowAssignSellerModal] = useState(false);
  const [showScheduleViewingModal, setShowScheduleViewingModal] = useState(false);
  const [seller, setSeller] = useState<Profile | null>(property.seller || null);
  const daysListed = Math.floor(
    (new Date().getTime() - new Date(property.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  useEffect(() => {
    if (user) {
      checkIfFavorite();
      if (!property.seller && property.seller_id) {
        loadSeller();
      }
    }
  }, [user, property.id]);

  const loadSeller = async () => {
    if (!property.seller_id) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', property.seller_id)
      .maybeSingle();

    if (!error && data) {
      setSeller(data);
    }
  };

  const checkIfFavorite = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', user.id)
      .eq('property_id', property.id)
      .maybeSingle();

    if (!error && data) {
      setIsFavorite(true);
    }
  };

  const trackPropertyView = async () => {
    if (!user) return;

    const { error } = await supabase
      .from('property_views')
      .upsert(
        {
          user_id: user.id,
          property_id: property.id,
          viewed_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,property_id',
        }
      );

    if (error) {
      console.error('Error tracking property view:', error);
    }
  };

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || isTogglingFavorite) return;

    setIsTogglingFavorite(true);
    try {
      if (isFavorite) {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('property_id', property.id);

        if (error) {
          console.error('Error removing favorite:', error);
        } else {
          setIsFavorite(false);
        }
      } else {
        await trackPropertyView();

        const { error } = await supabase
          .from('favorites')
          .insert({ user_id: user.id, property_id: property.id });

        if (error) {
          console.error('Error adding favorite:', error);
        } else {
          setIsFavorite(true);
        }
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    } finally {
      setIsTogglingFavorite(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const primaryPhoto = property.photos && property.photos.length > 0
    ? property.photos[0].photo_url
    : 'https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg?auto=compress&cs=tinysrgb&w=800';

  return (
    <>
      <div
        id={`property-${property.id}`}
        onClick={() => navigate(`/properties/${property.id}`)}
        className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer transition-transform hover:scale-[1.02] hover:shadow-lg"
      >
      <div className="relative h-56 bg-gray-200">
        <img
          src={primaryPhoto}
          alt={property.address_line1}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = 'https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg?auto=compress&cs=tinysrgb&w=800';
          }}
        />
        {user && (
          <div className="absolute top-3 right-3 flex gap-2">
            {(profile?.user_type === 'buyer' || profile?.user_type === 'agent') && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowShareModal(true);
                }}
                className="bg-white p-2 rounded-full shadow-md hover:bg-gray-50 transition"
                title="Share property"
              >
                <Share2 size={20} className="text-gray-700" />
              </button>
            )}
            {(profile?.user_type === 'buyer' || profile?.user_type === 'renter') && (
              <button
                onClick={toggleFavorite}
                disabled={isTogglingFavorite}
                className="bg-white p-2 rounded-full shadow-md hover:bg-gray-50 transition disabled:opacity-50 relative z-10"
                title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Heart
                  size={20}
                  className={isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-700'}
                />
              </button>
            )}
          </div>
        )}
        <div className="absolute top-3 left-3 bg-white px-3 py-1 rounded-full text-sm font-semibold text-gray-700">
          {property.listing_type === 'sale' ? 'For Sale' : 'For Rent'}
        </div>
        {daysListed < 7 && (
          <div className="absolute bottom-3 left-3 bg-green-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
            New
          </div>
        )}
      </div>

      <div className="p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-2xl font-bold text-gray-800">
            {formatPrice(property.price)}
            {property.listing_type === 'rent' && <span className="text-lg font-normal text-gray-600">/mo</span>}
          </h3>
        </div>

        {property.listing_type === 'sale' && (
          <div className="mb-3">
            <MortgageEstimate propertyPrice={property.price} compact={true} />
          </div>
        )}

        <div className="flex items-center gap-4 text-gray-700 mb-3">
          <div className="flex items-center gap-1">
            <Bed size={18} />
            <span className="text-sm">{property.bedrooms} bd</span>
          </div>
          <div className="flex items-center gap-1">
            <Bath size={18} />
            <span className="text-sm">{property.bathrooms} ba</span>
          </div>
          <div className="flex items-center gap-1">
            <Maximize size={18} />
            <span className="text-sm">{property.square_footage.toLocaleString()} sqft</span>
          </div>
        </div>

        <p className="text-gray-700 font-medium mb-1">
          {property.address_line1}
        </p>
        <p className="text-gray-600 text-sm mb-3">
          {property.city}, {property.state} {property.zip_code}
        </p>

        {property.listing_type === 'rent' && property.available_date && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-md mb-3">
            <Calendar size={16} />
            <span className="font-medium">
              Available {new Date(property.available_date).toLocaleDateString()}
            </span>
          </div>
        )}

        {showAgentInfo && property.agent ? (
          <div className="border-t pt-3 mt-3">
            <div className="flex items-center gap-2">
              <div className="bg-blue-100 rounded-full p-2">
                <User size={16} className="text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">
                  {property.agent.profile.full_name}
                </p>
                <div className="flex items-center gap-1">
                  <Star size={14} className="fill-yellow-400 text-yellow-400" />
                  <span className="text-xs text-gray-600">
                    {property.agent.star_rating.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between text-sm text-gray-500 border-t pt-3">
            <span>{daysListed} {daysListed === 1 ? 'day' : 'days'} on site</span>
            {property.year_built && <span>Built {property.year_built}</span>}
          </div>
        )}

        {user && profile?.user_type === 'agent' && property.agent_id === user.id && (
          <>
            <div className="border-t pt-3 mt-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-green-100 rounded-full p-2">
                    <User size={16} className="text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-600">Seller</p>
                    {seller ? (
                      <p className="text-sm font-medium text-gray-800">{seller.full_name}</p>
                    ) : (
                      <p className="text-sm text-gray-500 italic">Not assigned</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAssignSellerModal(true);
                  }}
                  className="text-blue-600 hover:text-blue-700 p-2 hover:bg-blue-50 rounded-md transition"
                  title={seller ? 'Change seller' : 'Assign seller'}
                >
                  <UserPlus size={18} />
                </button>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/properties/${property.id}/analytics`, {
                  address: `${property.address_line1}, ${property.city}, ${property.state}`
                });
              }}
              className="w-full mt-3 bg-emerald-600 text-white py-2 px-4 rounded-md hover:bg-emerald-700 transition font-medium flex items-center justify-center gap-2"
            >
              <BarChart3 size={18} />
              View Analytics
            </button>
          </>
        )}

        {user && profile?.user_type === 'buyer' && property.listing_type === 'sale' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowOfferModal(true);
            }}
            className="w-full mt-3 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition font-medium flex items-center justify-center gap-2"
          >
            <Tag size={18} />
            Make an Offer
          </button>
        )}

        {user && property.agent_id && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowScheduleViewingModal(true);
            }}
            className="w-full mt-3 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition font-medium flex items-center justify-center gap-2"
          >
            <Calendar size={18} />
            Schedule a Viewing
          </button>
        )}
      </div>
    </div>

    {showShareModal && (
      <SharePropertyModal
        propertyId={property.id}
        propertyAddress={`${property.address_line1}, ${property.city}, ${property.state}`}
        onClose={() => setShowShareModal(false)}
      />
    )}

    {showOfferModal && (
      <MakeOfferModal
        propertyId={property.id}
        listPrice={property.price}
        propertyAddress={`${property.address_line1}, ${property.city}, ${property.state}`}
        onClose={() => setShowOfferModal(false)}
        onSuccess={() => {
          console.log('Offer submitted successfully');
        }}
      />
    )}

    {showAssignSellerModal && (
      <AssignSellerModal
        propertyId={property.id}
        propertyAddress={`${property.address_line1}, ${property.city}, ${property.state}`}
        currentSellerId={property.seller_id}
        onClose={() => setShowAssignSellerModal(false)}
        onAssign={() => {
          loadSeller();
          if (onSellerAssigned) {
            onSellerAssigned();
          }
        }}
      />
    )}

    {showScheduleViewingModal && property.agent_id && (
      <ScheduleViewingModal
        propertyId={property.id}
        agentId={property.agent_id}
        propertyAddress={`${property.address_line1}, ${property.city}, ${property.state}`}
        onClose={() => setShowScheduleViewingModal(false)}
        onSuccess={() => {
          console.log('Viewing scheduled successfully');
        }}
      />
    )}
    </>
  );
}
