import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useNavigate } from '../Navigation/Router';
import { Upload, X } from 'lucide-react';

export function CreateListing() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    listing_type: 'sale' as 'sale' | 'rent',
    price: '',
    estimated_monthly: '',
    bedrooms: '',
    bathrooms: '',
    square_footage: '',
    lot_size: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    zip_code: '',
    description: '',
    year_built: '',
    hidden_from_public: false,
    listed_by_name: '',
    brokerage: '',
    source: '',
    mls_number: '',
    originating_mls: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newFiles = [...photoFiles, ...files];
    setPhotoFiles(newFiles);

    const newPreviews = files.map(file => URL.createObjectURL(file));
    setPhotoPreviewUrls([...photoPreviewUrls, ...newPreviews]);
  };

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(photoPreviewUrls[index]);
    setPhotoFiles(photoFiles.filter((_, i) => i !== index));
    setPhotoPreviewUrls(photoPreviewUrls.filter((_, i) => i !== index));
  };

  const geocodeAddress = async (address: string, city: string, state: string, zipCode: string): Promise<{ lat: number; lon: number } | null> => {
    try {
      const query = `${address}, ${city}, ${state} ${zipCode}, USA`;
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
      );

      if (!response.ok) return null;

      const data = await response.json();
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lon: parseFloat(data[0].lon)
        };
      }

      return null;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  };

  const uploadPhotos = async (propertyId: string): Promise<string[]> => {
    const uploadedUrls: string[] = [];

    for (let i = 0; i < photoFiles.length; i++) {
      const file = photoFiles[i];
      const fileExt = file.name.split('.').pop();
      const fileName = `${user!.id}/${propertyId}/${Date.now()}-${i}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('property-photos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('property-photos')
        .getPublicUrl(fileName);

      uploadedUrls.push(publicUrl);
    }

    return uploadedUrls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError('');

    try {
      const isAgent = profile?.user_type === 'agent';

      let agentId = isAgent ? user.id : null;

      if (profile?.managed_by_agent_id) {
        const { data: managedAccount } = await supabase
          .from('agent_managed_accounts')
          .select('agent_id, can_create_listings')
          .eq('managed_user_id', user.id)
          .single();

        if (managedAccount?.can_create_listings) {
          agentId = managedAccount.agent_id;
        }
      }

      const coordinates = await geocodeAddress(
        formData.address_line1,
        formData.city,
        formData.state,
        formData.zip_code
      );

      const { data: property, error: propertyError } = await supabase
        .from('properties')
        .insert({
          listed_by: user.id,
          seller_id: profile?.user_type === 'seller' ? user.id : null,
          agent_id: agentId,
          listing_type: formData.listing_type,
          price: parseFloat(formData.price),
          estimated_monthly: formData.estimated_monthly ? parseFloat(formData.estimated_monthly) : null,
          bedrooms: parseInt(formData.bedrooms),
          bathrooms: parseFloat(formData.bathrooms),
          square_footage: parseInt(formData.square_footage),
          lot_size: formData.lot_size || null,
          address_line1: formData.address_line1,
          address_line2: formData.address_line2 || null,
          city: formData.city,
          state: formData.state,
          zip_code: formData.zip_code,
          latitude: coordinates?.lat || null,
          longitude: coordinates?.lon || null,
          description: formData.description,
          year_built: formData.year_built ? parseInt(formData.year_built) : null,
          status: 'active',
          hidden_from_public: formData.hidden_from_public,
          listed_by_name: formData.listed_by_name || null,
          brokerage: formData.brokerage || null,
          source: formData.source || null,
          mls_number: formData.mls_number || null,
          originating_mls: formData.originating_mls || null,
        })
        .select()
        .single();

      if (propertyError) throw propertyError;

      if (photoFiles.length > 0 && property) {
        setUploadingPhotos(true);
        const uploadedUrls = await uploadPhotos(property.id);

        const photoInserts = uploadedUrls.map((url, index) => ({
          property_id: property.id,
          photo_url: url,
          display_order: index,
        }));

        const { error: photoError } = await supabase
          .from('property_photos')
          .insert(photoInserts);

        if (photoError) throw photoError;
      }

      photoPreviewUrls.forEach(url => URL.revokeObjectURL(url));

      if (profile?.user_type === 'agent') {
        navigate('/agent/dashboard');
      } else if (profile?.user_type === 'seller') {
        navigate('/dashboard');
      } else {
        navigate('/properties');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create listing');
    } finally {
      setLoading(false);
      setUploadingPhotos(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md p-8">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">Create Property Listing</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Listing Type
            </label>
            <select
              name="listing_type"
              value={formData.listing_type}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="sale">For Sale</option>
              <option value="rent">For Rent</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Price ($)
            </label>
            <input
              type="number"
              name="price"
              value={formData.price}
              onChange={handleInputChange}
              required
              min="0"
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {formData.listing_type === 'sale' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estimated Monthly Rent Payment ($)
            </label>
            <input
              type="number"
              name="estimated_monthly"
              value={formData.estimated_monthly}
              onChange={handleInputChange}
              min="0"
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bedrooms
            </label>
            <input
              type="number"
              name="bedrooms"
              value={formData.bedrooms}
              onChange={handleInputChange}
              required
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bathrooms
            </label>
            <input
              type="number"
              name="bathrooms"
              value={formData.bathrooms}
              onChange={handleInputChange}
              required
              min="0"
              step="0.5"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Square Footage
            </label>
            <input
              type="number"
              name="square_footage"
              value={formData.square_footage}
              onChange={handleInputChange}
              required
              min="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Lot Size
          </label>
          <input
            type="text"
            name="lot_size"
            value={formData.lot_size}
            onChange={handleInputChange}
            placeholder="e.g., 0.25 acres, 10,890 sq ft, 0.5 hectares"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Address Line 1
          </label>
          <input
            type="text"
            name="address_line1"
            value={formData.address_line1}
            onChange={handleInputChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Address Line 2 (Optional)
          </label>
          <input
            type="text"
            name="address_line2"
            value={formData.address_line2}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              City
            </label>
            <input
              type="text"
              name="city"
              value={formData.city}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              State
            </label>
            <input
              type="text"
              name="state"
              value={formData.state}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ZIP Code
            </label>
            <input
              type="text"
              name="zip_code"
              value={formData.zip_code}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Year Built
          </label>
          <input
            type="number"
            name="year_built"
            value={formData.year_built}
            onChange={handleInputChange}
            min="1800"
            max={new Date().getFullYear()}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="border-t border-gray-200 pt-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Listing Source Information (Optional)</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Listed by
              </label>
              <input
                type="text"
                name="listed_by_name"
                value={formData.listed_by_name}
                onChange={handleInputChange}
                placeholder="Agent or broker name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Brokerage
              </label>
              <input
                type="text"
                name="brokerage"
                value={formData.brokerage}
                onChange={handleInputChange}
                placeholder="Brokerage name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Source
              </label>
              <input
                type="text"
                name="source"
                value={formData.source}
                onChange={handleInputChange}
                placeholder="e.g., MLS, Direct, FSBO"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                MLS#
              </label>
              <input
                type="text"
                name="mls_number"
                value={formData.mls_number}
                onChange={handleInputChange}
                placeholder="MLS listing number"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Originating MLS
              </label>
              <input
                type="text"
                name="originating_mls"
                value={formData.originating_mls}
                onChange={handleInputChange}
                placeholder="e.g., California Regional MLS"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            required
            rows={5}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="border-t border-gray-200 pt-6">
          <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-100 transition">
            <input
              type="checkbox"
              checked={formData.hidden_from_public}
              onChange={(e) => setFormData({ ...formData, hidden_from_public: e.target.checked })}
              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />
            <div>
              <span className="font-medium text-gray-800">Hide from public view</span>
              <p className="text-sm text-gray-600 mt-1">
                When enabled, this listing will be hidden from public search results and the Browse page. You will still be able to view and edit it.
              </p>
            </div>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Property Photos
          </label>
          <div className="space-y-4">
            {photoPreviewUrls.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {photoPreviewUrls.map((url, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={url}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-40 object-cover rounded-lg border-2 border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full hover:bg-red-600 transition opacity-0 group-hover:opacity-100"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition">
              <input
                type="file"
                id="photo-upload"
                accept="image/*"
                multiple
                onChange={handlePhotoChange}
                className="hidden"
              />
              <label
                htmlFor="photo-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <Upload className="text-gray-400" size={40} />
                <p className="text-gray-600 font-medium">Click to upload photos</p>
                <p className="text-sm text-gray-500">PNG, JPG, or WEBP (max 5MB each)</p>
              </label>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? (uploadingPhotos ? 'Uploading Photos...' : 'Creating Listing...') : 'Create Listing'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/properties')}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
