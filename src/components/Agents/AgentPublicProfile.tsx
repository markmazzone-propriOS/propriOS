import { useState, useEffect } from 'react';
import { MapPin, Star, Mail, Calendar, Languages, Video, Users, Building2, ArrowLeft, MessageSquare, Globe, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from '../Navigation/Router';
import { PropertyCard } from '../Properties/PropertyCard';
import { PropertyMap } from '../Properties/PropertyMap';
import { ReviewForm } from './ReviewForm';
import { ContactAgentModal } from './ContactAgentModal';
import type { Property } from '../../lib/supabase';

type AgentProfile = {
  id: string;
  license_number: string;
  bio: string;
  star_rating: number;
  languages: string[];
  locations: string[];
  meet_in_person: boolean;
  video_chat: boolean;
  profile_photo_url: string | null;
  profile: {
    id: string;
    full_name: string;
    phone_number: string;
  };
};

type PropertyWithPhotos = Property & {
  photos?: { photo_url: string }[];
};

type Review = {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  reviewer: {
    full_name: string;
  };
};

interface AgentPublicProfileProps {
  agentId: string;
}

export function AgentPublicProfile({ agentId }: AgentPublicProfileProps) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [activeListings, setActiveListings] = useState<PropertyWithPhotos[]>([]);
  const [soldListings, setSoldListings] = useState<PropertyWithPhotos[]>([]);
  const [rentedListings, setRentedListings] = useState<PropertyWithPhotos[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [userReview, setUserReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'sold' | 'rented'>('active');
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);

  useEffect(() => {
    loadAgentProfile();
  }, [agentId]);

  const loadAgentProfile = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadAgentDetails(),
        loadAgentListings(),
        loadAgentReviews(),
      ]);
    } catch (error) {
      console.error('Error loading agent profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAgentDetails = async () => {
    const { data, error } = await supabase
      .from('agent_profiles')
      .select(`
        *,
        profile:profiles!agent_profiles_id_fkey(id, full_name, phone_number)
      `)
      .eq('id', agentId)
      .maybeSingle();

    if (error) throw error;
    setAgent(data);
  };

  const loadAgentListings = async () => {
    const { data: activeData, error: activeError } = await supabase
      .from('properties')
      .select(`
        *,
        photos:property_photos(photo_url)
      `)
      .eq('agent_id', agentId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (activeError) throw activeError;
    setActiveListings(activeData || []);

    const { data: soldData, error: soldError } = await supabase
      .from('properties')
      .select(`
        *,
        photos:property_photos(photo_url)
      `)
      .eq('agent_id', agentId)
      .eq('status', 'sold')
      .order('updated_at', { ascending: false });

    if (soldError) throw soldError;
    setSoldListings(soldData || []);

    const { data: rentedData, error: rentedError } = await supabase
      .from('properties')
      .select(`
        *,
        photos:property_photos(photo_url)
      `)
      .eq('agent_id', agentId)
      .eq('status', 'rented')
      .order('updated_at', { ascending: false });

    if (rentedError) throw rentedError;
    setRentedListings(rentedData || []);
  };

  const loadAgentReviews = async () => {
    const { data, error } = await supabase
      .from('agent_reviews')
      .select(`
        id,
        rating,
        comment,
        created_at,
        reviewer_id,
        is_imported,
        external_source,
        external_url,
        external_reviewer_name,
        reviewer:profiles!agent_reviews_reviewer_id_fkey(full_name)
      `)
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading reviews:', error);
      setReviews([]);
      return;
    }

    const allReviews = data || [];

    if (user) {
      const myReview = allReviews.find(r => (r as any).reviewer_id === user.id);
      if (myReview) {
        setUserReview(myReview);
      }
    }

    setReviews(allReviews);
  };

  const handleReviewSuccess = () => {
    setShowReviewForm(false);
    loadAgentReviews();
    loadAgentDetails();
  };

  const canLeaveReview = () => {
    if (!user || !profile) return false;
    const allowedUserTypes = ['buyer', 'seller', 'service_provider', 'mortgage_lender', 'property_owner'];
    if (!allowedUserTypes.includes(profile.user_type)) return false;
    if (user.id === agentId) return false;
    return true;
  };

  const handleContactAgent = () => {
    if (user) {
      navigate(`/messages?new=${agentId}`);
    } else {
      setShowContactModal(true);
    }
  };

  const getCurrentListings = () => {
    switch (activeTab) {
      case 'active':
        return activeListings;
      case 'sold':
        return soldListings;
      case 'rented':
        return rentedListings;
      default:
        return [];
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Agent not found</h2>
          <button
            onClick={() => navigate('/')}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Return to home
          </button>
        </div>
      </div>
    );
  }

  const currentListings = getCurrentListings();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4 transition"
          >
            <ArrowLeft size={20} />
            <span>Back to Home</span>
          </button>

          <div className="flex flex-col md:flex-row gap-6 items-start">
            {agent.profile_photo_url ? (
              <img
                src={agent.profile_photo_url}
                alt={agent.profile.full_name}
                className="w-32 h-32 rounded-full object-cover"
              />
            ) : (
              <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center">
                <span className="text-4xl font-bold text-gray-500">
                  {agent.profile.full_name.charAt(0)}
                </span>
              </div>
            )}

            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                {agent.profile.full_name}
              </h1>
              <p className="text-gray-600 mb-3">License: {agent.license_number}</p>

              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-1">
                  <Star size={20} className="text-yellow-500 fill-current" />
                  <span className="font-medium text-gray-700">
                    {Number(agent.star_rating).toFixed(1)}
                  </span>
                  <span className="text-gray-500 text-sm">
                    ({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <MapPin size={16} className="text-gray-400" />
                  <span>{agent.locations?.join(', ')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Languages size={16} className="text-gray-400" />
                  <span>{agent.languages?.join(', ')}</span>
                </div>
                {agent.meet_in_person && (
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-gray-400" />
                    <span>In-person meetings</span>
                  </div>
                )}
                {agent.video_chat && (
                  <div className="flex items-center gap-2">
                    <Video size={16} className="text-gray-400" />
                    <span>Video chat</span>
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={handleContactAgent}
                  className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition font-medium"
                >
                  <Mail size={18} />
                  Contact Agent
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {agent.bio && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">About</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{agent.bio}</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Statistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Building2 className="text-blue-600" size={24} />
                <span className="text-3xl font-bold text-gray-800">
                  {activeListings.length}
                </span>
              </div>
              <p className="text-gray-600">Active Listings</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Building2 className="text-green-600" size={24} />
                <span className="text-3xl font-bold text-gray-800">
                  {soldListings.length}
                </span>
              </div>
              <p className="text-gray-600">Sold Properties</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Building2 className="text-purple-600" size={24} />
                <span className="text-3xl font-bold text-gray-800">
                  {rentedListings.length}
                </span>
              </div>
              <p className="text-gray-600">Rented Properties</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              Reviews ({reviews.length})
            </h2>
            {canLeaveReview() ? (
              <button
                onClick={() => setShowReviewForm(true)}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition font-medium"
              >
                <MessageSquare size={18} />
                {userReview ? 'Edit Review' : 'Write Review'}
              </button>
            ) : !user ? (
              <p className="text-sm text-gray-500 italic">Sign in to leave a review</p>
            ) : null}
          </div>

          {reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.map((review: any) => (
                <div key={review.id} className="border-b border-gray-200 pb-4 last:border-0">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              size={16}
                              className={
                                i < review.rating
                                  ? 'text-yellow-500 fill-current'
                                  : 'text-gray-300'
                              }
                            />
                          ))}
                        </div>
                        <span className="font-medium text-gray-700">
                          {review.is_imported && review.external_reviewer_name
                            ? review.external_reviewer_name
                            : review.reviewer?.full_name}
                        </span>
                        <span className="text-sm text-gray-500">
                          {new Date(review.created_at).toLocaleDateString()}
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
                    </div>
                    {user && !review.is_imported && review.reviewer_id === user.id && (
                      <button
                        onClick={() => setShowReviewForm(true)}
                        className="text-sm text-blue-600 hover:text-blue-700 flex-shrink-0"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  {review.comment && (
                    <p className="text-gray-700">{review.comment}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 text-center py-8">
              No reviews yet. Be the first to review this agent!
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Listings</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-4 py-2 rounded-md transition font-medium ${
                  viewMode === 'grid'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                List View
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={`px-4 py-2 rounded-md transition font-medium ${
                  viewMode === 'map'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Map View
              </button>
            </div>
          </div>

          <div className="flex gap-2 mb-6 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('active')}
              className={`px-4 py-2 font-medium transition ${
                activeTab === 'active'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Active ({activeListings.length})
            </button>
            <button
              onClick={() => setActiveTab('sold')}
              className={`px-4 py-2 font-medium transition ${
                activeTab === 'sold'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Sold ({soldListings.length})
            </button>
            <button
              onClick={() => setActiveTab('rented')}
              className={`px-4 py-2 font-medium transition ${
                activeTab === 'rented'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Rented ({rentedListings.length})
            </button>
          </div>

          {viewMode === 'grid' ? (
            currentListings.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {currentListings.map((property) => (
                  <PropertyCard key={property.id} property={property} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-600">
                <p>No {activeTab} listings</p>
              </div>
            )
          ) : (
            <div className="h-[600px] rounded-lg overflow-hidden">
              {currentListings.length > 0 ? (
                currentListings.some(p => p.latitude != null && p.longitude != null) ? (
                  <PropertyMap properties={currentListings} />
                ) : (
                  <div className="h-full flex items-center justify-center bg-gray-100 text-gray-600">
                    <p>Properties don't have location data to display on map</p>
                  </div>
                )
              ) : (
                <div className="h-full flex items-center justify-center bg-gray-100 text-gray-600">
                  <p>No {activeTab} listings to display on map</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showReviewForm && (
        <ReviewForm
          agentId={agentId}
          existingReview={userReview ? {
            id: userReview.id,
            rating: userReview.rating,
            comment: userReview.comment
          } : null}
          onSuccess={handleReviewSuccess}
          onCancel={() => setShowReviewForm(false)}
        />
      )}

      {showContactModal && agent && (
        <ContactAgentModal
          agentId={agentId}
          agentName={agent.profile.full_name}
          onClose={() => setShowContactModal(false)}
          onSuccess={() => {
            setShowContactModal(false);
            alert('Your message has been sent! The agent will contact you soon.');
          }}
        />
      )}
    </div>
  );
}
