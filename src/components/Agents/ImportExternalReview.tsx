import { useState } from 'react';
import { Star, ExternalLink, X, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface ImportExternalReviewProps {
  onClose: () => void;
  onSuccess: () => void;
  reviewType?: 'agent' | 'service_provider' | 'property_owner';
}

const REVIEW_SOURCES = [
  'Google Reviews',
  'Yelp',
  'Zillow',
  'Realtor.com',
  'Trulia',
  'Facebook',
  'LinkedIn',
  'Better Business Bureau',
  'HomeAdvisor',
  'Angie\'s List',
  'Other'
];

export function ImportExternalReview({ onClose, onSuccess, reviewType = 'agent' }: ImportExternalReviewProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    rating: 5,
    comment: '',
    external_source: '',
    external_url: '',
    external_reviewer_name: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.external_source) {
      setError('Please select a review source');
      return;
    }

    if (!formData.comment.trim()) {
      setError('Please enter the review text');
      return;
    }

    if (!formData.external_reviewer_name.trim()) {
      setError('Please enter the reviewer\'s name');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const tableName = reviewType === 'agent' ? 'agent_reviews' :
                        reviewType === 'service_provider' ? 'service_provider_reviews' :
                        'property_owner_reviews';
      const idField = reviewType === 'agent' ? 'agent_id' :
                      reviewType === 'service_provider' ? 'provider_id' :
                      'owner_id';

      const { error: insertError } = await supabase
        .from(tableName)
        .insert({
          [idField]: user.id,
          rating: formData.rating,
          comment: formData.comment.trim(),
          external_source: formData.external_source,
          external_url: formData.external_url.trim() || null,
          external_reviewer_name: formData.external_reviewer_name.trim(),
          is_imported: true,
          imported_at: new Date().toISOString(),
          imported_by: user.id
        });

      if (insertError) throw insertError;

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error importing review:', err);
      setError(err.message || 'Failed to import review');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">Import External Review</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">How to Import Reviews</h3>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Find your review on the external platform (Google, Yelp, etc.)</li>
              <li>Copy the review text exactly as it appears</li>
              <li>Copy the reviewer's name</li>
              <li>Copy the review URL (optional but recommended for verification)</li>
              <li>Paste the information into the form below</li>
            </ol>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Review Source *
            </label>
            <select
              value={formData.external_source}
              onChange={(e) => setFormData({ ...formData, external_source: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Select a source...</option>
              {REVIEW_SOURCES.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reviewer Name *
            </label>
            <input
              type="text"
              value={formData.external_reviewer_name}
              onChange={(e) => setFormData({ ...formData, external_reviewer_name: e.target.value })}
              placeholder="e.g., John Smith"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rating *
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => setFormData({ ...formData, rating })}
                  className="focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                >
                  <Star
                    size={32}
                    className={`${
                      rating <= formData.rating
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    } transition`}
                  />
                </button>
              ))}
              <span className="ml-2 text-lg font-medium text-gray-700">
                {formData.rating} / 5
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Review Text *
            </label>
            <textarea
              value={formData.comment}
              onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
              placeholder="Paste the full review text here..."
              rows={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Copy and paste the review exactly as it appears on the external site
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Original Review URL (Optional)
            </label>
            <input
              type="url"
              value={formData.external_url}
              onChange={(e) => setFormData({ ...formData, external_url: e.target.value })}
              placeholder="https://example.com/review/..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Recommended: Add the link to the original review for verification
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-900 mb-2 flex items-center gap-2">
              <AlertCircle size={18} />
              Important
            </h3>
            <p className="text-sm text-yellow-800">
              Only import legitimate reviews that you actually received on external platforms.
              Fabricating reviews is unethical and may violate terms of service. This feature
              is designed to consolidate your existing reviews in one place.
            </p>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Importing...' : 'Import Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
