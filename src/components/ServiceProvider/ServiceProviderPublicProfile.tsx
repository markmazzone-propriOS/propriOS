import { useState, useEffect } from 'react';
import { useNavigate, useRouter } from '../Navigation/Router';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Star, Briefcase, MapPin, Mail, Phone, Calendar, Award, CheckCircle, Globe, ExternalLink } from 'lucide-react';
import { PropertyMap } from '../Properties/PropertyMap';
import { PhotoGallery } from './PhotoGallery';
import { ContactProviderModal } from './ContactProviderModal';

type ServiceProvider = {
  id: string;
  business_name: string;
  bio: string | null;
  years_experience: number;
  average_rating: number;
  total_reviews: number;
  total_jobs_completed: number;
  logo_url: string | null;
  business_address: string | null;
  business_email: string | null;
  license_number: string | null;
  insurance_verified: boolean;
  service_radius_miles: number;
  business_latitude: number | null;
  business_longitude: number | null;
  profile: {
    full_name: string;
    phone_number: string | null;
  };
  services: {
    category: {
      name: string;
    };
  }[];
};

type Review = {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  created_at: string;
  reviewer: {
    full_name: string;
  };
};

export function ServiceProviderPublicProfile({ providerId }: { providerId: string }) {
  const navigate = useNavigate();
  const { currentRoute } = useRouter();
  const { user, profile } = useAuth();
  const [provider, setProvider] = useState<ServiceProvider | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [showContactModal, setShowContactModal] = useState(false);

  useEffect(() => {
    loadProvider();
    loadReviews();
  }, [providerId]);

  const loadProvider = async () => {
    try {
      const { data, error } = await supabase
        .from('service_provider_profiles')
        .select(`
          id,
          business_name,
          bio,
          years_experience,
          average_rating,
          total_reviews,
          total_jobs_completed,
          logo_url,
          business_address,
          business_email,
          license_number,
          insurance_verified,
          service_radius_miles,
          business_latitude,
          business_longitude,
          profile:profiles(full_name, phone_number),
          services:service_provider_services(
            category:service_categories(name)
          )
        `)
        .eq('id', providerId)
        .maybeSingle();

      if (error) throw error;
      setProvider(data);
    } catch (error) {
      console.error('Error loading provider:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReviews = async () => {
    try {
      const { data, error } = await supabase
        .from('service_provider_reviews')
        .select(`
          id,
          rating,
          title,
          comment,
          created_at,
          is_imported,
          external_source,
          external_url,
          external_reviewer_name,
          reviewer_id,
          reviewer:profiles!service_provider_reviews_reviewer_id_fkey(full_name)
        `)
        .eq('provider_id', providerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReviews(data || []);
    } catch (error) {
      console.error('Error loading reviews:', error);
    } finally {
      setLoadingReviews(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading provider profile...</p>
        </div>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Provider Not Found</h2>
          <p className="text-gray-600 mb-6">The service provider you're looking for doesn't exist.</p>
          <button
            onClick={() => navigate(profile?.user_type === 'property_owner' ? '/property-owner/dashboard' : '/')}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition"
          >
            {profile?.user_type === 'property_owner' ? 'Back to Dashboard' : 'Back to Home'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4">
        <button
          onClick={() => {
            const returnTo = currentRoute.params?.returnTo;
            if (returnTo) {
              navigate(returnTo);
            } else {
              navigate(-1);
            }
          }}
          className="text-blue-600 hover:text-blue-700 mb-6 flex items-center gap-2"
        >
          ← Back
        </button>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-8 text-white">
            <div className="flex items-start gap-6">
              <div className="bg-white rounded-lg p-4 flex-shrink-0">
                {provider.logo_url ? (
                  <img
                    src={provider.logo_url}
                    alt={provider.business_name}
                    className="w-24 h-24 object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <Briefcase size={96} className={`text-blue-600 ${provider.logo_url ? 'hidden' : ''}`} />
              </div>
              <div className="flex-1">
                <h1 className="text-3xl font-bold mb-2">{provider.business_name}</h1>
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Star size={20} className="fill-yellow-400 text-yellow-400" />
                    <span className="text-xl font-semibold">{provider.average_rating.toFixed(1)}</span>
                    <span className="text-blue-100">
                      ({provider.total_reviews} {provider.total_reviews === 1 ? 'review' : 'reviews'})
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 text-blue-100">
                  <div className="flex items-center gap-2">
                    <Briefcase size={18} />
                    <span>{provider.years_experience} years experience</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle size={18} />
                    <span>{provider.total_jobs_completed} jobs completed</span>
                  </div>
                  {provider.insurance_verified && (
                    <div className="flex items-center gap-2">
                      <Award size={18} />
                      <span>Insured & Verified</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">About</h2>
                  {provider.bio ? (
                    <p className="text-gray-700 leading-relaxed">{provider.bio}</p>
                  ) : (
                    <p className="text-gray-500 italic">No description available.</p>
                  )}
                </div>

                {provider.services && provider.services.length > 0 && (
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">Services Offered</h2>
                    <div className="flex flex-wrap gap-3">
                      {provider.services.map((service, idx) => (
                        <span
                          key={idx}
                          className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg font-medium"
                        >
                          {service.category.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {provider.license_number && (
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">Credentials</h2>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-gray-700">
                        <Award size={20} className="text-blue-600" />
                        <span className="font-medium">License #:</span>
                        <span>{provider.license_number}</span>
                      </div>
                    </div>
                  </div>
                )}

                {provider.business_address && provider.business_latitude && provider.business_longitude && (
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">Location</h2>
                    <div className="bg-gray-50 rounded-lg overflow-hidden relative" style={{ height: '300px', zIndex: 1 }}>
                      <PropertyMap
                        lat={provider.business_latitude}
                        lon={provider.business_longitude}
                        address={provider.business_address}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">Photos</h2>
                  <PhotoGallery providerId={provider.id} isEditable={false} />
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">
                    Reviews ({reviews.length})
                  </h2>
                  {loadingReviews ? (
                    <div className="text-center py-8">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  ) : reviews.length === 0 ? (
                    <div className="bg-gray-50 rounded-lg p-8 text-center">
                      <Star size={48} className="mx-auto text-gray-300 mb-3" />
                      <p className="text-gray-500">No reviews yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {reviews.map((review: any) => (
                        <div key={review.id} className="bg-white rounded-lg border border-gray-200 p-6">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="flex items-center gap-1">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <Star
                                      key={star}
                                      size={18}
                                      className={star <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                                    />
                                  ))}
                                </div>
                                <span className="font-semibold text-gray-800">{review.rating}.0</span>
                              </div>
                              <p className="font-medium text-gray-800">
                                {review.is_imported && review.external_reviewer_name
                                  ? review.external_reviewer_name
                                  : review.reviewer?.full_name}
                              </p>
                              <p className="text-sm text-gray-500">
                                {new Date(review.created_at).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </p>
                              {review.is_imported && review.external_source && (
                                <div className="flex items-center gap-2 mt-2">
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
                          </div>
                          {review.title && (
                            <h3 className="font-semibold text-gray-800 mb-2">{review.title}</h3>
                          )}
                          {review.comment && (
                            <p className="text-gray-700 leading-relaxed">{review.comment}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-1">
                <div className="bg-gray-50 rounded-lg p-6 sticky top-8 space-y-6">
                  <h2 className="text-xl font-bold text-gray-800 mb-4">Contact Information</h2>

                  <div className="space-y-4">
                    {provider.profile.phone_number && (
                      <div className="flex items-start gap-3">
                        <Phone size={20} className="text-blue-600 mt-1 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-gray-600">Phone</p>
                          <p className="text-gray-800 font-medium">{provider.profile.phone_number}</p>
                        </div>
                      </div>
                    )}

                    {provider.business_email && (
                      <div className="flex items-start gap-3">
                        <Mail size={20} className="text-blue-600 mt-1 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-gray-600">Email</p>
                          <p className="text-gray-800 font-medium break-all">{provider.business_email}</p>
                        </div>
                      </div>
                    )}

                    {provider.business_address && (
                      <div className="flex items-start gap-3">
                        <MapPin size={20} className="text-blue-600 mt-1 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-gray-600">Address</p>
                          <p className="text-gray-800 font-medium">{provider.business_address}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-3">
                      <MapPin size={20} className="text-blue-600 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-gray-600">Service Area</p>
                        <p className="text-gray-800 font-medium">Within {provider.service_radius_miles} miles</p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowContactModal(true)}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition font-medium flex items-center justify-center gap-2"
                  >
                    <Mail size={20} />
                    Contact Provider
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showContactModal && (
        <ContactProviderModal
          providerId={provider.id}
          providerName={provider.business_name}
          onClose={() => setShowContactModal(false)}
          onSuccess={() => {
            setShowContactModal(false);
            if (user) {
              navigate('/messages');
            }
          }}
        />
      )}
    </div>
  );
}
