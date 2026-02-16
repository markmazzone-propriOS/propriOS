import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Star, User, Calendar, MessageSquare, TrendingUp, BarChart3, ArrowLeft, Plus, Globe, ExternalLink } from 'lucide-react';
import { useNavigate } from '../Navigation/Router';
import { ImportExternalReview } from '../Agents/ImportExternalReview';

type Review = {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  is_imported?: boolean;
  external_source?: string | null;
  external_url?: string | null;
  external_reviewer_name?: string | null;
  reviewer: {
    full_name: string;
    user_type: string;
  };
};

type ReviewStats = {
  totalReviews: number;
  averageRating: number;
  ratingDistribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
};

export function ReviewsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats>({
    totalReviews: 0,
    averageRating: 0,
    ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 1 | 2 | 3 | 4 | 5>('all');
  const [showImportReview, setShowImportReview] = useState(false);

  useEffect(() => {
    if (user) {
      loadReviews();
    }
  }, [user]);

  const loadReviews = async () => {
    if (!user) return;

    try {
      setLoading(true);

      const { data: reviewsData, error: reviewsError } = await supabase
        .from('service_provider_reviews')
        .select(`
          id,
          rating,
          title,
          comment,
          created_at,
          reviewer_id,
          is_imported,
          external_source,
          external_url,
          external_reviewer_name
        `)
        .eq('provider_id', user.id)
        .order('created_at', { ascending: false });

      if (reviewsError) throw reviewsError;

      const formattedReviews = reviewsData?.map((review: any) => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        created_at: review.created_at,
        is_imported: review.is_imported,
        external_source: review.external_source,
        external_url: review.external_url,
        external_reviewer_name: review.external_reviewer_name,
        reviewer: {
          full_name: review.is_imported && review.external_reviewer_name ? review.external_reviewer_name : 'Customer',
          user_type: 'customer',
        },
      })) || [];

      setReviews(formattedReviews);

      const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      let totalRating = 0;

      formattedReviews.forEach((review) => {
        const rating = Math.round(review.rating) as 1 | 2 | 3 | 4 | 5;
        distribution[rating]++;
        totalRating += review.rating;
      });

      setStats({
        totalReviews: formattedReviews.length,
        averageRating: formattedReviews.length > 0 ? totalRating / formattedReviews.length : 0,
        ratingDistribution: distribution,
      });
    } catch (error: any) {
      console.error('Error loading reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredReviews = filter === 'all'
    ? reviews
    : reviews.filter((review) => Math.round(review.rating) === filter);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={20}
            className={star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
          />
        ))}
      </div>
    );
  };

  const getProgressPercentage = (count: number) => {
    return stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="bg-white shadow-sm border-b mb-8 -mx-4 px-4 py-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-gray-600 hover:text-blue-600 transition"
            title="Back to Dashboard"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Ratings & Reviews</h1>
            <p className="text-gray-600 mt-1">View and manage your customer reviews</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6 sticky top-4">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <BarChart3 size={24} className="text-blue-600" />
              Review Summary
            </h2>

            <div className="text-center mb-6 pb-6 border-b">
              <div className="text-5xl font-bold text-gray-800 mb-2">
                {stats.averageRating.toFixed(1)}
              </div>
              <div className="flex justify-center mb-2">
                {renderStars(Math.round(stats.averageRating))}
              </div>
              <div className="text-gray-600">
                Based on {stats.totalReviews} {stats.totalReviews === 1 ? 'review' : 'reviews'}
              </div>
            </div>

            <div className="space-y-3 mb-6">
              {[5, 4, 3, 2, 1].map((rating) => (
                <button
                  key={rating}
                  onClick={() => setFilter(filter === rating ? 'all' : rating as 1 | 2 | 3 | 4 | 5)}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg transition ${
                    filter === rating ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-1 w-12">
                    <span className="text-sm font-medium text-gray-700">{rating}</span>
                    <Star size={16} className="fill-yellow-400 text-yellow-400" />
                  </div>
                  <div className="flex-1">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-yellow-400 h-2 rounded-full transition-all"
                        style={{ width: `${getProgressPercentage(stats.ratingDistribution[rating as keyof typeof stats.ratingDistribution])}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 w-12 text-right">
                    {stats.ratingDistribution[rating as keyof typeof stats.ratingDistribution]}
                  </div>
                </button>
              ))}
            </div>

            {filter !== 'all' && (
              <button
                onClick={() => setFilter('all')}
                className="w-full py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm font-medium"
              >
                Show All Reviews
              </button>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <MessageSquare size={24} className="text-blue-600" />
                  Customer Reviews
                  {filter !== 'all' && (
                    <span className="text-sm font-normal text-gray-600">
                      (Filtered by {filter} stars)
                    </span>
                  )}
                </h2>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-600">
                    {filteredReviews.length} {filteredReviews.length === 1 ? 'review' : 'reviews'}
                  </div>
                  <button
                    onClick={() => setShowImportReview(true)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium text-sm"
                  >
                    <Plus size={18} />
                    Import Review
                  </button>
                </div>
              </div>
            </div>

            <div className="divide-y">
              {filteredReviews.length === 0 ? (
                <div className="p-12 text-center">
                  <Star size={48} className="mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    {filter === 'all' ? 'No reviews yet' : `No ${filter}-star reviews`}
                  </h3>
                  <p className="text-gray-600">
                    {filter === 'all'
                      ? 'Your customer reviews will appear here once clients start rating your services.'
                      : `You don't have any ${filter}-star reviews yet.`}
                  </p>
                </div>
              ) : (
                filteredReviews.map((review) => (
                  <div key={review.id} className="p-6 hover:bg-gray-50 transition">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                          <User size={24} className="text-blue-600" />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-800">
                            {review.reviewer.full_name}
                          </div>
                          <div className="text-sm text-gray-500 capitalize">
                            {review.reviewer.user_type.replace('_', ' ')}
                          </div>
                          {review.is_imported && review.external_source && (
                            <div className="flex items-center gap-2 mt-1">
                              <Globe size={14} className="text-blue-600" />
                              <span className="text-xs text-gray-600">
                                From <span className="font-medium text-blue-600">{review.external_source}</span>
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
                      <div className="text-right">
                        <div className="flex items-center gap-2 mb-1">
                          {renderStars(review.rating)}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <Calendar size={12} />
                          {formatDate(review.created_at)}
                        </div>
                      </div>
                    </div>

                    {review.comment && (
                      <div className="ml-15 pl-6 border-l-2 border-gray-200">
                        <p className="text-gray-700 leading-relaxed">{review.comment}</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {showImportReview && (
        <ImportExternalReview
          onClose={() => setShowImportReview(false)}
          onSuccess={loadReviews}
          reviewType="service_provider"
        />
      )}
    </div>
  );
}
