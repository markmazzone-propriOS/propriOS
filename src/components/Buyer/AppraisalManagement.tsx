import { useState, useEffect } from 'react';
import { FileText, Calendar, AlertCircle, CheckCircle, Clock, XCircle, DollarSign, Plus, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type AppraisalRequest = {
  id: string;
  property_id: string;
  offer_id: string | null;
  service_provider_id: string | null;
  appraisal_type: string;
  requested_date: string;
  status: string;
  special_instructions: string | null;
  appraisal_report_url: string | null;
  appraised_value: number | null;
  created_at: string;
  property: {
    address_line1: string;
    city: string;
    state: string;
    photos: { photo_url: string }[];
  };
  service_provider: {
    full_name: string;
    business_name: string | null;
    phone: string | null;
  } | null;
};

type Property = {
  id: string;
  address_line1: string;
  city: string;
  state: string;
};

type ServiceProvider = {
  id: string;
  full_name: string;
  business_name: string | null;
  rating: number | null;
};

export function AppraisalManagement() {
  const { user } = useAuth();
  const [appraisals, setAppraisals] = useState<AppraisalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);

  useEffect(() => {
    if (user) {
      loadAppraisals();
    }
  }, [user]);

  const loadAppraisals = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('buyer_appraisal_requests')
        .select(`
          *,
          property:properties!property_id (
            address_line1,
            city,
            state,
            photos:property_photos(photo_url)
          )
        `)
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const appraisalsWithProviders = await Promise.all(
        (data || []).map(async (appraisal) => {
          if (appraisal.service_provider_id) {
            const { data: spProfile } = await supabase
              .from('service_provider_profiles')
              .select('business_name')
              .eq('id', appraisal.service_provider_id)
              .maybeSingle();

            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name, phone_number')
              .eq('id', appraisal.service_provider_id)
              .maybeSingle();

            return {
              ...appraisal,
              service_provider: {
                full_name: profile?.full_name || '',
                business_name: spProfile?.business_name || '',
                phone: profile?.phone_number || ''
              }
            };
          }
          return { ...appraisal, service_provider: null };
        })
      );

      setAppraisals(appraisalsWithProviders);
    } catch (err) {
      console.error('Error loading appraisals:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="text-yellow-500" size={20} />;
      case 'scheduled':
        return <Calendar className="text-blue-500" size={20} />;
      case 'in_progress':
        return <AlertCircle className="text-orange-500" size={20} />;
      case 'completed':
        return <CheckCircle className="text-green-500" size={20} />;
      case 'cancelled':
        return <XCircle className="text-red-500" size={20} />;
      default:
        return <Clock className="text-gray-500" size={20} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-orange-100 text-orange-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading appraisals...</div>
      </div>
    );
  }

  return (
    <>
      {showRequestModal && (
        <RequestAppraisalModal
          onClose={() => setShowRequestModal(false)}
          onSuccess={() => {
            setShowRequestModal(false);
            loadAppraisals();
          }}
        />
      )}

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Appraisal Management</h1>
            <p className="text-gray-600">Schedule and track property appraisals</p>
          </div>
          <button
            onClick={() => setShowRequestModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
          >
            <Plus size={20} />
            Request Appraisal
          </button>
        </div>

        {appraisals.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <FileText size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Appraisals Yet</h3>
            <p className="text-gray-600 mb-4">
              Request an appraisal for properties you're interested in purchasing
            </p>
            <button
              onClick={() => setShowRequestModal(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition"
            >
              Request First Appraisal
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {appraisals.map((appraisal) => (
              <div
                key={appraisal.id}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition"
              >
                <div className="flex flex-col md:flex-row">
                  <div className="md:w-64 h-48 md:h-auto flex-shrink-0">
                    <img
                      src={appraisal.property.photos[0]?.photo_url || 'https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg?auto=compress&cs=tinysrgb&w=800'}
                      alt={appraisal.property.address_line1}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1 p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-1">
                          {appraisal.property.address_line1}
                        </h3>
                        <p className="text-gray-600 mb-2">
                          {appraisal.property.city}, {appraisal.property.state}
                        </p>
                        <p className="text-sm text-gray-500 capitalize">
                          {appraisal.appraisal_type.replace('_', ' ')} Appraisal
                        </p>
                      </div>
                      <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${getStatusColor(appraisal.status)}`}>
                        {getStatusIcon(appraisal.status)}
                        <span className="font-semibold text-sm capitalize">
                          {appraisal.status}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <Calendar size={18} className="text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500">Requested Date</p>
                          <p className="font-semibold text-gray-900">
                            {new Date(appraisal.requested_date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {appraisal.service_provider && (
                        <div className="flex items-center gap-2">
                          <FileText size={18} className="text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500">Appraiser</p>
                            <p className="font-semibold text-gray-900">
                              {appraisal.service_provider.business_name ||
                               appraisal.service_provider.full_name}
                            </p>
                          </div>
                        </div>
                      )}

                      {appraisal.appraised_value && (
                        <div className="flex items-center gap-2">
                          <DollarSign size={18} className="text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500">Appraised Value</p>
                            <p className="font-semibold text-gray-900">
                              ${appraisal.appraised_value.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {appraisal.special_instructions && (
                      <div className="bg-gray-50 rounded-md p-3 mb-4">
                        <p className="text-sm text-gray-700">
                          <span className="font-semibold">Special Instructions:</span>{' '}
                          {appraisal.special_instructions}
                        </p>
                      </div>
                    )}

                    {appraisal.appraisal_report_url && (
                      <div className="mt-4">
                        <a
                          href={appraisal.appraisal_report_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
                        >
                          <FileText size={18} />
                          View Appraisal Report
                        </a>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-sm text-gray-500 mt-4">
                      <span>Requested {new Date(appraisal.created_at).toLocaleDateString()}</span>
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

function RequestAppraisalModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { user } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [serviceProviders, setServiceProviders] = useState<ServiceProvider[]>([]);
  const [selectedProperty, setSelectedProperty] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [appraisalType, setAppraisalType] = useState('full');
  const [requestedDate, setRequestedDate] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProperties();
    loadServiceProviders();
  }, []);

  const loadProperties = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('property_offers')
        .select(`
          property_id,
          property:properties!property_id (
            id,
            address_line1,
            city,
            state
          )
        `)
        .eq('buyer_id', user.id)
        .eq('offer_status', 'accepted');

      if (error) throw error;

      const uniqueProperties = data
        ?.map(offer => offer.property)
        .filter((property, index, self) =>
          property && index === self.findIndex(p => p?.id === property?.id)
        ) || [];

      setProperties(uniqueProperties as Property[]);
    } catch (err) {
      console.error('Error loading properties:', err);
    }
  };

  const loadServiceProviders = async () => {
    try {
      const { data: categories, error: catError } = await supabase
        .from('service_categories')
        .select('id')
        .ilike('name', '%appraisal%')
        .limit(1)
        .maybeSingle();

      if (catError) throw catError;

      if (!categories) {
        return;
      }

      const { data, error } = await supabase
        .from('service_provider_services')
        .select(`
          provider_id,
          provider:service_provider_profiles!provider_id (
            id,
            business_name,
            average_rating,
            profile:profiles!id (
              full_name
            )
          )
        `)
        .eq('category_id', categories.id);

      if (error) throw error;

      const uniqueProviders = new Map();
      data?.forEach(item => {
        if (item.provider && !uniqueProviders.has(item.provider.id)) {
          uniqueProviders.set(item.provider.id, {
            id: item.provider.id,
            full_name: item.provider.profile?.full_name || '',
            business_name: item.provider.business_name,
            rating: item.provider.average_rating
          });
        }
      });

      setServiceProviders(Array.from(uniqueProviders.values()));
    } catch (err) {
      console.error('Error loading service providers:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('buyer_appraisal_requests')
        .insert({
          buyer_id: user.id,
          property_id: selectedProperty,
          service_provider_id: selectedProvider || null,
          appraisal_type: appraisalType,
          requested_date: requestedDate,
          special_instructions: specialInstructions || null
        });

      if (error) throw error;

      alert('Appraisal request submitted successfully!');
      onSuccess();
    } catch (err) {
      console.error('Error submitting appraisal request:', err);
      alert('Failed to submit appraisal request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Request Appraisal</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Property *
              </label>
              <select
                value={selectedProperty}
                onChange={(e) => setSelectedProperty(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a property</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.address_line1}, {property.city}, {property.state}
                  </option>
                ))}
              </select>
              {properties.length === 0 && (
                <p className="text-sm text-amber-600 mt-1">
                  You need an accepted offer to request an appraisal
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Appraisal Type *
              </label>
              <select
                value={appraisalType}
                onChange={(e) => setAppraisalType(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="full">Full Appraisal</option>
                <option value="drive_by">Drive-By Appraisal</option>
                <option value="desktop">Desktop Appraisal</option>
                <option value="fha">FHA Appraisal</option>
                <option value="va">VA Appraisal</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preferred Date *
              </label>
              <input
                type="date"
                value={requestedDate}
                onChange={(e) => setRequestedDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Appraiser (Optional)
              </label>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select an appraiser</option>
                {serviceProviders.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.business_name || provider.full_name}
                    {provider.rating && ` (${provider.rating.toFixed(1)} stars)`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Special Instructions (Optional)
              </label>
              <textarea
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                rows={3}
                placeholder="Any special instructions for the appraiser..."
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || properties.length === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
