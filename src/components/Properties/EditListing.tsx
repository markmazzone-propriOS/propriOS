import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, Property } from '../../lib/supabase';
import { useNavigate } from '../Navigation/Router';
import { Upload, X } from 'lucide-react';

type EditListingProps = {
  propertyId: string;
};

export function EditListing({ propertyId }: EditListingProps) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<{ id: string; photo_url: string; display_order: number }[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string>('');
  const [existingLogoUrl, setExistingLogoUrl] = useState<string>('');

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

  useEffect(() => {
    loadProperty();
  }, [propertyId]);

  const loadProperty = async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select(`
          *,
          photos:property_photos(id, photo_url, display_order)
        `)
        .eq('id', propertyId)
        .single();

      if (error) throw error;

      if (!data) {
        setError('Property not found');
        setLoading(false);
        return;
      }

      if (user) {
        const isOwner = data.agent_id === user.id || data.seller_id === user.id;

        if (!isOwner) {
          const { data: managedAccount } = await supabase
            .from('agent_managed_accounts')
            .select('can_edit_listings, agent_id')
            .eq('managed_user_id', user.id)
            .eq('agent_id', data.agent_id)
            .maybeSingle();

          if (!managedAccount?.can_edit_listings) {
            setError('You do not have permission to edit this property');
            setLoading(false);
            return;
          }
        }
      }

      setFormData({
        listing_type: data.listing_type,
        price: data.price.toString(),
        estimated_monthly: data.estimated_monthly?.toString() || '',
        bedrooms: data.bedrooms.toString(),
        bathrooms: data.bathrooms.toString(),
        square_footage: data.square_footage.toString(),
        lot_size: data.lot_size?.toString() || '',
        address_line1: data.address_line1,
        address_line2: data.address_line2 || '',
        city: data.city,
        state: data.state,
        zip_code: data.zip_code,
        description: data.description,
        year_built: data.year_built?.toString() || '',
        hidden_from_public: data.hidden_from_public || false,
        listed_by_name: data.listed_by_name || '',
        brokerage: data.brokerage || '',
        source: data.source || '',
        mls_number: data.mls_number || '',
        originating_mls: data.originating_mls || '',
      });

      setExistingPhotos(data.photos.sort((a: any, b: any) => a.display_order - b.display_order));
      setExistingLogoUrl(data.listing_source_logo_url || '');
    } catch (err: any) {
      setError(err.message || 'Failed to load property');
    } finally {
      setLoading(false);
    }
  };

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

  const removeNewPhoto = (index: number) => {
    URL.revokeObjectURL(photoPreviewUrls[index]);
    setPhotoFiles(photoFiles.filter((_, i) => i !== index));
    setPhotoPreviewUrls(photoPreviewUrls.filter((_, i) => i !== index));
  };

  const removeExistingPhoto = async (photoId: string) => {
    try {
      const { error } = await supabase
        .from('property_photos')
        .delete()
        .eq('id', photoId);

      if (error) throw error;

      setExistingPhotos(existingPhotos.filter(p => p.id !== photoId));
    } catch (err: any) {
      alert('Failed to delete photo: ' + err.message);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl);
    }

    setLogoFile(file);
    setLogoPreviewUrl(URL.createObjectURL(file));
  };

  const removeLogo = () => {
    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl);
    }
    setLogoFile(null);
    setLogoPreviewUrl('');
    setExistingLogoUrl('');
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

  const uploadPhotos = async (): Promise<string[]> => {
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

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile) return null;

    const fileExt = logoFile.name.split('.').pop();
    const fileName = `${user!.id}/${propertyId}/logo-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('listing-source-logos')
      .upload(fileName, logoFile, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('listing-source-logos')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setError('');

    try {
      const coordinates = await geocodeAddress(
        formData.address_line1,
        formData.city,
        formData.state,
        formData.zip_code
      );

      let logoUrl: string | null = existingLogoUrl || null;
      if (logoFile) {
        logoUrl = await uploadLogo();
      } else if (!existingLogoUrl) {
        logoUrl = null;
      }

      const { error: propertyError } = await supabase
        .from('properties')
        .update({
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
          hidden_from_public: formData.hidden_from_public,
          listed_by_name: formData.listed_by_name || null,
          brokerage: formData.brokerage || null,
          source: formData.source || null,
          mls_number: formData.mls_number || null,
          originating_mls: formData.originating_mls || null,
          listing_source_logo_url: logoUrl,
        })
        .eq('id', propertyId);

      if (propertyError) throw propertyError;

      if (photoFiles.length > 0) {
        setUploadingPhotos(true);
        const uploadedUrls = await uploadPhotos();

        const photoInserts = uploadedUrls.map((url, index) => ({
          property_id: propertyId,
          photo_url: url,
          display_order: existingPhotos.length + index,
        }));

        const { error: photoError } = await supabase
          .from('property_photos')
          .insert(photoInserts);

        if (photoError) throw photoError;
      }

      photoPreviewUrls.forEach(url => URL.revokeObjectURL(url));

      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to update listing');
    } finally {
      setSaving(false);
      setUploadingPhotos(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Loading property...</p>
      </div>
    );
  }

  if (error && !formData.address_line1) {
    return (
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md p-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md p-8">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">Edit Property Listing</h2>

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

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Source Logo
            </label>
            {(logoPreviewUrl || existingLogoUrl) ? (
              <div className="relative inline-block">
                <img
                  src={logoPreviewUrl || existingLogoUrl}
                  alt="Source logo preview"
                  className="h-20 w-auto object-contain border-2 border-gray-200 rounded-lg p-2 bg-white"
                />
                <button
                  type="button"
                  onClick={removeLogo}
                  className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full hover:bg-red-600 transition"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="inline-block">
                <input
                  type="file"
                  id="logo-upload"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                />
                <label
                  htmlFor="logo-upload"
                  className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 transition"
                >
                  <Upload className="text-gray-400" size={20} />
                  <span className="text-sm text-gray-600">Upload logo</span>
                </label>
              </div>
            )}
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
            Description <span className="text-gray-400 text-sm">(Optional)</span>
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
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
            {existingPhotos.length > 0 && (
              <div>
                <p className="text-sm text-gray-600 mb-2">Existing Photos</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {existingPhotos.map((photo) => (
                    <div key={photo.id} className="relative group">
                      <img
                        src={photo.photo_url}
                        alt="Property"
                        className="w-full h-40 object-cover rounded-lg border-2 border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={() => removeExistingPhoto(photo.id)}
                        className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full hover:bg-red-600 transition opacity-0 group-hover:opacity-100"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {photoPreviewUrls.length > 0 && (
              <div>
                <p className="text-sm text-gray-600 mb-2">New Photos</p>
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
                        onClick={() => removeNewPhoto(index)}
                        className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full hover:bg-red-600 transition opacity-0 group-hover:opacity-100"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
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
                <p className="text-gray-600 font-medium">Click to upload additional photos</p>
                <p className="text-sm text-gray-500">PNG, JPG, or WEBP (max 5MB each)</p>
              </label>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {saving ? (uploadingPhotos ? 'Uploading Photos...' : 'Saving Changes...') : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
