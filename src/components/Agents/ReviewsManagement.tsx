import { useState, useEffect } from 'react';
import { Star, ExternalLink, Plus, Calendar, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ImportExternalReview } from './ImportExternalReview';

interface Review {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  external_source?: string;
  external_url?: string;
  external_reviewer_name?: string;
  is_imported: boolean;
  reviewer?: {
    id: string;
    full_name: string | null;
    email: string;
  };
}

export function ReviewsManagement() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [stats, setStats] = useState({
    averageRating: 0,
    totalReviews: 0,
    externalReviews: 0,
    platformReviews: 0
  });

  useEffect(() => {
    if (user) {
      loadReviews();
    }
  }, [user]);

  const loadReviews = async () => {
    if (!user) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('agent_reviews')
        .select(`
          id,
          rating,
          comment,
          created_at,
          external_source,
          external_url,
          external_reviewer_name,
          is_imported,
          reviewer_id,
          profiles!agent_reviews_reviewer_id_fkey (
            id,
            full_name,
            email
          )
        `)
        .eq('agent_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const reviewsData = (data || []).map(review => ({
        ...review,
        reviewer: review.profiles as any
      }));

      setReviews(reviewsData);

      const totalReviews = reviewsData.length;
      const externalReviews = reviewsData.filter(r => r.is_imported).length;
      const platformReviews = totalReviews - externalReviews;
      const averageRating = totalReviews > 0
        ? reviewsData.reduce((sum, r) => sum + r.rating, 0) / totalReviews
        : 0;

      setStats({
        averageRating,
        totalReviews,
        externalReviews,
        platformReviews
      });
    } catch (err) {
      console.error('Error loading reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={16}
            className={
              star <= rating
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300'
            }
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading reviews...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <Star className="text-yellow-500" size={24} />
            <span className="text-3xl font-bold text-gray-800">
              {stats.averageRating.toFixed(1)}
            </span>
          </div>
          <p className="text-gray-600 text-sm">Average Rating</p>
          {renderStars(Math.round(stats.averageRating))}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <Star className="text-blue-500" size={24} />
            <span className="text-3xl font-bold text-gray-800">{stats.totalReviews}</span>
          </div>
          <p className="text-gray-600 text-sm">Total Reviews</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <ExternalLink className="text-green-500" size={24} />
            <span className="text-3xl font-bold text-gray-800">{stats.externalReviews}</span>
          </div>
          <p className="text-gray-600 text-sm">External Reviews</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <User className="text-purple-500" size={24} />
            <span className="text-3xl font-bold text-gray-800">{stats.platformReviews}</span>
          </div>
          <p className="text-gray-600 text-sm">Platform Reviews</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">All Reviews</h2>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus size={20} />
            Import External Review
          </button>
        </div>

        <div className="p-6">
          {reviews.length === 0 ? (
            <div className="text-center py-12">
              <Star size={48} className="text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-800 mb-2">No reviews yet</h3>
              <p className="text-gray-600 mb-6">
                Import your external reviews or wait for clients to leave reviews
              </p>
              <button
                onClick={() => setShowImportModal(true)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Import Your First Review
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="border border-gray-200 rounded-lg p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <User size={20} className="text-gray-400" />
                          <span className="font-semibold text-gray-800">
                            {review.is_imported
                              ? review.external_reviewer_name
                              : review.reviewer?.full_name || 'Anonymous'}
                          </span>
                        </div>
                        {review.is_imported && review.external_source && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                            {review.external_source}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {renderStars(review.rating)}
                        <span className="text-sm text-gray-500 flex items-center gap-1">
                          <Calendar size={14} />
                          {new Date(review.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    {review.is_imported && review.external_url && (
                      <a
                        href={review.external_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                      >
                        View Original
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap">{review.comment}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showImportModal && (
        <ImportExternalReview
          onClose={() => setShowImportModal(false)}
          onSuccess={loadReviews}
          reviewType="agent"
        />
      )}
    </div>
  );
}
