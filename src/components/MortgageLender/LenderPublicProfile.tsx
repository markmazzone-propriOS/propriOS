import { useState, useEffect } from 'react';
import { useNavigate, useRouter } from '../Navigation/Router';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Star, Building2, MapPin, Mail, Phone, Globe, Award, DollarSign, TrendingUp, CheckCircle } from 'lucide-react';
import { ContactLenderModal } from './ContactLenderModal';

type MortgageLender = {
  id: string;
  company_name: string;
  nmls_number: string | null;
  logo_url: string | null;
  bio: string | null;
  website_url: string | null;
  phone_number: string | null;
  email: string | null;
  minimum_credit_score: number | null;
  interest_rate_range: string | null;
  loan_types: string[];
  years_experience: number;
  total_loans_closed: number;
  average_rating: number;
  profile: {
    full_name: string;
  };
};

type Review = {
  id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  reviewer: {
    full_name: string;
  };
};

export function LenderPublicProfile({ lenderId }: { lenderId: string }) {
  const navigate = useNavigate();
  const { currentRoute } = useRouter();
  const { user, profile } = useAuth();
  const [lender, setLender] = useState<MortgageLender | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [showContactModal, setShowContactModal] = useState(false);

  useEffect(() => {
    loadLender();
    loadReviews();
  }, [lenderId]);

  const loadLender = async () => {
    try {
      const { data, error } = await supabase
        .from('mortgage_lender_profiles')
        .select(`
          id,
          company_name,
          nmls_number,
          logo_url,
          bio,
          website_url,
          phone_number,
          email,
          minimum_credit_score,
          interest_rate_range,
          loan_types,
          years_experience,
          total_loans_closed,
          average_rating,
          profile:profiles(full_name)
        `)
        .eq('id', lenderId)
        .maybeSingle();

      if (error) throw error;
      setLender(data);
    } catch (error) {
      console.error('Error loading lender:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReviews = async () => {
    try {
      const { data, error } = await supabase
        .from('lender_reviews')
        .select(`
          id,
          rating,
          review_text,
          created_at,
          reviewer:profiles!lender_reviews_reviewer_id_fkey(full_name)
        `)
        .eq('lender_id', lenderId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReviews(data || []);
    } catch (error) {
      console.error('Error loading reviews:', error);
    } finally {
      setLoadingReviews(false);
    }
  };

  const handleContact = () => {
    setShowContactModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading lender profile...</p>
        </div>
      </div>
    );
  }

  if (!lender) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Lender Not Found</h2>
          <p className="text-gray-600 mb-6">The mortgage lender you're looking for doesn't exist.</p>
          <button
            onClick={() => navigate('/')}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition"
          >
            Back to Home
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
          <div className="bg-gradient-to-r from-green-600 to-green-800 p-8 text-white">
            <div className="flex items-start gap-6">
              <div className="bg-white rounded-lg p-4 flex-shrink-0">
                {lender.logo_url ? (
                  <img
                    src={lender.logo_url}
                    alt={lender.company_name}
                    className="w-24 h-24 object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <Building2 size={96} className={`text-green-600 ${lender.logo_url ? 'hidden' : ''}`} />
              </div>
              <div className="flex-1">
                <h1 className="text-3xl font-bold mb-2">{lender.company_name}</h1>
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Star size={20} className="fill-yellow-400 text-yellow-400" />
                    <span className="text-xl font-semibold">{lender.average_rating.toFixed(1)}</span>
                    <span className="text-green-100">
                      ({lender.total_loans_closed} loans closed)
                    </span>
                  </div>
                </div>
                {lender.nmls_number && (
                  <div className="flex items-center gap-2 text-green-100 mb-2">
                    <Award size={18} />
                    <span>NMLS# {lender.nmls_number}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-green-100">
                  <CheckCircle size={18} />
                  <span>{lender.years_experience} years of experience</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div>
                <h2 className="text-xl font-bold text-gray-800 mb-4">Contact Information</h2>
                <div className="space-y-3">
                  {lender.phone_number && (
                    <div className="flex items-center gap-3 text-gray-700">
                      <Phone size={18} className="text-gray-400" />
                      <a href={`tel:${lender.phone_number}`} className="hover:text-blue-600">
                        {lender.phone_number}
                      </a>
                    </div>
                  )}
                  {lender.email && (
                    <div className="flex items-center gap-3 text-gray-700">
                      <Mail size={18} className="text-gray-400" />
                      <a href={`mailto:${lender.email}`} className="hover:text-blue-600">
                        {lender.email}
                      </a>
                    </div>
                  )}
                  {lender.website_url && (
                    <div className="flex items-center gap-3 text-gray-700">
                      <Globe size={18} className="text-gray-400" />
                      <a
                        href={lender.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-blue-600"
                      >
                        Visit Website
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h2 className="text-xl font-bold text-gray-800 mb-4">Loan Details</h2>
                <div className="space-y-3">
                  {lender.minimum_credit_score && (
                    <div className="flex items-center gap-3 text-gray-700">
                      <TrendingUp size={18} className="text-gray-400" />
                      <span>Min. Credit Score: {lender.minimum_credit_score}</span>
                    </div>
                  )}
                  {lender.interest_rate_range && (
                    <div className="flex items-center gap-3 text-gray-700">
                      <DollarSign size={18} className="text-gray-400" />
                      <span>Interest Rates: {lender.interest_rate_range}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {lender.bio && (
              <div className="mb-8">
                <h2 className="text-xl font-bold text-gray-800 mb-4">About</h2>
                <p className="text-gray-700 leading-relaxed">{lender.bio}</p>
              </div>
            )}

            {lender.loan_types && lender.loan_types.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Loan Types Offered</h2>
                <div className="flex flex-wrap gap-2">
                  {lender.loan_types.map((loanType, idx) => (
                    <span
                      key={idx}
                      className="px-4 py-2 bg-green-50 text-green-700 rounded-full text-sm font-medium"
                    >
                      {loanType}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-6 border-t border-gray-200">
              <button
                onClick={handleContact}
                className="w-full bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 transition font-medium text-lg"
              >
                Contact Lender
              </button>
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <div className="mt-8 bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Reviews</h2>
            {loadingReviews ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : reviews.length > 0 ? (
              <div className="space-y-6">
                {reviews.map((review) => (
                  <div key={review.id} className="border-b border-gray-200 pb-6 last:border-0">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-100 rounded-full w-10 h-10 flex items-center justify-center">
                          <span className="text-blue-600 font-semibold">
                            {review.reviewer.full_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">{review.reviewer.full_name}</p>
                          <p className="text-sm text-gray-500">
                            {new Date(review.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            size={16}
                            className={i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                          />
                        ))}
                      </div>
                    </div>
                    {review.review_text && (
                      <p className="text-gray-700 leading-relaxed">{review.review_text}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 text-center py-8">No reviews yet</p>
            )}
          </div>
        </div>
      </div>

      {showContactModal && lender && (
        <ContactLenderModal
          lenderId={lender.id}
          lenderName={lender.company_name}
          onClose={() => setShowContactModal(false)}
        />
      )}
    </div>
  );
}
