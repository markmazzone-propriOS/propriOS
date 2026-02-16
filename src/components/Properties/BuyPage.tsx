import { useState, useEffect } from 'react';
import { Search, ArrowLeft, Map, Grid, SlidersHorizontal, X, Calculator } from 'lucide-react';
import { supabase, Property } from '../../lib/supabase';
import { PropertyCard } from './PropertyCard';
import { PropertyMap } from './PropertyMap';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from '../Navigation/Router';

export function BuyPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [properties, setProperties] = useState<(Property & { photos?: { photo_url: string }[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchCity, setSearchCity] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('map');
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState({
    minPrice: '',
    maxPrice: '',
    minBedrooms: '',
    maxBedrooms: '',
    minBathrooms: '',
    maxBathrooms: '',
    minSquareFeet: '',
    maxSquareFeet: '',
    minYearBuilt: '',
    maxYearBuilt: '',
    maxDaysOnSite: ''
  });

  useEffect(() => {
    loadProperties();
  }, []);

  useEffect(() => {
    const savedViewMode = sessionStorage.getItem('buyPageViewMode');
    if (savedViewMode === 'grid' || savedViewMode === 'map') {
      setViewMode(savedViewMode);
    }
  }, []);

  const loadProperties = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('properties')
        .select(`
          *,
          photos:property_photos(photo_url)
        `)
        .eq('status', 'active')
        .eq('listing_type', 'sale')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProperties(data || []);
    } catch (error) {
      console.error('Error loading properties:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewModeChange = (mode: 'grid' | 'map') => {
    setViewMode(mode);
    sessionStorage.setItem('buyPageViewMode', mode);
  };

  const handlePropertyClick = (propertyId: string) => {
    sessionStorage.setItem('buyPageViewMode', viewMode);
    navigate(`/properties/${propertyId}?from=buy`);
  };

  const clearFilters = () => {
    setFilters({
      minPrice: '',
      maxPrice: '',
      minBedrooms: '',
      maxBedrooms: '',
      minBathrooms: '',
      maxBathrooms: '',
      minSquareFeet: '',
      maxSquareFeet: '',
      minYearBuilt: '',
      maxYearBuilt: '',
      maxDaysOnSite: ''
    });
  };

  const hasActiveFilters = Object.values(filters).some(value => value !== '');

  const filteredProperties = properties.filter((property) => {
    const matchesCity = searchCity === '' ||
      property.city.toLowerCase().includes(searchCity.toLowerCase()) ||
      property.state.toLowerCase().includes(searchCity.toLowerCase());

    const matchesMinPrice = !filters.minPrice || property.price >= parseFloat(filters.minPrice);
    const matchesMaxPrice = !filters.maxPrice || property.price <= parseFloat(filters.maxPrice);
    const matchesMinBedrooms = !filters.minBedrooms || property.bedrooms >= parseInt(filters.minBedrooms);
    const matchesMaxBedrooms = !filters.maxBedrooms || property.bedrooms <= parseInt(filters.maxBedrooms);
    const matchesMinBathrooms = !filters.minBathrooms || property.bathrooms >= parseFloat(filters.minBathrooms);
    const matchesMaxBathrooms = !filters.maxBathrooms || property.bathrooms <= parseFloat(filters.maxBathrooms);
    const matchesMinSquareFeet = !filters.minSquareFeet || property.square_footage >= parseInt(filters.minSquareFeet);
    const matchesMaxSquareFeet = !filters.maxSquareFeet || property.square_footage <= parseInt(filters.maxSquareFeet);
    const matchesMinYearBuilt = !filters.minYearBuilt || (property.year_built && property.year_built >= parseInt(filters.minYearBuilt));
    const matchesMaxYearBuilt = !filters.maxYearBuilt || (property.year_built && property.year_built <= parseInt(filters.maxYearBuilt));

    const matchesDaysOnSite = !filters.maxDaysOnSite || (() => {
      const daysOnSite = Math.floor((Date.now() - new Date(property.created_at).getTime()) / (1000 * 60 * 60 * 24));
      return daysOnSite <= parseInt(filters.maxDaysOnSite);
    })();

    return matchesCity && matchesMinPrice && matchesMaxPrice &&
           matchesMinBedrooms && matchesMaxBedrooms && matchesMinBathrooms && matchesMaxBathrooms &&
           matchesMinSquareFeet && matchesMaxSquareFeet && matchesMinYearBuilt && matchesMaxYearBuilt &&
           matchesDaysOnSite;
  });

  return (
    <div>
      <div className="bg-white shadow-sm border-b mb-8">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(user ? '/dashboard' : '/')}
              className="text-gray-600 hover:text-blue-600 transition"
              title={user ? 'Back to Dashboard' : 'Back to Home'}
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-3xl font-bold text-gray-800">Buy a Home</h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-6 flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by city or state..."
              value={searchCity}
              onChange={(e) => setSearchCity(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-3 rounded-md border transition ${
              showFilters || hasActiveFilters
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <SlidersHorizontal size={20} />
            Filters
            {hasActiveFilters && (
              <span className="bg-white text-blue-600 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                {Object.values(filters).filter(v => v !== '').length}
              </span>
            )}
          </button>
          <div className="flex gap-2 bg-gray-100 p-1 rounded-md">
            <button
              onClick={() => handleViewModeChange('grid')}
              className={`flex items-center gap-2 px-4 py-2 rounded transition ${
                viewMode === 'grid'
                  ? 'bg-white text-blue-600 shadow-sm font-medium'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Grid size={20} />
              Grid
            </button>
            <button
              onClick={() => handleViewModeChange('map')}
              className={`flex items-center gap-2 px-4 py-2 rounded transition ${
                viewMode === 'map'
                  ? 'bg-white text-blue-600 shadow-sm font-medium'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Map size={20} />
              Map
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="mb-6 bg-white rounded-lg border border-gray-300 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Advanced Filters</h3>
              <div className="flex items-center gap-3">
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Clear All
                  </button>
                )}
                <button
                  onClick={() => setShowFilters(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Price Range</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.minPrice}
                    onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.maxPrice}
                    onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bedrooms</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.minBedrooms}
                    onChange={(e) => setFilters({ ...filters, minBedrooms: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.maxBedrooms}
                    onChange={(e) => setFilters({ ...filters, maxBedrooms: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bathrooms</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.5"
                    placeholder="Min"
                    value={filters.minBathrooms}
                    onChange={(e) => setFilters({ ...filters, minBathrooms: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    step="0.5"
                    placeholder="Max"
                    value={filters.maxBathrooms}
                    onChange={(e) => setFilters({ ...filters, maxBathrooms: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Square Footage</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.minSquareFeet}
                    onChange={(e) => setFilters({ ...filters, minSquareFeet: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.maxSquareFeet}
                    onChange={(e) => setFilters({ ...filters, maxSquareFeet: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Year Built</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.minYearBuilt}
                    onChange={(e) => setFilters({ ...filters, minYearBuilt: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.maxYearBuilt}
                    onChange={(e) => setFilters({ ...filters, maxYearBuilt: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Days on Site</label>
                <input
                  type="number"
                  placeholder="Max days listed"
                  value={filters.maxDaysOnSite}
                  onChange={(e) => setFilters({ ...filters, maxDaysOnSite: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">Only show properties listed within this many days</p>
              </div>
            </div>

            <div className="mt-4 text-sm text-gray-600">
              Showing <span className="font-semibold text-gray-800">{filteredProperties.length}</span> of <span className="font-semibold text-gray-800">{properties.length}</span> homes for sale
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading properties...</p>
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">No homes for sale found</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
            {filteredProperties.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        ) : (
          <>
            {filteredProperties.filter(p => p.latitude && p.longitude).length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-300 p-12 text-center">
                <p className="text-gray-600 text-lg mb-2">No properties with map coordinates found</p>
                <p className="text-gray-500 text-sm">Properties need location data to display on the map</p>
              </div>
            ) : (
              <div className="h-[600px] mb-12 rounded-lg overflow-hidden border border-gray-300 bg-gray-100">
                <PropertyMap properties={filteredProperties} onPropertyClick={handlePropertyClick} />
              </div>
            )}
          </>
        )}

        <section className="py-20">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl shadow-xl p-12 text-white">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-white/20 rounded-lg p-3">
                    <Calculator size={32} />
                  </div>
                  <h2 className="text-3xl font-bold">Mortgage Calculator</h2>
                </div>
                <p className="text-blue-100 text-lg mb-6">
                  Calculate your monthly mortgage payments and see how much home you can afford. Get instant estimates with our easy-to-use calculator.
                </p>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-200 rounded-full"></div>
                    <span>Estimate monthly payments</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-200 rounded-full"></div>
                    <span>Compare different loan scenarios</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-200 rounded-full"></div>
                    <span>Plan your home buying budget</span>
                  </li>
                </ul>
                <button
                  onClick={() => navigate('/mortgage-calculator')}
                  className="bg-white text-blue-600 px-8 py-4 rounded-lg font-semibold hover:bg-blue-50 transition shadow-lg"
                >
                  Try Calculator
                </button>
              </div>
              <div className="hidden md:block">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 border border-white/20">
                  <div className="space-y-4">
                    <div className="bg-white/10 rounded-lg p-4">
                      <p className="text-blue-100 text-sm mb-1">Home Price</p>
                      <p className="text-2xl font-bold">$350,000</p>
                    </div>
                    <div className="bg-white/10 rounded-lg p-4">
                      <p className="text-blue-100 text-sm mb-1">Down Payment</p>
                      <p className="text-2xl font-bold">$70,000</p>
                    </div>
                    <div className="bg-white/10 rounded-lg p-4">
                      <p className="text-blue-100 text-sm mb-1">Monthly Payment</p>
                      <p className="text-2xl font-bold">$1,896</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
