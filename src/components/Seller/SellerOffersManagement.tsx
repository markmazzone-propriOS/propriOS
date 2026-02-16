import { useState, useEffect } from 'react';
import {
  Tag, Calendar, DollarSign, FileText, CheckCircle, XCircle,
  Clock, MessageSquare, TrendingUp, Home, User, Mail, Trash2, ArrowLeft,
  LayoutGrid, List, Calculator, TrendingDown
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from '../Navigation/Router';

type PropertyOffer = {
  id: string;
  property_id: string;
  buyer_id: string;
  offer_amount: number;
  offer_status: string;
  message: string;
  contingencies: string;
  financing_type: string;
  closing_date: string;
  counter_amount: number | null;
  counter_message: string;
  commission_percent: number;
  responded_at: string | null;
  created_at: string;
  property: {
    address_line1: string;
    city: string;
    state: string;
    price: number;
    photos: { photo_url: string }[];
  };
  buyer: {
    full_name: string;
    phone_number: string | null;
  };
};

type PropertyWithOffers = {
  property_id: string;
  property: PropertyOffer['property'];
  offers: PropertyOffer[];
};

type SellerOffersManagementProps = {
  propertyId?: string;
};

export function SellerOffersManagement({ propertyId }: SellerOffersManagementProps = {}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [offers, setOffers] = useState<PropertyOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected' | 'countered' | 'withdrawn'>('all');
  const [selectedOffer, setSelectedOffer] = useState<PropertyOffer | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [counterAmount, setCounterAmount] = useState('');
  const [counterMessage, setCounterMessage] = useState('');
  const [showCounterForm, setShowCounterForm] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grouped'>('grouped');
  const [expandedProperty, setExpandedProperty] = useState<string | null>(null);
  const [editingCommission, setEditingCommission] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    if (user) {
      loadOffers();

      const channel = supabase
        .channel('seller-offers')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'property_offers',
          },
          () => {
            loadOffers();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, propertyId]);

  const loadOffers = async () => {
    if (!user) return;

    try {
      let query = supabase
        .from('property_offers')
        .select(`
          *,
          property:properties(
            address_line1,
            city,
            state,
            price,
            photos:property_photos(photo_url)
          ),
          buyer:profiles!property_offers_buyer_id_fkey(
            full_name,
            phone_number
          )
        `);

      // Filter by property if propertyId is provided
      if (propertyId) {
        query = query.eq('property_id', propertyId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      setOffers(data || []);
    } catch (err) {
      console.error('Error loading offers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptOffer = async (offerId: string) => {
    if (!confirm('Are you sure you want to accept this offer? This action cannot be undone.')) {
      return;
    }

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('property_offers')
        .update({
          offer_status: 'accepted',
          responded_at: new Date().toISOString(),
        })
        .eq('id', offerId);

      if (error) throw error;

      await loadOffers();
      setSelectedOffer(null);
    } catch (err) {
      console.error('Error accepting offer:', err);
      alert('Failed to accept offer');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectOffer = async (offerId: string) => {
    if (!confirm('Are you sure you want to reject this offer?')) {
      return;
    }

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('property_offers')
        .update({
          offer_status: 'rejected',
          responded_at: new Date().toISOString(),
        })
        .eq('id', offerId);

      if (error) throw error;

      await loadOffers();
      setSelectedOffer(null);
    } catch (err) {
      console.error('Error rejecting offer:', err);
      alert('Failed to reject offer');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCounterOffer = async (offerId: string) => {
    if (!counterAmount || parseFloat(counterAmount) <= 0) {
      alert('Please enter a valid counter offer amount');
      return;
    }

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('property_offers')
        .update({
          offer_status: 'countered',
          counter_amount: parseFloat(counterAmount),
          counter_message: counterMessage,
          responded_at: new Date().toISOString(),
        })
        .eq('id', offerId);

      if (error) throw error;

      await loadOffers();
      setSelectedOffer(null);
      setShowCounterForm(false);
      setCounterAmount('');
      setCounterMessage('');
    } catch (err) {
      console.error('Error countering offer:', err);
      alert('Failed to counter offer');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteOffer = async (offerId: string) => {
    if (!confirm('Are you sure you want to delete this offer? This action cannot be undone.')) {
      return;
    }

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('property_offers')
        .delete()
        .eq('id', offerId);

      if (error) throw error;

      await loadOffers();
      setSelectedOffer(null);
    } catch (err) {
      console.error('Error deleting offer:', err);
      alert('Failed to delete offer. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
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

  const filteredOffers = offers.filter(offer =>
    filter === 'all' || offer.offer_status === filter
  );

  // Group offers by property
  const groupedOffers: PropertyWithOffers[] = [];
  const propertyMap = new Map<string, PropertyWithOffers>();

  filteredOffers.forEach(offer => {
    if (!propertyMap.has(offer.property_id)) {
      propertyMap.set(offer.property_id, {
        property_id: offer.property_id,
        property: offer.property,
        offers: []
      });
    }
    propertyMap.get(offer.property_id)!.offers.push(offer);
  });

  propertyMap.forEach(value => groupedOffers.push(value));

  // Sort properties by number of offers (descending)
  groupedOffers.sort((a, b) => b.offers.length - a.offers.length);

  // Calculate net proceeds
  const calculateNetProceeds = (amount: number, commission_percent: number) => {
    const commission = amount * (commission_percent / 100);
    return amount - commission;
  };

  // Update commission percentage for an offer
  const updateCommission = async (offerId: string, newPercent: number) => {
    try {
      const { error } = await supabase
        .from('property_offers')
        .update({ commission_percent: newPercent })
        .eq('id', offerId);

      if (error) throw error;

      // Update local state
      setOffers(offers.map(offer =>
        offer.id === offerId
          ? { ...offer, commission_percent: newPercent }
          : offer
      ));

      // Clear editing state
      const newEditing = { ...editingCommission };
      delete newEditing[offerId];
      setEditingCommission(newEditing);
    } catch (err) {
      console.error('Error updating commission:', err);
      alert('Failed to update commission percentage');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Get the first offer's property address if filtering by property
  const filteredPropertyAddress = propertyId && offers.length > 0
    ? `${offers[0].property.address_line1}, ${offers[0].property.city}, ${offers[0].property.state}`
    : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-4"
        >
          <ArrowLeft size={20} />
          Back to Dashboard
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              {propertyId ? 'Property Offers' : 'Manage Offers'}
            </h1>
            <p className="text-gray-600">
              {propertyId && filteredPropertyAddress
                ? `Viewing offers for ${filteredPropertyAddress}`
                : 'Review and respond to offers on your properties'}
            </p>
          </div>
          {propertyId && (
            <button
              onClick={() => navigate('/offers')}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition font-medium"
            >
              <ArrowLeft size={20} />
              View All Offers
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b px-6 py-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-gray-600">View:</span>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title="List View"
            >
              <List size={20} />
            </button>
            <button
              onClick={() => setViewMode('grouped')}
              className={`p-2 rounded-md transition ${
                viewMode === 'grouped'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title="Grouped by Property"
            >
              <LayoutGrid size={20} />
            </button>
            <span className="ml-auto text-sm text-gray-600 italic">Commission rates are set per offer</span>
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {(['all', 'pending', 'accepted', 'rejected', 'countered', 'withdrawn'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-md font-medium transition whitespace-nowrap ${
                  filter === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
                <span className="ml-2 text-sm">
                  ({status === 'all' ? offers.length : offers.filter(o => o.offer_status === status).length})
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {filteredOffers.length === 0 ? (
            <div className="text-center py-12">
              <Tag size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 text-lg">No {filter !== 'all' ? filter : ''} offers yet</p>
            </div>
          ) : viewMode === 'list' ? (
            <div className="space-y-4">
              {filteredOffers.map((offer) => {
                const currentCommission = editingCommission[offer.id] ?? offer.commission_percent;
                const sellerNet = calculateNetProceeds(offer.offer_amount, currentCommission);
                return (
                <div
                  key={offer.id}
                  className="border rounded-lg p-6 hover:shadow-md transition"
                >
                  <div className="flex flex-col lg:flex-row gap-6">
                    <div className="flex-shrink-0">
                      <img
                        src={
                          offer.property.photos?.[0]?.photo_url ||
                          'https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg?auto=compress&cs=tinysrgb&w=400'
                        }
                        alt={offer.property.address_line1}
                        className="w-full lg:w-48 h-32 object-cover rounded-lg"
                      />
                    </div>

                    <div className="flex-1 space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Home size={18} className="text-gray-600" />
                            <h3 className="text-lg font-semibold text-gray-800">
                              {offer.property.address_line1}
                            </h3>
                          </div>
                          <p className="text-sm text-gray-600">
                            {offer.property.city}, {offer.property.state}
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(offer.offer_status)}`}>
                          {offer.offer_status.charAt(0).toUpperCase() + offer.offer_status.slice(1)}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <DollarSign size={16} className="text-gray-600" />
                            <span className="text-gray-600">List Price:</span>
                            <span className="font-semibold">{formatPrice(offer.property.price)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <TrendingUp size={16} className="text-green-600" />
                            <span className="text-gray-600">Offer Amount:</span>
                            <span className="font-bold text-green-600 text-lg">{formatPrice(offer.offer_amount)}</span>
                          </div>
                          {offer.counter_amount && (
                            <div className="flex items-center gap-2 text-sm">
                              <TrendingUp size={16} className="text-blue-600" />
                              <span className="text-gray-600">Counter Offer:</span>
                              <span className="font-bold text-blue-600">{formatPrice(offer.counter_amount)}</span>
                            </div>
                          )}
                          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-2">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <TrendingDown size={16} className="text-green-600" />
                                <p className="text-sm font-semibold text-gray-700">Your Net After</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max="100"
                                  value={currentCommission}
                                  onChange={(e) => setEditingCommission({
                                    ...editingCommission,
                                    [offer.id]: parseFloat(e.target.value) || 0
                                  })}
                                  onBlur={() => {
                                    if (currentCommission !== offer.commission_percent) {
                                      updateCommission(offer.id, currentCommission);
                                    }
                                  }}
                                  className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                <span className="text-sm text-gray-700">% Commission</span>
                              </div>
                            </div>
                            <p className="text-lg font-bold text-green-700">
                              {formatPrice(sellerNet)}
                            </p>
                            <p className="text-xs text-gray-600 mt-1">
                              Commission: {formatPrice(offer.offer_amount - sellerNet)}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <User size={16} className="text-gray-600" />
                            <span className="text-gray-600">Buyer:</span>
                            <span className="font-medium">{offer.buyer.full_name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar size={16} className="text-gray-600" />
                            <span className="text-gray-600">Closing Date:</span>
                            <span className="font-medium">{formatDate(offer.closing_date)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <FileText size={16} className="text-gray-600" />
                            <span className="text-gray-600">Financing:</span>
                            <span className="font-medium capitalize">{offer.financing_type}</span>
                          </div>
                        </div>
                      </div>

                      {offer.message && (
                        <div className="bg-gray-50 rounded-md p-3">
                          <div className="flex items-start gap-2">
                            <MessageSquare size={16} className="text-gray-600 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-gray-700 mb-1">Buyer's Message:</p>
                              <p className="text-sm text-gray-600">{offer.message}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {offer.contingencies && (
                        <div className="bg-yellow-50 rounded-md p-3">
                          <div className="flex items-start gap-2">
                            <Clock size={16} className="text-yellow-600 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-gray-700 mb-1">Contingencies:</p>
                              <p className="text-sm text-gray-600">{offer.contingencies}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {offer.offer_status === 'pending' && (
                        <div className="flex flex-wrap gap-3 pt-2">
                          {!showCounterForm || selectedOffer?.id !== offer.id ? (
                            <>
                              <button
                                onClick={() => handleAcceptOffer(offer.id)}
                                disabled={actionLoading}
                                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition disabled:opacity-50"
                              >
                                <CheckCircle size={18} />
                                Accept Offer
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedOffer(offer);
                                  setShowCounterForm(true);
                                  setCounterAmount(offer.property.price.toString());
                                }}
                                disabled={actionLoading}
                                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-50"
                              >
                                <TrendingUp size={18} />
                                Counter Offer
                              </button>
                              <button
                                onClick={() => handleRejectOffer(offer.id)}
                                disabled={actionLoading}
                                className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition disabled:opacity-50"
                              >
                                <XCircle size={18} />
                                Reject Offer
                              </button>
                            </>
                          ) : (
                            <div className="w-full bg-blue-50 rounded-md p-4 space-y-3">
                              <h4 className="font-semibold text-gray-800">Counter Offer</h4>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Counter Amount
                                </label>
                                <input
                                  type="number"
                                  value={counterAmount}
                                  onChange={(e) => setCounterAmount(e.target.value)}
                                  placeholder="Enter counter offer amount"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Message (Optional)
                                </label>
                                <textarea
                                  value={counterMessage}
                                  onChange={(e) => setCounterMessage(e.target.value)}
                                  placeholder="Add a message to explain your counter offer..."
                                  rows={3}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleCounterOffer(offer.id)}
                                  disabled={actionLoading}
                                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-50"
                                >
                                  Submit Counter Offer
                                </button>
                                <button
                                  onClick={() => {
                                    setShowCounterForm(false);
                                    setSelectedOffer(null);
                                    setCounterAmount('');
                                    setCounterMessage('');
                                  }}
                                  className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 transition"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {offer.responded_at && (
                        <div className="flex items-center gap-2 text-sm text-gray-500 pt-2 border-t">
                          <Clock size={14} />
                          <span>Responded on {formatDate(offer.responded_at)}</span>
                        </div>
                      )}

                      <div className="flex justify-end pt-2 border-t">
                        <button
                          onClick={() => handleDeleteOffer(offer.id)}
                          disabled={actionLoading}
                          className="flex items-center gap-2 text-red-600 hover:text-red-700 px-3 py-1.5 rounded-md hover:bg-red-50 transition disabled:opacity-50"
                          title="Delete offer"
                        >
                          <Trash2 size={16} />
                          <span className="text-sm font-medium">Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
          ) : (
            <div className="space-y-6">
              {groupedOffers.map((propertyGroup) => {
                const hasMultipleOffers = propertyGroup.offers.length > 1;
                const isExpanded = expandedProperty === propertyGroup.property_id || propertyGroup.offers.length === 1;

                return (
                  <div key={propertyGroup.property_id} className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 border-b p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Home size={18} className="text-gray-600" />
                            <h3 className="text-lg font-semibold text-gray-800">
                              {propertyGroup.property.address_line1}
                            </h3>
                          </div>
                          <p className="text-sm text-gray-600">
                            {propertyGroup.property.city}, {propertyGroup.property.state}
                          </p>
                          <p className="text-sm text-gray-500 mt-1">
                            List Price: <span className="font-semibold text-gray-900">{formatPrice(propertyGroup.property.price)}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                            {propertyGroup.offers.length} {propertyGroup.offers.length === 1 ? 'Offer' : 'Offers'}
                          </span>
                          {hasMultipleOffers && (
                            <button
                              onClick={() => setExpandedProperty(isExpanded ? null : propertyGroup.property_id)}
                              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition text-sm font-medium"
                            >
                              {isExpanded ? 'Collapse' : 'Compare Offers'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {isExpanded ? (
                      hasMultipleOffers ? (
                        <div className="p-4 overflow-x-auto">
                          <table className="w-full min-w-[1000px]">
                            <thead>
                              <tr className="border-b-2 border-gray-200">
                                <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">Buyer</th>
                                <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">Offer Amount</th>
                                <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">Commission %</th>
                                <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">Your Net</th>
                                <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">Financing</th>
                                <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">Closing Date</th>
                                <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">Status</th>
                                <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {propertyGroup.offers
                                .sort((a, b) => b.offer_amount - a.offer_amount)
                                .map((offer, index) => {
                                  const currentCommission = editingCommission[offer.id] ?? offer.commission_percent;
                                  const sellerNet = calculateNetProceeds(offer.offer_amount, currentCommission);
                                  const isHighest = index === 0;

                                  return (
                                    <tr
                                      key={offer.id}
                                      className={`border-b border-gray-100 hover:bg-gray-50 transition ${
                                        isHighest ? 'bg-green-50' : ''
                                      }`}
                                    >
                                      <td className="py-4 px-2">
                                        <div className="flex items-center gap-2">
                                          <User size={16} className="text-gray-400" />
                                          <span className="font-medium">{offer.buyer.full_name}</span>
                                          {isHighest && (
                                            <TrendingUp size={16} className="text-green-600" title="Highest Offer" />
                                          )}
                                        </div>
                                      </td>
                                      <td className="py-4 px-2">
                                        <div className="font-bold text-green-600 text-lg">
                                          {formatPrice(offer.offer_amount)}
                                        </div>
                                        {offer.counter_amount && (
                                          <div className="text-sm text-gray-600 mt-1">
                                            Counter: {formatPrice(offer.counter_amount)}
                                          </div>
                                        )}
                                      </td>
                                      <td className="py-4 px-2">
                                        <div className="flex items-center gap-1">
                                          <input
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            max="100"
                                            value={currentCommission}
                                            onChange={(e) => setEditingCommission({
                                              ...editingCommission,
                                              [offer.id]: parseFloat(e.target.value) || 0
                                            })}
                                            onBlur={() => {
                                              if (currentCommission !== offer.commission_percent) {
                                                updateCommission(offer.id, currentCommission);
                                              }
                                            }}
                                            className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                          />
                                          <span className="text-sm text-gray-700">%</span>
                                        </div>
                                      </td>
                                      <td className="py-4 px-2">
                                        <div className="font-bold text-green-700 text-lg">
                                          {formatPrice(sellerNet)}
                                        </div>
                                        <div className="text-xs text-gray-600 mt-1">
                                          Comm: {formatPrice(offer.offer_amount - sellerNet)}
                                        </div>
                                      </td>
                                      <td className="py-4 px-2">
                                        <span className="capitalize">{offer.financing_type}</span>
                                      </td>
                                      <td className="py-4 px-2">
                                        {formatDate(offer.closing_date)}
                                      </td>
                                      <td className="py-4 px-2">
                                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(offer.offer_status)}`}>
                                          {offer.offer_status.charAt(0).toUpperCase() + offer.offer_status.slice(1)}
                                        </span>
                                      </td>
                                      <td className="py-4 px-2">
                                        {offer.offer_status === 'pending' && (
                                          <div className="flex gap-2">
                                            <button
                                              onClick={() => handleAcceptOffer(offer.id)}
                                              disabled={actionLoading}
                                              className="p-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition disabled:opacity-50"
                                              title="Accept"
                                            >
                                              <CheckCircle size={16} />
                                            </button>
                                            <button
                                              onClick={() => {
                                                setSelectedOffer(offer);
                                                setShowCounterForm(true);
                                                setCounterAmount(offer.property.price.toString());
                                              }}
                                              disabled={actionLoading}
                                              className="p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50"
                                              title="Counter"
                                            >
                                              <TrendingUp size={16} />
                                            </button>
                                            <button
                                              onClick={() => handleRejectOffer(offer.id)}
                                              disabled={actionLoading}
                                              className="p-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition disabled:opacity-50"
                                              title="Reject"
                                            >
                                              <XCircle size={16} />
                                            </button>
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>

                          {propertyGroup.offers.some(o => o.message || o.contingencies) && (
                            <div className="mt-4 border-t pt-4">
                              <h4 className="font-semibold text-gray-800 mb-3">Additional Details</h4>
                              <div className="space-y-3">
                                {propertyGroup.offers.map(offer => (
                                  (offer.message || offer.contingencies) && (
                                    <div key={offer.id} className="bg-gray-50 rounded-md p-3">
                                      <p className="font-medium text-gray-900 mb-2">{offer.buyer.full_name}</p>
                                      {offer.message && (
                                        <div className="mb-2">
                                          <p className="text-xs font-semibold text-gray-700 mb-1">Message:</p>
                                          <p className="text-sm text-gray-600">{offer.message}</p>
                                        </div>
                                      )}
                                      {offer.contingencies && (
                                        <div>
                                          <p className="text-xs font-semibold text-gray-700 mb-1">Contingencies:</p>
                                          <p className="text-sm text-gray-600">{offer.contingencies}</p>
                                        </div>
                                      )}
                                    </div>
                                  )
                                ))}
                              </div>
                            </div>
                          )}

                          {showCounterForm && selectedOffer && propertyGroup.offers.some(o => o.id === selectedOffer.id) && (
                            <div className="mt-4 bg-blue-50 rounded-md p-4 space-y-3">
                              <h4 className="font-semibold text-gray-800">Counter Offer for {selectedOffer.buyer.full_name}</h4>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Counter Amount
                                </label>
                                <input
                                  type="number"
                                  value={counterAmount}
                                  onChange={(e) => setCounterAmount(e.target.value)}
                                  placeholder="Enter counter offer amount"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Message (Optional)
                                </label>
                                <textarea
                                  value={counterMessage}
                                  onChange={(e) => setCounterMessage(e.target.value)}
                                  placeholder="Add a message to explain your counter offer..."
                                  rows={3}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleCounterOffer(selectedOffer.id)}
                                  disabled={actionLoading}
                                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-50"
                                >
                                  Submit Counter Offer
                                </button>
                                <button
                                  onClick={() => {
                                    setShowCounterForm(false);
                                    setSelectedOffer(null);
                                    setCounterAmount('');
                                    setCounterMessage('');
                                  }}
                                  className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 transition"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-6">
                          {propertyGroup.offers.map(offer => {
                            const currentCommission = editingCommission[offer.id] ?? offer.commission_percent;
                            const sellerNet = calculateNetProceeds(offer.offer_amount, currentCommission);
                            return (
                              <div key={offer.id} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm">
                                      <TrendingUp size={16} className="text-green-600" />
                                      <span className="text-gray-600">Offer Amount:</span>
                                      <span className="font-bold text-green-600 text-lg">{formatPrice(offer.offer_amount)}</span>
                                    </div>
                                    {offer.counter_amount && (
                                      <div className="flex items-center gap-2 text-sm">
                                        <TrendingUp size={16} className="text-blue-600" />
                                        <span className="text-gray-600">Counter Offer:</span>
                                        <span className="font-bold text-blue-600">{formatPrice(offer.counter_amount)}</span>
                                      </div>
                                    )}
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-2">
                                      <div className="flex items-center justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-2">
                                          <TrendingDown size={16} className="text-green-600" />
                                          <p className="text-sm font-semibold text-gray-700">Your Net After</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            max="100"
                                            value={currentCommission}
                                            onChange={(e) => setEditingCommission({
                                              ...editingCommission,
                                              [offer.id]: parseFloat(e.target.value) || 0
                                            })}
                                            onBlur={() => {
                                              if (currentCommission !== offer.commission_percent) {
                                                updateCommission(offer.id, currentCommission);
                                              }
                                            }}
                                            className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                          />
                                          <span className="text-sm text-gray-700">% Commission</span>
                                        </div>
                                      </div>
                                      <p className="text-lg font-bold text-green-700">
                                        {formatPrice(sellerNet)}
                                      </p>
                                      <p className="text-xs text-gray-600 mt-1">
                                        Commission: {formatPrice(offer.offer_amount - sellerNet)}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm">
                                      <User size={16} className="text-gray-600" />
                                      <span className="text-gray-600">Buyer:</span>
                                      <span className="font-medium">{offer.buyer.full_name}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                      <Calendar size={16} className="text-gray-600" />
                                      <span className="text-gray-600">Closing Date:</span>
                                      <span className="font-medium">{formatDate(offer.closing_date)}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                      <FileText size={16} className="text-gray-600" />
                                      <span className="text-gray-600">Financing:</span>
                                      <span className="font-medium capitalize">{offer.financing_type}</span>
                                    </div>
                                  </div>
                                </div>

                                {offer.message && (
                                  <div className="bg-gray-50 rounded-md p-3">
                                    <div className="flex items-start gap-2">
                                      <MessageSquare size={16} className="text-gray-600 mt-0.5" />
                                      <div>
                                        <p className="text-sm font-medium text-gray-700 mb-1">Buyer's Message:</p>
                                        <p className="text-sm text-gray-600">{offer.message}</p>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {offer.contingencies && (
                                  <div className="bg-yellow-50 rounded-md p-3">
                                    <div className="flex items-start gap-2">
                                      <Clock size={16} className="text-yellow-600 mt-0.5" />
                                      <div>
                                        <p className="text-sm font-medium text-gray-700 mb-1">Contingencies:</p>
                                        <p className="text-sm text-gray-600">{offer.contingencies}</p>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {offer.offer_status === 'pending' && (
                                  <div className="flex flex-wrap gap-3 pt-2">
                                    {!showCounterForm || selectedOffer?.id !== offer.id ? (
                                      <>
                                        <button
                                          onClick={() => handleAcceptOffer(offer.id)}
                                          disabled={actionLoading}
                                          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition disabled:opacity-50"
                                        >
                                          <CheckCircle size={18} />
                                          Accept Offer
                                        </button>
                                        <button
                                          onClick={() => {
                                            setSelectedOffer(offer);
                                            setShowCounterForm(true);
                                            setCounterAmount(offer.property.price.toString());
                                          }}
                                          disabled={actionLoading}
                                          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-50"
                                        >
                                          <TrendingUp size={18} />
                                          Counter Offer
                                        </button>
                                        <button
                                          onClick={() => handleRejectOffer(offer.id)}
                                          disabled={actionLoading}
                                          className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition disabled:opacity-50"
                                        >
                                          <XCircle size={18} />
                                          Reject Offer
                                        </button>
                                      </>
                                    ) : (
                                      <div className="w-full bg-blue-50 rounded-md p-4 space-y-3">
                                        <h4 className="font-semibold text-gray-800">Counter Offer</h4>
                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Counter Amount
                                          </label>
                                          <input
                                            type="number"
                                            value={counterAmount}
                                            onChange={(e) => setCounterAmount(e.target.value)}
                                            placeholder="Enter counter offer amount"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Message (Optional)
                                          </label>
                                          <textarea
                                            value={counterMessage}
                                            onChange={(e) => setCounterMessage(e.target.value)}
                                            placeholder="Add a message to explain your counter offer..."
                                            rows={3}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                          />
                                        </div>
                                        <div className="flex gap-2">
                                          <button
                                            onClick={() => handleCounterOffer(offer.id)}
                                            disabled={actionLoading}
                                            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-50"
                                          >
                                            Submit Counter Offer
                                          </button>
                                          <button
                                            onClick={() => {
                                              setShowCounterForm(false);
                                              setSelectedOffer(null);
                                              setCounterAmount('');
                                              setCounterMessage('');
                                            }}
                                            className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 transition"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                <div className="flex justify-end pt-2 border-t">
                                  <button
                                    onClick={() => handleDeleteOffer(offer.id)}
                                    disabled={actionLoading}
                                    className="flex items-center gap-2 text-red-600 hover:text-red-700 px-3 py-1.5 rounded-md hover:bg-red-50 transition disabled:opacity-50"
                                    title="Delete offer"
                                  >
                                    <Trash2 size={16} />
                                    <span className="text-sm font-medium">Delete</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )
                    ) : (
                      <div className="p-4">
                        <p className="text-gray-600 text-center">Click "Compare Offers" to view details</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
