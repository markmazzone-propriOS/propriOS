import { useState, useEffect } from 'react';
import { ClipboardCheck, Calendar, AlertCircle, CheckCircle, Clock, XCircle, FileText, Plus, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type InspectionRequest = {
  id: string;
  property_id: string;
  offer_id: string | null;
  service_provider_id: string | null;
  inspection_type: string;
  requested_date: string;
  status: string;
  special_instructions: string | null;
  inspection_report_url: string | null;
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

export function InspectionManagement() {
  const { user } = useAuth();
  const [inspections, setInspections] = useState<InspectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);

  useEffect(() => {
    if (user) {
      loadInspections();
    }
  }, [user]);

  const loadInspections = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('buyer_inspection_requests')
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

      // Fetch service provider details separately for each inspection
      const inspectionsWithProviders = await Promise.all(
        (data || []).map(async (inspection) => {
          if (inspection.service_provider_id) {
            const { data: spProfile } = await supabase
              .from('service_provider_profiles')
              .select('business_name')
              .eq('id', inspection.service_provider_id)
              .maybeSingle();

            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name, phone_number')
              .eq('id', inspection.service_provider_id)
              .maybeSingle();

            return {
              ...inspection,
              service_provider: {
                full_name: profile?.full_name || '',
                business_name: spProfile?.business_name || '',
                phone: profile?.phone_number || ''
              }
            };
          }
          return { ...inspection, service_provider: null };
        })
      );

      setInspections(inspectionsWithProviders);
    } catch (err) {
      console.error('Error loading inspections:', err);
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
        <div className="text-gray-500">Loading inspections...</div>
      </div>
    );
  }

  return (
    <>
      {showRequestModal && (
        <RequestInspectionModal
          onClose={() => setShowRequestModal(false)}
          onSuccess={() => {
            setShowRequestModal(false);
            loadInspections();
          }}
        />
      )}

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Inspection Management</h1>
            <p className="text-gray-600">Schedule and track property inspections</p>
          </div>
          <button
            onClick={() => setShowRequestModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
          >
            <Plus size={20} />
            Request Inspection
          </button>
        </div>

        {inspections.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <ClipboardCheck size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Inspections Yet</h3>
            <p className="text-gray-600 mb-4">
              Request an inspection for properties you're interested in purchasing
            </p>
            <button
              onClick={() => setShowRequestModal(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition"
            >
              Request First Inspection
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {inspections.map((inspection) => (
              <div
                key={inspection.id}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition"
              >
                <div className="flex flex-col md:flex-row">
                  <div className="md:w-64 h-48 md:h-auto flex-shrink-0">
                    <img
                      src={inspection.property.photos[0]?.photo_url || 'https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg?auto=compress&cs=tinysrgb&w=800'}
                      alt={inspection.property.address_line1}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1 p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-1">
                          {inspection.property.address_line1}
                        </h3>
                        <p className="text-gray-600 mb-2">
                          {inspection.property.city}, {inspection.property.state}
                        </p>
                        <p className="text-sm text-gray-500 capitalize">
                          {inspection.inspection_type.replace('_', ' ')} Inspection
                        </p>
                      </div>
                      <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${getStatusColor(inspection.status)}`}>
                        {getStatusIcon(inspection.status)}
                        <span className="font-semibold text-sm capitalize">
                          {inspection.status}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <Calendar size={18} className="text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500">Requested Date</p>
                          <p className="font-semibold text-gray-900">
                            {new Date(inspection.requested_date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {inspection.service_provider && (
                        <div className="flex items-center gap-2">
                          <ClipboardCheck size={18} className="text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500">Inspector</p>
                            <p className="font-semibold text-gray-900">
                              {inspection.service_provider.business_name ||
                               inspection.service_provider.full_name}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {inspection.special_instructions && (
                      <div className="bg-gray-50 rounded-md p-3 mb-4">
                        <p className="text-sm text-gray-700">
                          <span className="font-semibold">Special Instructions:</span>{' '}
                          {inspection.special_instructions}
                        </p>
                      </div>
                    )}

                    {inspection.inspection_report_url && (
                      <div className="mt-4">
                        <a
                          href={inspection.inspection_report_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
                        >
                          <FileText size={18} />
                          View Inspection Report
                        </a>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-sm text-gray-500 mt-4">
                      <span>Requested {new Date(inspection.created_at).toLocaleDateString()}</span>
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

function RequestInspectionModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { user } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [serviceProviders, setServiceProviders] = useState<ServiceProvider[]>([]);
  const [selectedProperty, setSelectedProperty] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [inspectionType, setInspectionType] = useState('general');
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
        .ilike('name', '%inspection%')
        .limit(1)
        .maybeSingle();

      if (catError) throw catError;

      if (!categories) {
        return;
      }

      // Get service providers who offer inspection services
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

      // Remove duplicates and flatten the data
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
        .from('buyer_inspection_requests')
        .insert({
          buyer_id: user.id,
          property_id: selectedProperty,
          service_provider_id: selectedProvider || null,
          inspection_type: inspectionType,
          requested_date: requestedDate,
          special_instructions: specialInstructions || null
        });

      if (error) throw error;

      alert('Inspection request submitted successfully!');
      onSuccess();
    } catch (err) {
      console.error('Error submitting inspection request:', err);
      alert('Failed to submit inspection request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Request Inspection</h2>
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
                  You need an accepted offer to request an inspection
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Inspection Type *
              </label>
              <select
                value={inspectionType}
                onChange={(e) => setInspectionType(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="general">General Home Inspection</option>
                <option value="pest">Pest Inspection</option>
                <option value="roof">Roof Inspection</option>
                <option value="foundation">Foundation Inspection</option>
                <option value="electrical">Electrical Inspection</option>
                <option value="plumbing">Plumbing Inspection</option>
                <option value="hvac">HVAC Inspection</option>
                <option value="environmental">Environmental Inspection</option>
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
                Inspector (Optional)
              </label>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select an inspector</option>
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
                placeholder="Any special instructions for the inspector..."
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
