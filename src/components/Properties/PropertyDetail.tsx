import { useState, useEffect } from 'react';
import { Bed, Bath, Maximize, MapPin, Calendar as CalendarIcon, Home, ArrowLeft, Star, Phone, User as UserIcon, ChevronLeft, ChevronRight, Share2, Tag, Trash2, DollarSign, Mail, Edit, Eye, EyeOff } from 'lucide-react';
import { supabase, Property } from '../../lib/supabase';
import { useNavigate, useRouter } from '../Navigation/Router';
import { useAuth } from '../../contexts/AuthContext';
import { SharePropertyModal } from './SharePropertyModal';
import { MakeOfferModal } from '../Buyer/MakeOfferModal';
import { ScheduleViewingModal } from './ScheduleViewingModal';
import { PropertyMap } from './PropertyMap';
import { ContactOwnerModal } from '../PropertyOwner/ContactOwnerModal';
import { MortgageEstimate } from './MortgageEstimate';

type PropertyDetailProps = {
  propertyId: string;
};

type PropertyWithDetails = Property & {
  photos: { photo_url: string; display_order: number }[];
  lister: { full_name: string; phone_number: string | null };
  agent: {
    id: string;
    license_number: string;
    star_rating: number;
    profile: { full_name: string; phone_number: string | null };
  } | null;
};

export function PropertyDetail({ propertyId }: PropertyDetailProps) {
  const navigate = useNavigate();
  const { currentRoute } = useRouter();
  const { user, profile } = useAuth();
  const [property, setProperty] = useState<PropertyWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState(0);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showScheduleViewingModal, setShowScheduleViewingModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showPriceUpdateModal, setShowPriceUpdateModal] = useState(false);
  const [newPrice, setNewPrice] = useState('');
  const [updatingPrice, setUpdatingPrice] = useState(false);
  const [showContactOwnerModal, setShowContactOwnerModal] = useState(false);
  const [togglingVisibility, setTogglingVisibility] = useState(false);

  // Check if came from messages, property list, buy page, or rent page using router params
  const fromMessages = currentRoute.params?.from === 'messages';
  const fromList = currentRoute.params?.from === 'list';
  const fromBuy = currentRoute.params?.from === 'buy';
  const fromRent = currentRoute.params?.from === 'rent';
  const conversationId = currentRoute.params?.conversation;

  useEffect(() => {
    loadProperty();
  }, [propertyId]);

  useEffect(() => {
    if (user) {
      recordPropertyView();
    } else {
      recordAnonymousView();
    }
  }, [propertyId, user]);

  const loadProperty = async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select(`
          *,
          photos:property_photos(photo_url, display_order),
          lister:profiles!properties_listed_by_fkey(full_name, phone_number),
          agent:agent_profiles!properties_agent_id_fkey(
            id,
            license_number,
            star_rating,
            profile:profiles!agent_profiles_id_fkey(full_name, phone_number)
          )
        `)
        .eq('id', propertyId)
        .single();

      if (error) throw error;

      const sortedPhotos = data.photos.sort((a: any, b: any) => a.display_order - b.display_order);
      setProperty({ ...data, photos: sortedPhotos });
    } catch (error) {
      console.error('Error loading property:', error);
    } finally {
      setLoading(false);
    }
  };

  const getOrCreateSessionId = () => {
    let sessionId = sessionStorage.getItem('anonymous_session_id');
    if (!sessionId) {
      sessionId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('anonymous_session_id', sessionId);
    }
    return sessionId;
  };

  const recordAnonymousView = async () => {
    try {
      const sessionId = getOrCreateSessionId();

      await supabase
        .from('anonymous_property_views')
        .insert({
          property_id: propertyId,
          session_id: sessionId,
          viewed_at: new Date().toISOString(),
          user_agent: navigator.userAgent
        });
    } catch (error) {
      console.error('Error recording anonymous view:', error);
    }
  };

  const recordPropertyView = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('property_views')
        .upsert(
          {
            user_id: user.id,
            property_id: propertyId,
            viewed_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id,property_id',
            ignoreDuplicates: false,
          }
        );

      if (error) throw error;
    } catch (error) {
      console.error('Error recording property view:', error);
    }
  };

  const handleDeleteProperty = async () => {
    if (!property) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('properties')
        .delete()
        .eq('id', propertyId);

      if (error) throw error;

      navigate('/dashboard');
    } catch (error: any) {
      console.error('Error deleting property:', error);
      alert(error.message || 'Failed to delete property');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const canDeleteProperty = () => {
    if (!user || !property) return false;
    return (
      property.listed_by === user.id ||
      (property.agent_id === user.id && profile?.user_type === 'agent') ||
      (property.seller_id === user.id && profile?.user_type === 'seller')
    );
  };

  const canUpdatePrice = () => {
    if (!user || !property) return false;
    return (
      (property.seller_id === user.id && profile?.user_type === 'seller') ||
      (property.agent_id === user.id && profile?.user_type === 'agent')
    );
  };

  const canEditProperty = () => {
    if (!user || !property) return false;
    return (
      (property.agent_id === user.id && profile?.user_type === 'agent') ||
      (property.seller_id === user.id && profile?.user_type === 'seller') ||
      (property.listed_by === user.id && profile?.user_type === 'property_owner')
    );
  };

  const handleToggleVisibility = async () => {
    if (!property) return;

    setTogglingVisibility(true);
    try {
      const newVisibility = !property.hidden_from_public;

      const { error } = await supabase
        .from('properties')
        .update({ hidden_from_public: newVisibility })
        .eq('id', propertyId);

      if (error) throw error;

      setProperty(prev => prev ? { ...prev, hidden_from_public: newVisibility } : null);

      const message = newVisibility
        ? 'Property is now hidden from public view. Only you can see it.'
        : 'Property is now visible to the public.';

      alert(message);
    } catch (error: any) {
      console.error('Error toggling visibility:', error);
      alert(error.message || 'Failed to update visibility');
    } finally {
      setTogglingVisibility(false);
    }
  };

  const handlePriceUpdate = async () => {
    if (!property || !newPrice) return;

    const priceValue = parseFloat(newPrice);
    if (isNaN(priceValue) || priceValue <= 0) {
      alert('Please enter a valid price');
      return;
    }

    if (priceValue === property.price) {
      alert('New price must be different from current price');
      return;
    }

    setUpdatingPrice(true);
    try {
      const { error } = await supabase
        .from('properties')
        .update({ price: priceValue })
        .eq('id', propertyId);

      if (error) throw error;

      setProperty(prev => prev ? { ...prev, price: priceValue } : null);

      setShowPriceUpdateModal(false);
      setNewPrice('');
      setUpdatingPrice(false);

      alert('Price updated successfully! Email notifications have been sent to buyers who favorited this property.');
    } catch (error: any) {
      console.error('Error updating price:', error);
      alert(error.message || 'Failed to update price');
      setUpdatingPrice(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Loading property...</p>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 text-lg">Property not found</p>
      </div>
    );
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const daysListed = Math.floor(
    (new Date().getTime() - new Date(property.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  const photos = property.photos.length > 0
    ? property.photos
    : [{ photo_url: 'https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg?auto=compress&cs=tinysrgb&w=1200', display_order: 0 }];

  const fullAddress = `${property.address_line1}, ${property.city}, ${property.state} ${property.zip_code}`;

  const getBackDestination = () => {
    // If came from messages, go back to the conversation
    if (fromMessages && conversationId) {
      return `/messages/${conversationId}`;
    }

    // If came from buy page, go back to buy page
    if (fromBuy) {
      return '/buy';
    }

    // If came from rent page, go back to rent page
    if (fromRent) {
      return '/rent';
    }

    // If came from property list, go back to properties page
    if (fromList) {
      return '/properties';
    }

    if (!user) return '/';

    // If agent or seller viewing their own listing, go back to dashboard
    if (property && (
      (profile?.user_type === 'agent' && property.agent_id === user.id) ||
      (profile?.user_type === 'seller' && property.seller_id === user.id) ||
      (profile?.user_type === 'managed_user')
    )) {
      return '/dashboard';
    }

    // If property owner viewing their own rental listing, go back to their listings
    if (profile?.user_type === 'property_owner' && property.listed_by === user.id && property.listing_type === 'rent') {
      return '/property-owner/listings';
    }

    // Otherwise go to properties page
    return '/properties';
  };

  const getBackLabel = () => {
    // If came from messages, show appropriate label
    if (fromMessages) {
      return 'Back to Messages';
    }

    // If came from buy page
    if (fromBuy) {
      const savedViewMode = sessionStorage.getItem('buyPageViewMode');
      return savedViewMode === 'grid' ? 'Back to Buy' : 'Back to Buy (Map View)';
    }

    // If came from rent page
    if (fromRent) {
      const savedViewMode = sessionStorage.getItem('rentPageViewMode');
      return savedViewMode === 'grid' ? 'Back to Rent' : 'Back to Rent (Map View)';
    }

    // If came from property list
    if (fromList) {
      const savedViewMode = sessionStorage.getItem('propertyListViewMode');
      return savedViewMode === 'map' ? 'Back to Map View' : 'Back to Properties';
    }

    if (!user) return 'Back to Home';

    // If agent or seller viewing their own listing
    if (property && (
      (profile?.user_type === 'agent' && property.agent_id === user.id) ||
      (profile?.user_type === 'seller' && property.seller_id === user.id) ||
      (profile?.user_type === 'managed_user')
    )) {
      return 'Back to Dashboard';
    }

    // If property owner viewing their own rental listing
    if (profile?.user_type === 'property_owner' && property.listed_by === user.id && property.listing_type === 'rent') {
      return 'Back to My Listings';
    }

    return 'Back to Properties';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate(getBackDestination())}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
        >
          <ArrowLeft size={20} />
          {getBackLabel()}
        </button>
        <div className="flex gap-3">
          {canEditProperty() && (
            <>
              <button
                onClick={() => navigate(`/properties/${propertyId}/edit`)}
                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition font-medium"
              >
                <Edit size={20} />
                Edit Property
              </button>
              <button
                onClick={handleToggleVisibility}
                disabled={togglingVisibility}
                className={`flex items-center gap-2 px-6 py-3 rounded-md font-medium transition disabled:opacity-50 ${
                  property.hidden_from_public
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-600 text-white hover:bg-gray-700'
                }`}
                title={property.hidden_from_public ? 'Show listing to public' : 'Hide listing from public'}
              >
                {property.hidden_from_public ? <Eye size={20} /> : <EyeOff size={20} />}
                {togglingVisibility
                  ? 'Updating...'
                  : property.hidden_from_public
                    ? 'Show to Public'
                    : 'Hide from Public'
                }
              </button>
            </>
          )}
          {canUpdatePrice() && (
            <button
              onClick={() => {
                setNewPrice(property.price.toString());
                setShowPriceUpdateModal(true);
              }}
              className="flex items-center gap-2 bg-orange-600 text-white px-6 py-3 rounded-md hover:bg-orange-700 transition font-medium"
            >
              <DollarSign size={20} />
              Update Price
            </button>
          )}
          {canDeleteProperty() && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-md hover:bg-red-700 transition font-medium"
            >
              <Trash2 size={20} />
              Delete Listing
            </button>
          )}
          {user && (profile?.user_type === 'buyer' || profile?.user_type === 'agent') && (
            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition font-medium"
            >
              <Share2 size={20} />
              Share Property
            </button>
          )}
          {user && profile?.user_type === 'buyer' && property.listing_type === 'sale' && (
            <button
              onClick={() => setShowOfferModal(true)}
              className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 transition font-medium"
            >
              <Tag size={20} />
              Make an Offer
            </button>
          )}
        </div>
      </div>

      {property.hidden_from_public && canEditProperty() && (
        <div className="mb-6 bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <EyeOff className="text-yellow-600" size={24} />
            <div>
              <h3 className="font-semibold text-yellow-800">Hidden from Public View</h3>
              <p className="text-sm text-yellow-700 mt-1">
                This listing is currently hidden from public search results. Only you can see it. Use the "Show to Public" button above to make it visible.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="relative h-96 bg-gray-200 group">
              <img
                src={photos[selectedPhoto].photo_url}
                alt={property.address_line1}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = 'https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg?auto=compress&cs=tinysrgb&w=1200';
                }}
              />
              {photos.length > 1 && (
                <>
                  <button
                    onClick={() => setSelectedPhoto((selectedPhoto - 1 + photos.length) % photos.length)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 p-2 rounded-full shadow-lg transition opacity-0 group-hover:opacity-100"
                    aria-label="Previous photo"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <button
                    onClick={() => setSelectedPhoto((selectedPhoto + 1) % photos.length)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 p-2 rounded-full shadow-lg transition opacity-0 group-hover:opacity-100"
                    aria-label="Next photo"
                  >
                    <ChevronRight size={24} />
                  </button>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                    {selectedPhoto + 1} / {photos.length}
                  </div>
                </>
              )}
            </div>
            {photos.length > 1 && (
              <div className="p-4 flex gap-2 overflow-x-auto">
                {photos.map((photo, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedPhoto(index)}
                    className={`flex-shrink-0 w-24 h-20 rounded-md overflow-hidden ${
                      selectedPhoto === index ? 'ring-2 ring-blue-600' : ''
                    }`}
                  >
                    <img
                      src={photo.photo_url}
                      alt={`View ${index + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = 'https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg?auto=compress&cs=tinysrgb&w=200';
                      }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-4xl font-bold text-gray-800">
                {formatPrice(property.price)}
                {property.listing_type === 'rent' && <span className="text-2xl font-normal text-gray-600">/mo</span>}
              </h1>
              <span className="px-4 py-2 bg-blue-100 text-blue-700 rounded-full font-medium">
                {property.listing_type === 'sale' ? 'For Sale' : 'For Rent'}
              </span>
            </div>

            {property.listing_type === 'sale' && (
              <div className="mb-4">
                <MortgageEstimate propertyPrice={property.price} compact={false} />
              </div>
            )}

            <div className="flex items-center gap-6 text-lg text-gray-700 mb-6 pb-6 border-b">
              <div className="flex items-center gap-2">
                <Bed size={24} />
                <span>{property.bedrooms} Bedrooms</span>
              </div>
              <div className="flex items-center gap-2">
                <Bath size={24} />
                <span>{property.bathrooms} Bathrooms</span>
              </div>
              <div className="flex items-center gap-2">
                <Maximize size={24} />
                <span>{property.square_footage.toLocaleString()} sqft</span>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-start gap-2 text-gray-700">
                <MapPin size={20} className="mt-1 flex-shrink-0" />
                <div>
                  <p className="font-medium">{property.address_line1}</p>
                  {property.address_line2 && <p>{property.address_line2}</p>}
                  <p>{property.city}, {property.state} {property.zip_code}</p>
                </div>
              </div>
              {property.year_built && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Home size={20} />
                  <span>Built in {property.year_built}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-gray-700">
                <CalendarIcon size={20} />
                <span>Listed {daysListed} {daysListed === 1 ? 'day' : 'days'} ago</span>
              </div>
              {property.listing_type === 'rent' && property.available_date && (
                <div className="flex items-center gap-2 text-green-700 bg-green-50 px-4 py-3 rounded-lg">
                  <CalendarIcon size={20} />
                  <span className="font-semibold">
                    Available for move-in: {new Date(property.available_date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>
              )}
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-3">Description</h2>
              <p className="text-gray-700 leading-relaxed whitespace-pre-line">{property.description}</p>
            </div>

            {property.listing_type === 'rent' && property.terms && (
              <div className="mt-6 pt-6 border-t">
                <h2 className="text-2xl font-bold text-gray-800 mb-3">Lease Terms</h2>
                <p className="text-gray-700 leading-relaxed whitespace-pre-line">{property.terms}</p>
              </div>
            )}

            {(property.listed_by_name || property.brokerage || property.source || property.mls_number || property.originating_mls || property.listing_source_logo_url) && (
              <div className="mt-6 pt-6 border-t">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Listing Source</h2>
                <div className="flex items-start gap-6">
                  {property.listing_source_logo_url && (
                    <div className="flex-shrink-0">
                      <img
                        src={property.listing_source_logo_url}
                        alt="Listing source logo"
                        className="h-20 w-auto object-contain border border-gray-200 rounded-lg p-2 bg-white"
                      />
                    </div>
                  )}
                  <div className="flex-1 space-y-2 text-gray-700">
                    {property.listed_by_name && (
                      <p><span className="font-semibold">Listed by:</span> {property.listed_by_name}</p>
                    )}
                    {property.brokerage && (
                      <p><span className="font-semibold">Brokerage:</span> {property.brokerage}</p>
                    )}
                    {property.source && (
                      <p><span className="font-semibold">Source:</span> {property.source}</p>
                    )}
                    {property.mls_number && (
                      <p><span className="font-semibold">MLS#:</span> {property.mls_number}</p>
                    )}
                    {property.originating_mls && (
                      <p><span className="font-semibold">Originating MLS:</span> {property.originating_mls}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Listed By</h3>
            <p className="text-gray-700 font-medium mb-1">{property.lister.full_name}</p>
            {property.lister.phone_number && (
              <p className="text-gray-600">{property.lister.phone_number}</p>
            )}
          </div>

          {property.agent && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Real Estate Agent</h3>
              <div className="mb-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-blue-100 rounded-full p-3">
                    <UserIcon size={24} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-gray-800">{property.agent.profile.full_name}</p>
                    <div className="flex items-center gap-1">
                      <Star size={16} className="fill-yellow-400 text-yellow-400" />
                      <span className="text-gray-700 font-medium">{property.agent.star_rating.toFixed(1)}</span>
                      <span className="text-gray-500 text-sm">rating</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                  <p><span className="font-medium">License:</span> {property.agent.license_number}</p>
                  {property.agent.profile.phone_number && (
                    <div className="flex items-center gap-2">
                      <Phone size={16} />
                      <a href={`tel:${property.agent.profile.phone_number}`} className="text-blue-600 hover:text-blue-700">
                        {property.agent.profile.phone_number}
                      </a>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => navigate(`/agent-profile/${property.agent!.id}`)}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition font-medium"
              >
                View Agent Profile
              </button>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-3">Interested?</h3>
            <p className="text-gray-700 text-sm mb-4">
              {property.listing_type === 'rent'
                ? 'Contact the property owner to schedule a viewing or ask questions.'
                : 'Schedule a viewing or get more information about this property.'}
            </p>
            {property.listing_type === 'rent' && (
              <>
                {user ? (
                  <button
                    onClick={() => setShowScheduleViewingModal(true)}
                    className="w-full bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 transition font-medium flex items-center justify-center gap-2 mb-3"
                  >
                    <CalendarIcon size={20} />
                    Schedule a Viewing
                  </button>
                ) : (
                  <button
                    onClick={() => navigate('/signin')}
                    className="w-full bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 transition font-medium flex items-center justify-center gap-2 mb-3"
                  >
                    <CalendarIcon size={20} />
                    Sign In to Schedule a Viewing
                  </button>
                )}
                <button
                  onClick={() => setShowContactOwnerModal(true)}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition font-medium flex items-center justify-center gap-2"
                >
                  <Mail size={20} />
                  Contact Owner
                </button>
              </>
            )}
            {property.listing_type === 'sale' && (property.agent_id || property.seller_id) && (
              user ? (
                <button
                  onClick={() => setShowScheduleViewingModal(true)}
                  className="w-full bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 transition font-medium flex items-center justify-center gap-2"
                >
                  <CalendarIcon size={20} />
                  Schedule a Viewing
                </button>
              ) : (
                <button
                  onClick={() => navigate('/signin')}
                  className="w-full bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 transition font-medium flex items-center justify-center gap-2"
                >
                  <CalendarIcon size={20} />
                  Sign In to Schedule a Viewing
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {property.latitude && property.longitude && (
        <div className="mt-8">
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <MapPin size={24} className="text-blue-600" />
                Location
              </h2>
            </div>
            <div className="h-[400px]">
              <PropertyMap
                lat={Number(property.latitude)}
                lon={Number(property.longitude)}
                address={fullAddress}
              />
            </div>
          </div>
        </div>
      )}

      {showShareModal && (
        <SharePropertyModal
          propertyId={propertyId}
          propertyAddress={`${property.address_line1}, ${property.city}, ${property.state}`}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {showOfferModal && (
        <MakeOfferModal
          propertyId={propertyId}
          listPrice={property.price}
          propertyAddress={`${property.address_line1}, ${property.city}, ${property.state}`}
          onClose={() => setShowOfferModal(false)}
          onSuccess={() => {
            console.log('Offer submitted successfully');
          }}
        />
      )}

      {showScheduleViewingModal && (property.agent_id || property.seller_id || property.listed_by) && (
        <ScheduleViewingModal
          propertyId={propertyId}
          agentId={property.agent_id || undefined}
          ownerId={property.listing_type === 'rent' ? property.listed_by : (property.agent_id ? undefined : property.seller_id)}
          propertyAddress={`${property.address_line1}, ${property.city}, ${property.state}`}
          onClose={() => setShowScheduleViewingModal(false)}
          onSuccess={() => {
            console.log('Viewing scheduled successfully');
          }}
        />
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Delete Listing</h3>
            <p className="text-gray-700 mb-6">
              Are you sure you want to delete this property listing? This action cannot be undone.
              The listing will be removed from the platform immediately.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProperty}
                disabled={deleting}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition disabled:opacity-50 font-medium"
              >
                {deleting ? 'Deleting...' : 'Delete Listing'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPriceUpdateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Update Listing Price</h3>

            <div className="mb-6">
              <p className="text-gray-700 mb-4">
                Update the price for this property. All buyers who have favorited this property will automatically receive an email notification about the price change.
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-700 mb-2">
                  <span className="font-semibold">Current Price:</span> {formatPrice(property.price)}
                  {property.listing_type === 'rent' && <span className="text-gray-600">/mo</span>}
                </p>
              </div>

              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Price {property.listing_type === 'rent' && '(per month)'}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-lg">$</span>
                <input
                  type="number"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  placeholder="Enter new price"
                  className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-lg"
                  min="0"
                  step="1000"
                />
              </div>

              {newPrice && parseFloat(newPrice) !== property.price && (
                <div className="mt-3 p-3 bg-gray-50 rounded-md">
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">
                      {parseFloat(newPrice) > property.price ? 'Price Increase:' : 'Price Decrease:'}
                    </span>
                    {' '}
                    <span className={parseFloat(newPrice) > property.price ? 'text-red-600' : 'text-green-600'}>
                      {formatPrice(Math.abs(parseFloat(newPrice) - property.price))}
                      {' '}
                      ({Math.abs(((parseFloat(newPrice) - property.price) / property.price) * 100).toFixed(1)}%)
                    </span>
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPriceUpdateModal(false);
                  setNewPrice('');
                }}
                disabled={updatingPrice}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePriceUpdate}
                disabled={updatingPrice || !newPrice || parseFloat(newPrice) === property.price}
                className="flex-1 bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 transition disabled:opacity-50 font-medium"
              >
                {updatingPrice ? 'Updating...' : 'Update Price'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showContactOwnerModal && (
        <ContactOwnerModal
          propertyId={propertyId}
          ownerId={property.listed_by}
          propertyAddress={`${property.address_line1}, ${property.city}, ${property.state}`}
          onClose={() => setShowContactOwnerModal(false)}
        />
      )}
    </div>
  );
}
