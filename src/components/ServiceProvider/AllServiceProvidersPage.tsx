import { useState, useEffect } from 'react';
import { Search, MapPin, Star, ArrowLeft, SlidersHorizontal, X, Briefcase, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from '../Navigation/Router';
import { ContactProviderModal } from './ContactProviderModal';

type ServiceProviderProfile = {
  id: string;
  business_name: string;
  service_category: string;
  service_areas: string[];
  bio: string;
  years_experience: number;
  license_number: string | null;
  insurance_verified: boolean;
  average_rating: number;
  total_reviews: number;
  total_jobs_completed: number;
  logo_url: string | null;
  business_address: string | null;
  profile: {
    id: string;
    phone_number: string;
  };
};

const SERVICE_CATEGORIES = [
  'Home Inspector',
  'Appraiser',
  'Contractor',
  'Plumber',
  'Electrician',
  'HVAC Specialist',
  'Landscaper',
  'Painter',
  'Roofer',
  'Cleaner',
  'Moving Company',
  'Insurance Agent',
  'Attorney',
  'Other'
];

export function AllServiceProvidersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [providers, setProviders] = useState<ServiceProviderProfile[]>([]);
  const [filteredProviders, setFilteredProviders] = useState<ServiceProviderProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const [filters, setFilters] = useState({
    category: '',
    minRating: '',
    minYearsExperience: '',
    insuranceVerified: false,
  });

  useEffect(() => {
    loadProviders();
  }, []);

  useEffect(() => {
    filterProviders();
  }, [searchQuery, locationQuery, filters, providers]);

  const loadProviders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('service_provider_profiles')
        .select(`
          *,
          profile:profiles!service_provider_profiles_id_fkey(id, phone_number)
        `)
        .order('average_rating', { ascending: false });

      if (error) throw error;

      const providerData = data || [];
      setProviders(providerData);
      setFilteredProviders(providerData);
    } catch (error) {
      console.error('Error loading service providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterProviders = () => {
    let filtered = providers;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (provider) =>
          provider.business_name.toLowerCase().includes(query) ||
          provider.service_category.toLowerCase().includes(query)
      );
    }

    if (locationQuery.trim()) {
      const query = locationQuery.toLowerCase();
      filtered = filtered.filter((provider) =>
        provider.service_areas?.some((area) => area.toLowerCase().includes(query))
      );
    }

    if (filters.category) {
      filtered = filtered.filter(
        (provider) => provider.service_category === filters.category
      );
    }

    if (filters.minRating) {
      const minRating = parseFloat(filters.minRating);
      filtered = filtered.filter(
        (provider) => provider.average_rating >= minRating
      );
    }

    if (filters.minYearsExperience) {
      const minYears = parseInt(filters.minYearsExperience);
      filtered = filtered.filter(
        (provider) => provider.years_experience >= minYears
      );
    }

    if (filters.insuranceVerified) {
      filtered = filtered.filter((provider) => provider.insurance_verified);
    }

    setFilteredProviders(filtered);
  };

  const handleContactProvider = (provider: ServiceProviderProfile) => {
    setSelectedProvider({
      id: provider.id,
      name: provider.business_name,
    });
    setContactModalOpen(true);
  };

  const handleContactSuccess = () => {
    setContactModalOpen(false);
    setSelectedProvider(null);
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 5000);
  };

  const clearFilters = () => {
    setFilters({
      category: '',
      minRating: '',
      minYearsExperience: '',
      insuranceVerified: false,
    });
    setSearchQuery('');
    setLocationQuery('');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(user ? '/dashboard' : '/')}
              className="text-gray-600 hover:text-blue-600 transition"
              title={user ? 'Back to Dashboard' : 'Back to Home'}
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-3xl font-bold text-gray-800">Find a Service Provider</h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4">
        {showSuccessMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-center">
            Your message has been sent successfully! The service provider will contact you soon.
          </div>
        )}

        <div className="mb-6 flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by business name or service..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex-1 relative">
            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Service area..."
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            <SlidersHorizontal size={20} />
            <span>Filters</span>
          </button>
        </div>

        {showFilters && (
          <div className="mb-6 p-6 bg-white rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Advanced Filters</h3>
              <button
                onClick={clearFilters}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear All
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Service Category
                </label>
                <select
                  value={filters.category}
                  onChange={(e) =>
                    setFilters({ ...filters, category: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Categories</option>
                  {SERVICE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum Rating
                </label>
                <select
                  value={filters.minRating}
                  onChange={(e) =>
                    setFilters({ ...filters, minRating: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Any Rating</option>
                  <option value="4.5">4.5+ Stars</option>
                  <option value="4.0">4.0+ Stars</option>
                  <option value="3.5">3.5+ Stars</option>
                  <option value="3.0">3.0+ Stars</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum Experience
                </label>
                <select
                  value={filters.minYearsExperience}
                  onChange={(e) =>
                    setFilters({ ...filters, minYearsExperience: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Any Experience</option>
                  <option value="15">15+ Years</option>
                  <option value="10">10+ Years</option>
                  <option value="5">5+ Years</option>
                  <option value="2">2+ Years</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Insurance Status
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.insuranceVerified}
                    onChange={(e) =>
                      setFilters({ ...filters, insuranceVerified: e.target.checked })
                    }
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Insurance Verified Only</span>
                </label>
              </div>
            </div>
          </div>
        )}

        <div className="mb-4 flex items-center justify-between">
          <p className="text-gray-600">
            Found <span className="font-semibold">{filteredProviders.length}</span> service provider{filteredProviders.length !== 1 ? 's' : ''}
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading service providers...</p>
          </div>
        ) : filteredProviders.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
            {filteredProviders.map((provider) => (
              <div
                key={provider.id}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition cursor-pointer overflow-hidden"
                onClick={() => navigate(`/provider/${provider.id}`)}
              >
                <div className="p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="bg-blue-100 rounded-lg p-3 flex-shrink-0">
                      {provider.logo_url ? (
                        <img
                          src={provider.logo_url}
                          alt={provider.business_name}
                          className="w-12 h-12 object-cover rounded"
                        />
                      ) : (
                        <Briefcase className="text-blue-600" size={32} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg text-gray-800 mb-1 truncate">
                        {provider.business_name}
                      </h3>
                      <p className="text-sm text-blue-600 font-medium">
                        {provider.service_category}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex items-center gap-1">
                      <Star className="text-yellow-400 fill-current" size={16} />
                      <span className="font-semibold text-gray-800">
                        {provider.average_rating.toFixed(1)}
                      </span>
                      <span className="text-gray-500 text-sm">
                        ({provider.total_reviews} reviews)
                      </span>
                    </div>
                    {provider.insurance_verified && (
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle size={16} />
                        <span className="text-xs font-medium">Insured</span>
                      </div>
                    )}
                  </div>

                  {provider.service_areas && provider.service_areas.length > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center gap-1 text-gray-600 text-sm">
                        <MapPin size={14} />
                        <span className="truncate">{provider.service_areas.slice(0, 2).join(', ')}</span>
                        {provider.service_areas.length > 2 && (
                          <span className="text-gray-500">+{provider.service_areas.length - 2}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {provider.bio && (
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                      {provider.bio}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Briefcase size={16} />
                        <span>{provider.years_experience} years</span>
                      </div>
                      <div>
                        <span className="font-medium">{provider.total_jobs_completed}</span> jobs
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-6 pb-6">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleContactProvider(provider);
                    }}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition font-medium"
                  >
                    Contact Provider
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-lg">
            <p className="text-gray-600 text-lg mb-2">No service providers found</p>
            <p className="text-gray-500">Try adjusting your search or filters</p>
          </div>
        )}
      </div>

      {contactModalOpen && selectedProvider && (
        <ContactProviderModal
          providerId={selectedProvider.id}
          providerName={selectedProvider.name}
          onClose={() => {
            setContactModalOpen(false);
            setSelectedProvider(null);
          }}
          onSuccess={handleContactSuccess}
        />
      )}
    </div>
  );
}
