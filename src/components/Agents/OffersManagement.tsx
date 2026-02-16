import { useState, useEffect } from 'react';
import { Tag, DollarSign, Calendar, User, Phone, CheckCircle, XCircle, MessageSquare, ArrowLeft, LayoutGrid, List, Calculator, TrendingDown, TrendingUp, Home } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from '../Navigation/Router';

type Offer = {
  id: string;
  property_id: string;
  buyer_id: string;
  offer_amount: number;
  offer_status: string;
  financing_type: string;
  closing_date: string;
  message: string;
  contingencies: string;
  counter_amount: number | null;
  counter_message: string | null;
  commission_percent: number;
  created_at: string;
  property: {
    address_line1: string;
    city: string;
    state: string;
    price: number;
    status: string;
    seller_id: string | null;
    photos: { photo_url: string }[];
    seller?: {
      full_name: string;
      phone_number: string | null;
    };
  };
  buyer: {
    full_name: string;
    phone_number: string | null;
  };
};

type PropertyWithOffers = {
  property_id: string;
  property: Offer['property'];
  offers: Offer[];
};

export function OffersManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('pending');
  const [viewMode, setViewMode] = useState<'list' | 'grouped'>('grouped');
  const [expandedProperty, setExpandedProperty] = useState<string | null>(null);
  const [editingCommission, setEditingCommission] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    if (user) {
      loadOffers();
    }
  }, [user]);

  const loadOffers = async () => {
    if (!user) return;

    try {
      const { data: propertiesData, error: propertiesError } = await supabase
        .from('properties')
        .select('id')
        .or(`agent_id.eq.${user.id},listed_by.eq.${user.id}`);

      if (propertiesError) throw propertiesError;

      const propertyIds = propertiesData?.map(p => p.id) || [];

      if (propertyIds.length === 0) {
        setOffers([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('property_offers')
        .select(`
          *,
          property:properties!property_id (
            address_line1,
            city,
            state,
            price,
            status,
            seller_id,
            photos:property_photos(photo_url),
            seller:profiles!seller_id (
              full_name,
              phone_number
            )
          ),
          buyer:profiles!buyer_id (
            full_name,
            phone_number
          )
        `)
        .in('property_id', propertyIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOffers(data || []);
    } catch (err) {
      console.error('Error loading offers:', err);
    } finally {
      setLoading(false);
    }
  };


  const filteredOffers = offers.filter(offer => {
    if (filter === 'all') return true;
    return offer.offer_status === filter;
  });

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

  // Mark property as sold
  const markPropertyAsSold = async (propertyId: string, offerId: string) => {
    if (!confirm('Mark this property as sold? This will update the property status and record the final sale price for analytics.')) {
      return;
    }

    try {
      // Update property status to 'sold'
      const { error: propertyError } = await supabase
        .from('properties')
        .update({ status: 'sold' })
        .eq('id', propertyId);

      if (propertyError) throw propertyError;

      // Reload offers to reflect the change
      await loadOffers();

      alert('Property marked as sold successfully!');
    } catch (err) {
      console.error('Error marking property as sold:', err);
      alert('Failed to mark property as sold. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading offers...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-gray-600 hover:text-blue-600 transition"
            title="Back"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Property Offers</h1>
        </div>
        <p className="text-gray-600">Manage and compare offers on your listings</p>
      </div>

      <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2">
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
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
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
      </div>

      {filteredOffers.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <Tag size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Offers</h3>
          <p className="text-gray-600">
            {filter === 'pending'
              ? "You don't have any pending offers at the moment."
              : `You don't have any ${filter} offers.`}
          </p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-6">
          {filteredOffers.map((offer) => {
            const currentCommission = editingCommission[offer.id] ?? offer.commission_percent;
            const sellerNet = calculateNetProceeds(offer.offer_amount, currentCommission);
            return (
            <div
              key={offer.id}
              className="bg-white rounded-lg shadow-md overflow-hidden"
            >
              <div className="flex flex-col lg:flex-row">
                <div
                  className="lg:w-80 h-48 lg:h-auto flex-shrink-0 cursor-pointer"
                  onClick={() => navigate(`/property/${offer.property_id}`)}
                >
                  <img
                    src={offer.property.photos[0]?.photo_url || 'https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg?auto=compress&cs=tinysrgb&w=800'}
                    alt={offer.property.address_line1}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1 p-6">
                  <div className="mb-4">
                    <h3 className="text-xl font-bold text-gray-900 mb-1">
                      {offer.property.address_line1}
                    </h3>
                    <p className="text-gray-600">
                      {offer.property.city}, {offer.property.state}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">List Price</p>
                        <p className="text-xl font-semibold text-gray-900">
                          ${offer.property.price.toLocaleString()}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-gray-500 mb-1">Offer Amount</p>
                        <p className="text-2xl font-bold text-blue-600">
                          ${offer.offer_amount.toLocaleString()}
                        </p>
                      </div>

                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <TrendingDown size={16} className="text-green-600" />
                            <p className="text-sm font-semibold text-gray-700">Seller Net After</p>
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
                        <p className="text-xl font-bold text-green-700">
                          ${sellerNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          Commission: ${(offer.offer_amount - sellerNet).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>

                      <div className="flex gap-4">
                        <div>
                          <p className="text-sm text-gray-500 mb-1">Financing</p>
                          <p className="font-medium text-gray-900 capitalize">
                            {offer.financing_type}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 mb-1">Closing Date</p>
                          <p className="font-medium text-gray-900">
                            {new Date(offer.closing_date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm font-semibold text-gray-700 mb-2">Buyer Information</p>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <User size={16} className="text-gray-400" />
                            <span className="text-gray-900">{offer.buyer.full_name}</span>
                          </div>
                          {offer.buyer.phone_number && (
                            <div className="flex items-center gap-2 text-sm">
                              <Phone size={16} className="text-gray-400" />
                              <span className="text-gray-600">{offer.buyer.phone_number}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {offer.property.seller && (
                        <div className="bg-green-50 p-4 rounded-lg">
                          <p className="text-sm font-semibold text-gray-700 mb-2">Seller Information</p>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                              <User size={16} className="text-gray-400" />
                              <span className="text-gray-900">{offer.property.seller.full_name}</span>
                            </div>
                            {offer.property.seller.phone_number && (
                              <div className="flex items-center gap-2 text-sm">
                                <Phone size={16} className="text-gray-400" />
                                <span className="text-gray-600">{offer.property.seller.phone_number}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {offer.message && (
                    <div className="mb-4 bg-blue-50 p-4 rounded-lg">
                      <p className="text-sm font-semibold text-gray-700 mb-1">Buyer's Message</p>
                      <p className="text-gray-700">{offer.message}</p>
                    </div>
                  )}

                  {offer.contingencies && (
                    <div className="mb-4 bg-yellow-50 p-4 rounded-lg">
                      <p className="text-sm font-semibold text-gray-700 mb-1">Contingencies</p>
                      <p className="text-gray-700">{offer.contingencies}</p>
                    </div>
                  )}

                  {offer.offer_status === 'pending' && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mt-4">
                      <p className="text-sm text-yellow-800">
                        <strong>Note:</strong> Only the property seller can accept, reject, or counter this offer. You can view the status here as it updates.
                      </p>
                    </div>
                  )}

                  {offer.offer_status !== 'pending' && (
                    <div className="mt-4">
                      <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold ${
                        offer.offer_status === 'accepted'
                          ? 'bg-green-100 text-green-800'
                          : offer.offer_status === 'rejected'
                          ? 'bg-red-100 text-red-800'
                          : offer.offer_status === 'countered'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {offer.offer_status === 'accepted' && <CheckCircle size={16} />}
                        {offer.offer_status === 'rejected' && <XCircle size={16} />}
                        {offer.offer_status === 'countered' && <MessageSquare size={16} />}
                        {offer.offer_status.charAt(0).toUpperCase() + offer.offer_status.slice(1)}
                      </span>
                      {offer.offer_status === 'countered' && offer.counter_amount && (
                        <span className="ml-3 text-gray-700">
                          Counter: ${offer.counter_amount.toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}

                  {offer.offer_status === 'accepted' && offer.property.status !== 'sold' && (
                    <div className="mt-4">
                      <button
                        onClick={() => markPropertyAsSold(offer.property_id, offer.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition text-sm font-medium"
                      >
                        <Home size={16} />
                        Mark Property as Sold
                      </button>
                    </div>
                  )}

                  {offer.property.status === 'sold' && (
                    <div className="mt-4 bg-green-50 border border-green-200 rounded-md p-3">
                      <p className="text-sm text-green-800 font-semibold flex items-center gap-2">
                        <CheckCircle size={16} />
                        This property has been marked as sold
                      </p>
                    </div>
                  )}

                  <div className="mt-4 text-sm text-gray-500">
                    Submitted {new Date(offer.created_at).toLocaleDateString()} at{' '}
                    {new Date(offer.created_at).toLocaleTimeString()}
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
              <div key={propertyGroup.property_id} className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="bg-gray-50 border-b border-gray-200 p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-1">
                        {propertyGroup.property.address_line1}
                      </h3>
                      <p className="text-gray-600">
                        {propertyGroup.property.city}, {propertyGroup.property.state}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        List Price: <span className="font-semibold text-gray-900">${propertyGroup.property.price.toLocaleString()}</span>
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
                            <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">Seller Net</th>
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
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <User size={16} className="text-gray-400" />
                                        <span className="font-medium text-gray-900">{offer.buyer.full_name}</span>
                                        {isHighest && (
                                          <TrendingUp size={16} className="text-green-600" title="Highest Offer" />
                                        )}
                                      </div>
                                      {offer.buyer.phone_number && (
                                        <div className="flex items-center gap-2 mt-1">
                                          <Phone size={14} className="text-gray-400" />
                                          <span className="text-sm text-gray-600">{offer.buyer.phone_number}</span>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-4 px-2">
                                    <div className="text-lg font-bold text-blue-600">
                                      ${offer.offer_amount.toLocaleString()}
                                    </div>
                                    {offer.counter_amount && (
                                      <div className="text-sm text-gray-600 mt-1">
                                        Counter: ${offer.counter_amount.toLocaleString()}
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
                                    <div className="text-lg font-bold text-green-700">
                                      ${sellerNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                    <div className="text-xs text-gray-600 mt-1">
                                      Comm: ${(offer.offer_amount - sellerNet).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                  </td>
                                  <td className="py-4 px-2">
                                    <span className="capitalize text-gray-900">{offer.financing_type}</span>
                                  </td>
                                  <td className="py-4 px-2">
                                    <div className="flex items-center gap-2">
                                      <Calendar size={16} className="text-gray-400" />
                                      <span className="text-gray-900">{new Date(offer.closing_date).toLocaleDateString()}</span>
                                    </div>
                                  </td>
                                  <td className="py-4 px-2">
                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                                      offer.offer_status === 'accepted'
                                        ? 'bg-green-100 text-green-800'
                                        : offer.offer_status === 'rejected'
                                        ? 'bg-red-100 text-red-800'
                                        : offer.offer_status === 'countered'
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-yellow-100 text-yellow-800'
                                    }`}>
                                      {offer.offer_status === 'accepted' && <CheckCircle size={12} />}
                                      {offer.offer_status === 'rejected' && <XCircle size={12} />}
                                      {offer.offer_status}
                                    </span>
                                  </td>
                                  <td className="py-4 px-2">
                                    {offer.offer_status === 'accepted' && offer.property.status !== 'sold' && (
                                      <button
                                        onClick={() => markPropertyAsSold(offer.property_id, offer.id)}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition text-xs font-medium"
                                      >
                                        <Home size={14} />
                                        Mark as Sold
                                      </button>
                                    )}
                                    {offer.property.status === 'sold' && (
                                      <span className="text-xs text-green-600 font-semibold flex items-center gap-1">
                                        <CheckCircle size={12} />
                                        Sold
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>

                      {propertyGroup.offers.some(o => o.message || o.contingencies) && (
                        <div className="mt-4 border-t pt-4">
                          <h4 className="font-semibold text-gray-900 mb-3">Additional Details</h4>
                          <div className="space-y-3">
                            {propertyGroup.offers.map(offer => (
                              (offer.message || offer.contingencies) && (
                                <div key={offer.id} className="bg-gray-50 rounded-lg p-3">
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
                    </div>
                  ) : (
                    <div className="p-6">
                      {propertyGroup.offers.map(offer => {
                        const currentCommission = editingCommission[offer.id] ?? offer.commission_percent;
                        const sellerNet = calculateNetProceeds(offer.offer_amount, currentCommission);
                        return (
                          <div key={offer.id}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                              <div className="space-y-4">
                                <div>
                                  <p className="text-sm text-gray-500 mb-1">Offer Amount</p>
                                  <p className="text-2xl font-bold text-blue-600">
                                    ${offer.offer_amount.toLocaleString()}
                                  </p>
                                </div>

                                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                  <div className="flex items-center justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-2">
                                      <TrendingDown size={16} className="text-green-600" />
                                      <p className="text-sm font-semibold text-gray-700">Seller Net After</p>
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
                                  <p className="text-xl font-bold text-green-700">
                                    ${sellerNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </p>
                                  <p className="text-xs text-gray-600 mt-1">
                                    Commission: ${(offer.offer_amount - sellerNet).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </p>
                                </div>

                                <div className="flex gap-4">
                                  <div>
                                    <p className="text-sm text-gray-500 mb-1">Financing</p>
                                    <p className="font-medium text-gray-900 capitalize">
                                      {offer.financing_type}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-gray-500 mb-1">Closing Date</p>
                                    <p className="font-medium text-gray-900">
                                      {new Date(offer.closing_date).toLocaleDateString()}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-4">
                                <div className="bg-gray-50 p-4 rounded-lg">
                                  <p className="text-sm font-semibold text-gray-700 mb-2">Buyer Information</p>
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm">
                                      <User size={16} className="text-gray-400" />
                                      <span className="text-gray-900">{offer.buyer.full_name}</span>
                                    </div>
                                    {offer.buyer.phone_number && (
                                      <div className="flex items-center gap-2 text-sm">
                                        <Phone size={16} className="text-gray-400" />
                                        <span className="text-gray-600">{offer.buyer.phone_number}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {offer.property.seller && (
                                  <div className="bg-green-50 p-4 rounded-lg">
                                    <p className="text-sm font-semibold text-gray-700 mb-2">Seller Information</p>
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2 text-sm">
                                        <User size={16} className="text-gray-400" />
                                        <span className="text-gray-900">{offer.property.seller.full_name}</span>
                                      </div>
                                      {offer.property.seller.phone_number && (
                                        <div className="flex items-center gap-2 text-sm">
                                          <Phone size={16} className="text-gray-400" />
                                          <span className="text-gray-600">{offer.property.seller.phone_number}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {offer.message && (
                              <div className="mb-4 bg-blue-50 p-4 rounded-lg">
                                <p className="text-sm font-semibold text-gray-700 mb-1">Buyer's Message</p>
                                <p className="text-gray-700">{offer.message}</p>
                              </div>
                            )}

                            {offer.contingencies && (
                              <div className="mb-4 bg-yellow-50 p-4 rounded-lg">
                                <p className="text-sm font-semibold text-gray-700 mb-1">Contingencies</p>
                                <p className="text-gray-700">{offer.contingencies}</p>
                              </div>
                            )}

                            <div className="mb-4">
                              <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold ${
                                offer.offer_status === 'accepted'
                                  ? 'bg-green-100 text-green-800'
                                  : offer.offer_status === 'rejected'
                                  ? 'bg-red-100 text-red-800'
                                  : offer.offer_status === 'countered'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {offer.offer_status === 'accepted' && <CheckCircle size={16} />}
                                {offer.offer_status === 'rejected' && <XCircle size={16} />}
                                {offer.offer_status === 'countered' && <MessageSquare size={16} />}
                                {offer.offer_status.charAt(0).toUpperCase() + offer.offer_status.slice(1)}
                              </span>
                            </div>

                            {offer.offer_status === 'accepted' && offer.property.status !== 'sold' && (
                              <div className="mb-4">
                                <button
                                  onClick={() => markPropertyAsSold(offer.property_id, offer.id)}
                                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition text-sm font-medium"
                                >
                                  <Home size={16} />
                                  Mark Property as Sold
                                </button>
                              </div>
                            )}

                            {offer.property.status === 'sold' && (
                              <div className="mb-4 bg-green-50 border border-green-200 rounded-md p-3">
                                <p className="text-sm text-green-800 font-semibold flex items-center gap-2">
                                  <CheckCircle size={16} />
                                  This property has been marked as sold
                                </p>
                              </div>
                            )}

                            <div className="text-sm text-gray-500">
                              Submitted {new Date(offer.created_at).toLocaleDateString()} at{' '}
                              {new Date(offer.created_at).toLocaleTimeString()}
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
  );
}
