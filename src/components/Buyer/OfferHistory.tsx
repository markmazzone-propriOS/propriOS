import { useState, useEffect } from 'react';
import { Tag, Calendar, DollarSign, Home, Clock, CheckCircle, XCircle, RefreshCw, Ban, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from '../Navigation/Router';

type Offer = {
  id: string;
  property_id: string;
  offer_amount: number;
  offer_status: string;
  financing_type: string;
  closing_date: string;
  message: string;
  contingencies: string;
  counter_amount: number | null;
  counter_message: string | null;
  responded_at: string | null;
  created_at: string;
  property: {
    address_line1: string;
    city: string;
    state: string;
    price: number;
    photos: { photo_url: string }[];
  };
};

type RespondToCounterModalProps = {
  offer: Offer;
  onClose: () => void;
  onSuccess: () => void;
};

function RespondToCounterModal({ offer, onClose, onSuccess }: RespondToCounterModalProps) {
  const [responseType, setResponseType] = useState<'accept' | 'counter' | null>(null);
  const [newOfferAmount, setNewOfferAmount] = useState(offer.counter_amount || 0);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (responseType === 'accept') {
        // Accept the counteroffer
        const { error } = await supabase
          .from('property_offers')
          .update({
            offer_amount: offer.counter_amount,
            offer_status: 'pending',
            message: message || 'Accepted counter offer',
            counter_amount: null,
            counter_message: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', offer.id);

        if (error) throw error;
        alert('Counter offer accepted! Your offer has been updated.');
      } else if (responseType === 'counter') {
        // Make a new counter offer
        const { error } = await supabase
          .from('property_offers')
          .update({
            offer_amount: newOfferAmount,
            offer_status: 'pending',
            message: message || 'New counter offer submitted',
            counter_amount: null,
            counter_message: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', offer.id);

        if (error) throw error;
        alert('New offer submitted successfully!');
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error responding to counter:', err);
      alert('Failed to submit response. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Respond to Counter Offer</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">Counter Offer Details</h3>
            <p className="text-lg font-bold text-blue-600 mb-2">
              ${offer.counter_amount?.toLocaleString()}
            </p>
            {offer.counter_message && (
              <p className="text-sm text-blue-800">{offer.counter_message}</p>
            )}
          </div>

          <div className="mb-6">
            <p className="text-sm text-gray-600 mb-4">
              Your original offer: <span className="font-semibold">${offer.offer_amount.toLocaleString()}</span>
            </p>
            <p className="text-sm text-gray-600 mb-4">
              Choose how you'd like to respond:
            </p>

            <div className="space-y-3 mb-6">
              <button
                onClick={() => setResponseType('accept')}
                className={`w-full p-4 rounded-lg border-2 text-left transition ${
                  responseType === 'accept'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-green-300'
                }`}
              >
                <div className="font-semibold text-gray-900 mb-1">Accept Counter Offer</div>
                <div className="text-sm text-gray-600">
                  Accept the seller's counter offer of ${offer.counter_amount?.toLocaleString()}
                </div>
              </button>

              <button
                onClick={() => setResponseType('counter')}
                className={`w-full p-4 rounded-lg border-2 text-left transition ${
                  responseType === 'counter'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <div className="font-semibold text-gray-900 mb-1">Make New Offer</div>
                <div className="text-sm text-gray-600">
                  Submit a different offer amount
                </div>
              </button>
            </div>

            {responseType === 'counter' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Offer Amount *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    value={newOfferAmount}
                    onChange={(e) => setNewOfferAmount(parseFloat(e.target.value))}
                    min="0"
                    step="1000"
                    required
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {responseType && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message (Optional)
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  placeholder="Add a message to the seller..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={submitting}
              className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!responseType || submitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit Response'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function OfferHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [cancellingOfferId, setCancellingOfferId] = useState<string | null>(null);
  const [respondingToOffer, setRespondingToOffer] = useState<Offer | null>(null);

  useEffect(() => {
    if (user) {
      loadOffers();
    }
  }, [user]);

  const loadOffers = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('property_offers')
        .select(`
          *,
          property:properties!property_id (
            address_line1,
            city,
            state,
            price,
            photos:property_photos(photo_url)
          )
        `)
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOffers(data || []);
    } catch (err) {
      console.error('Error loading offers:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="text-yellow-500" size={20} />;
      case 'accepted':
        return <CheckCircle className="text-green-500" size={20} />;
      case 'rejected':
        return <XCircle className="text-red-500" size={20} />;
      case 'countered':
        return <RefreshCw className="text-blue-500" size={20} />;
      case 'withdrawn':
        return <Ban className="text-gray-500" size={20} />;
      default:
        return <Clock className="text-gray-500" size={20} />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'accepted':
        return 'Accepted';
      case 'rejected':
        return 'Rejected';
      case 'countered':
        return 'Countered';
      case 'withdrawn':
        return 'Withdrawn';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'accepted':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'countered':
        return 'bg-blue-100 text-blue-800';
      case 'withdrawn':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleCancelOffer = async (offerId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm('Are you sure you want to cancel this offer? This action cannot be undone.')) {
      return;
    }

    setCancellingOfferId(offerId);
    try {
      const { error } = await supabase
        .from('property_offers')
        .update({
          offer_status: 'withdrawn',
          updated_at: new Date().toISOString()
        })
        .eq('id', offerId);

      if (error) throw error;

      await loadOffers();
      alert('Offer cancelled successfully');
    } catch (err) {
      console.error('Error cancelling offer:', err);
      alert('Failed to cancel offer. Please try again.');
    } finally {
      setCancellingOfferId(null);
    }
  };

  const filteredOffers = offers.filter(offer => {
    if (filter === 'all') return true;
    return offer.offer_status === filter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading your offers...</div>
      </div>
    );
  }

  return (
    <>
      {respondingToOffer && (
        <RespondToCounterModal
          offer={respondingToOffer}
          onClose={() => setRespondingToOffer(null)}
          onSuccess={loadOffers}
        />
      )}

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Offers</h1>
          <p className="text-gray-600">Track all your property offers in one place</p>
        </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-md font-medium transition ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All ({offers.length})
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`px-4 py-2 rounded-md font-medium transition ${
            filter === 'pending'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Pending ({offers.filter(o => o.offer_status === 'pending').length})
        </button>
        <button
          onClick={() => setFilter('countered')}
          className={`px-4 py-2 rounded-md font-medium transition ${
            filter === 'countered'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Countered ({offers.filter(o => o.offer_status === 'countered').length})
        </button>
        <button
          onClick={() => setFilter('accepted')}
          className={`px-4 py-2 rounded-md font-medium transition ${
            filter === 'accepted'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Accepted ({offers.filter(o => o.offer_status === 'accepted').length})
        </button>
      </div>

      {filteredOffers.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <Tag size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Offers Yet</h3>
          <p className="text-gray-600 mb-4">
            {filter === 'all'
              ? "You haven't made any offers yet. Browse properties and make your first offer!"
              : `You don't have any ${filter} offers.`}
          </p>
          <button
            onClick={() => navigate('/')}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition"
          >
            Browse Properties
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOffers.map((offer) => (
            <div
              key={offer.id}
              className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition cursor-pointer"
              onClick={() => navigate(`/property/${offer.property_id}`)}
            >
              <div className="flex flex-col md:flex-row">
                <div className="md:w-64 h-48 md:h-auto flex-shrink-0">
                  <img
                    src={offer.property.photos[0]?.photo_url || 'https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg?auto=compress&cs=tinysrgb&w=800'}
                    alt={offer.property.address_line1}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-1">
                        {offer.property.address_line1}
                      </h3>
                      <p className="text-gray-600">
                        {offer.property.city}, {offer.property.state}
                      </p>
                    </div>
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${getStatusColor(offer.offer_status)}`}>
                      {getStatusIcon(offer.offer_status)}
                      <span className="font-semibold text-sm">
                        {getStatusText(offer.offer_status)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="flex items-center gap-2">
                      <Home size={18} className="text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">List Price</p>
                        <p className="font-semibold text-gray-900">
                          ${offer.property.price.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <DollarSign size={18} className="text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Your Offer</p>
                        <p className="font-semibold text-blue-600">
                          ${offer.offer_amount.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Calendar size={18} className="text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Closing Date</p>
                        <p className="font-semibold text-gray-900">
                          {new Date(offer.closing_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {offer.offer_status === 'countered' && offer.counter_amount && (
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-blue-900 mb-1">
                            Counter Offer: ${offer.counter_amount.toLocaleString()}
                          </p>
                          {offer.counter_message && (
                            <p className="text-sm text-blue-800 mb-3">{offer.counter_message}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRespondingToOffer(offer);
                        }}
                        className="w-full mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition font-medium"
                      >
                        Respond to Counter Offer
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>Submitted {new Date(offer.created_at).toLocaleDateString()}</span>
                    <div className="flex items-center gap-4">
                      <span className="capitalize">{offer.financing_type} financing</span>
                      {offer.offer_status === 'pending' && (
                        <button
                          onClick={(e) => handleCancelOffer(offer.id, e)}
                          disabled={cancellingOfferId === offer.id}
                          className="px-4 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          {cancellingOfferId === offer.id ? 'Cancelling...' : 'Cancel Offer'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </>
  );
}
