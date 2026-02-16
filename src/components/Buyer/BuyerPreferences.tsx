import { useState, useEffect } from 'react';
import { Save, ArrowLeft, Sliders } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from '../Navigation/Router';

type BuyerPreference = {
  id: string;
  buyer_id: string;
  min_price: number | null;
  max_price: number | null;
  min_bedrooms: number | null;
  max_bedrooms: number | null;
  min_bathrooms: number | null;
  max_bathrooms: number | null;
  min_sqft: number | null;
  max_sqft: number | null;
  max_days_on_site: number | null;
  property_types: string[] | null;
  locations: string[] | null;
};

const PROPERTY_TYPES = ['Single Family', 'Condo', 'Townhouse', 'Multi-Family', 'Land', 'Other'];

export function BuyerPreferences() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [preferences, setPreferences] = useState<BuyerPreference | null>(null);

  const [formData, setFormData] = useState({
    min_price: '',
    max_price: '',
    min_bedrooms: '',
    max_bedrooms: '',
    min_bathrooms: '',
    max_bathrooms: '',
    min_sqft: '',
    max_sqft: '',
    max_days_on_site: '',
    property_types: [] as string[],
    locations: '',
  });

  useEffect(() => {
    if (user) {
      loadPreferences();
    }
  }, [user]);

  const loadPreferences = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('buyer_preferences')
        .select('*')
        .eq('buyer_id', user!.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setPreferences(data);
        setFormData({
          min_price: data.min_price?.toString() || '',
          max_price: data.max_price?.toString() || '',
          min_bedrooms: data.min_bedrooms?.toString() || '',
          max_bedrooms: data.max_bedrooms?.toString() || '',
          min_bathrooms: data.min_bathrooms?.toString() || '',
          max_bathrooms: data.max_bathrooms?.toString() || '',
          min_sqft: data.min_sqft?.toString() || '',
          max_sqft: data.max_sqft?.toString() || '',
          max_days_on_site: data.max_days_on_site?.toString() || '',
          property_types: data.property_types || [],
          locations: data.locations?.join(', ') || '',
        });
      }
    } catch (err: any) {
      console.error('Error loading preferences:', err);
      setError(err.message || 'Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const locationsArray = formData.locations
        .split(',')
        .map(loc => loc.trim())
        .filter(loc => loc.length > 0);

      const preferencesData = {
        buyer_id: user!.id,
        min_price: formData.min_price ? parseFloat(formData.min_price) : null,
        max_price: formData.max_price ? parseFloat(formData.max_price) : null,
        min_bedrooms: formData.min_bedrooms ? parseInt(formData.min_bedrooms) : null,
        max_bedrooms: formData.max_bedrooms ? parseInt(formData.max_bedrooms) : null,
        min_bathrooms: formData.min_bathrooms ? parseFloat(formData.min_bathrooms) : null,
        max_bathrooms: formData.max_bathrooms ? parseFloat(formData.max_bathrooms) : null,
        min_sqft: formData.min_sqft ? parseInt(formData.min_sqft) : null,
        max_sqft: formData.max_sqft ? parseInt(formData.max_sqft) : null,
        max_days_on_site: formData.max_days_on_site ? parseInt(formData.max_days_on_site) : null,
        property_types: formData.property_types.length > 0 ? formData.property_types : null,
        locations: locationsArray.length > 0 ? locationsArray : null,
        updated_at: new Date().toISOString(),
      };

      if (preferences) {
        const { error: updateError } = await supabase
          .from('buyer_preferences')
          .update(preferencesData)
          .eq('id', preferences.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('buyer_preferences')
          .insert([preferencesData]);

        if (insertError) throw insertError;
      }

      setSuccess('Preferences saved successfully');
      await loadPreferences();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Error saving preferences:', err);
      setError(err.message || 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const togglePropertyType = (type: string) => {
    setFormData(prev => ({
      ...prev,
      property_types: prev.property_types.includes(type)
        ? prev.property_types.filter(t => t !== type)
        : [...prev.property_types, type]
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-white shadow-sm border-b mb-8 -mx-4 px-4 py-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-gray-600 hover:text-blue-600 transition"
            title="Back to Dashboard"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              <Sliders size={32} className="text-blue-600" />
              Search Preferences
            </h1>
            <p className="text-gray-600 mt-1">Set your property search criteria and filter preferences</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-8">
        <form onSubmit={handleSave} className="space-y-8">
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">Price Range</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum Price
                </label>
                <input
                  type="number"
                  value={formData.min_price}
                  onChange={(e) => setFormData({ ...formData, min_price: e.target.value })}
                  placeholder="e.g., 200000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maximum Price
                </label>
                <input
                  type="number"
                  value={formData.max_price}
                  onChange={(e) => setFormData({ ...formData, max_price: e.target.value })}
                  placeholder="e.g., 500000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">Bedrooms</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum Bedrooms
                </label>
                <input
                  type="number"
                  value={formData.min_bedrooms}
                  onChange={(e) => setFormData({ ...formData, min_bedrooms: e.target.value })}
                  placeholder="e.g., 2"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maximum Bedrooms
                </label>
                <input
                  type="number"
                  value={formData.max_bedrooms}
                  onChange={(e) => setFormData({ ...formData, max_bedrooms: e.target.value })}
                  placeholder="e.g., 4"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">Bathrooms</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum Bathrooms
                </label>
                <input
                  type="number"
                  value={formData.min_bathrooms}
                  onChange={(e) => setFormData({ ...formData, min_bathrooms: e.target.value })}
                  placeholder="e.g., 1.5"
                  step="0.5"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maximum Bathrooms
                </label>
                <input
                  type="number"
                  value={formData.max_bathrooms}
                  onChange={(e) => setFormData({ ...formData, max_bathrooms: e.target.value })}
                  placeholder="e.g., 3"
                  step="0.5"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">Square Footage</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum Square Feet
                </label>
                <input
                  type="number"
                  value={formData.min_sqft}
                  onChange={(e) => setFormData({ ...formData, min_sqft: e.target.value })}
                  placeholder="e.g., 1000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maximum Square Feet
                </label>
                <input
                  type="number"
                  value={formData.max_sqft}
                  onChange={(e) => setFormData({ ...formData, max_sqft: e.target.value })}
                  placeholder="e.g., 3000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">Days on Site</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maximum Days Listed
              </label>
              <input
                type="number"
                value={formData.max_days_on_site}
                onChange={(e) => setFormData({ ...formData, max_days_on_site: e.target.value })}
                placeholder="e.g., 30"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                Only show properties listed within this many days (leave empty for no limit)
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">Property Types</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {PROPERTY_TYPES.map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => togglePropertyType(type)}
                  className={`px-4 py-2 rounded-md border-2 transition font-medium ${
                    formData.property_types.includes(type)
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">Preferred Locations</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cities or Areas (comma-separated)
              </label>
              <input
                type="text"
                value={formData.locations}
                onChange={(e) => setFormData({ ...formData, locations: e.target.value })}
                placeholder="e.g., San Francisco, Oakland, Berkeley"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 text-white py-3 px-8 rounded-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium text-lg"
            >
              <Save size={20} />
              {saving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
