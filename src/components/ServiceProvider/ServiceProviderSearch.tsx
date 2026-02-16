import { useState, useEffect } from 'react';
import { useNavigate } from '../Navigation/Router';
import { supabase } from '../../lib/supabase';
import { Search, MapPin, Star, Briefcase, Phone, Mail, Award, CheckCircle, Filter, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

type ServiceProvider = {
  id: string;
  business_name: string;
  bio: string | null;
  years_experience: number;
  average_rating: number;
  total_reviews: number;
  total_jobs_completed: number;
  logo_url: string | null;
  business_address: string | null;
  business_email: string | null;
  license_number: string | null;
  insurance_verified: boolean;
  service_radius_miles: number;
  business_latitude: number | null;
  business_longitude: number | null;
  profile: {
    full_name: string;
    phone_number: string | null;
  };
  services: {
    category: {
      name: string;
    };
  }[];
  distance?: number;
};

type ServiceCategory = {
  id: string;
  name: string;
};

export function ServiceProviderSearch() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [maxDistance, setMaxDistance] = useState<number>(50);
  const [sortBy, setSortBy] = useState<'distance' | 'rating' | 'experience'>('rating');

  useEffect(() => {
    loadCategories();
    getUserLocation();
  }, []);

  useEffect(() => {
    loadProviders();
  }, [selectedCategory, userLocation]);

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.log('Location access denied or unavailable');
        }
      );
    }
  };

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('service_categories')
        .select('id, name')
        .order('name');

      if (error) throw error;
      if (data) setCategories(data);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadProviders = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('service_provider_profiles')
        .select(`
          *,
          profile:profiles!service_provider_profiles_id_fkey(
            full_name,
            phone_number
          ),
          services:service_provider_services(
            category:service_categories(name)
          )
        `);

      const { data, error } = await query;

      if (error) throw error;

      let filteredData = data || [];

      if (selectedCategory !== 'all') {
        filteredData = filteredData.filter(provider =>
          provider.services.some((s: any) => s.category?.name === selectedCategory)
        );
      }

      if (userLocation) {
        filteredData = filteredData.map(provider => {
          if (provider.business_latitude && provider.business_longitude) {
            const distance = calculateDistance(
              userLocation.lat,
              userLocation.lng,
              provider.business_latitude,
              provider.business_longitude
            );
            return { ...provider, distance };
          }
          return { ...provider, distance: Infinity };
        }).filter(provider => provider.distance <= maxDistance);
      }

      filteredData.sort((a, b) => {
        if (sortBy === 'distance' && a.distance !== undefined && b.distance !== undefined) {
          return a.distance - b.distance;
        } else if (sortBy === 'rating') {
          return b.average_rating - a.average_rating;
        } else if (sortBy === 'experience') {
          return b.years_experience - a.years_experience;
        }
        return 0;
      });

      setProviders(filteredData);
    } catch (error) {
      console.error('Error loading providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 3959;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const filteredProviders = providers.filter(provider => {
    const matchesSearch = !searchQuery ||
      provider.business_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      provider.profile?.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      provider.services.some(s => s.category?.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        {profile?.user_type === 'property_owner' && (
          <button
            onClick={() => navigate('/property-owner/dashboard')}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-4"
          >
            <ArrowLeft size={20} />
            Back to Dashboard
          </button>
        )}
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Find Service Providers</h1>
        <p className="text-gray-600">
          Connect with trusted professionals for all your real estate service needs
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or service..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Services</option>
            {categories.map(category => (
              <option key={category.id} value={category.name}>{category.name}</option>
            ))}
          </select>

          <select
            value={maxDistance}
            onChange={(e) => {
              setMaxDistance(Number(e.target.value));
              loadProviders();
            }}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!userLocation}
          >
            <option value={10}>Within 10 miles</option>
            <option value={25}>Within 25 miles</option>
            <option value={50}>Within 50 miles</option>
            <option value={100}>Within 100 miles</option>
            <option value={999999}>Any distance</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="rating">Highest Rated</option>
            <option value="experience">Most Experience</option>
            {userLocation && <option value="distance">Nearest</option>}
          </select>
        </div>

        {!userLocation && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 flex items-start">
            <MapPin className="text-yellow-600 mr-2 flex-shrink-0 mt-0.5" size={18} />
            <p className="text-sm text-yellow-800">
              Enable location services to see providers near you and filter by distance
            </p>
          </div>
        )}
      </div>

      {filteredProviders.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <p className="text-gray-600 text-lg">No service providers found matching your criteria</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
              setMaxDistance(50);
            }}
            className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProviders.map(provider => (
            <div
              key={provider.id}
              onClick={() => navigate(`/service-provider/${provider.id}`)}
              className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow cursor-pointer overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center flex-1">
                    {provider.logo_url ? (
                      <img
                        src={provider.logo_url}
                        alt={provider.business_name}
                        className="w-16 h-16 rounded-lg object-cover mr-4"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                        <Briefcase className="text-blue-600" size={32} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-gray-800 truncate">
                        {provider.business_name}
                      </h3>
                      <p className="text-sm text-gray-600 truncate">
                        {provider.profile?.full_name}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <Star className="text-yellow-500 fill-current" size={18} />
                    <span className="ml-1 font-semibold text-gray-800">
                      {provider.average_rating.toFixed(1)}
                    </span>
                    <span className="ml-1 text-sm text-gray-600">
                      ({provider.total_reviews} reviews)
                    </span>
                  </div>
                  {provider.insurance_verified && (
                    <div className="flex items-center text-green-600" title="Insurance Verified">
                      <CheckCircle size={16} />
                    </div>
                  )}
                </div>

                <div className="space-y-2 mb-4">
                  {provider.business_address && (
                    <div className="flex items-start text-sm text-gray-600">
                      <MapPin size={16} className="mr-2 flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-1">{provider.business_address}</span>
                    </div>
                  )}
                  {provider.distance !== undefined && provider.distance !== Infinity && (
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">{provider.distance.toFixed(1)} miles away</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  {provider.services.slice(0, 3).map((service, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full"
                    >
                      {service.category?.name}
                    </span>
                  ))}
                  {provider.services.length > 3 && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                      +{provider.services.length - 3} more
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <div className="flex items-center text-sm text-gray-600">
                    <Award size={16} className="mr-1" />
                    <span>{provider.years_experience} years exp.</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {provider.total_jobs_completed} jobs completed
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/service-provider/${provider.id}`);
                  }}
                  className="w-full mt-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition font-medium"
                >
                  View Profile
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
