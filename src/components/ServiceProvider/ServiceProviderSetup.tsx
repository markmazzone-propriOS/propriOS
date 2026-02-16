import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useNavigate } from '../Navigation/Router';
import {
  Briefcase,
  Award,
  MapPin,
  FileText,
  Shield,
  TrendingUp,
  Plus,
  X,
  CheckCircle,
  Upload,
  Image as ImageIcon
} from 'lucide-react';

type ServiceCategory = {
  id: string;
  name: string;
};

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming'
];

export function ServiceProviderSetup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [validatingAddress, setValidatingAddress] = useState(false);
  const [addressValidated, setAddressValidated] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [formData, setFormData] = useState({
    businessName: '',
    businessAddress: '',
    contactName: '',
    phoneNumber: '',
    email: '',
    licenseNumber: '',
    yearsExperience: 0,
    bio: '',
    serviceRadiusMiles: 25,
    insuranceVerified: false,
    businessLatitude: null as number | null,
    businessLongitude: null as number | null,
  });

  const [selectedServices, setSelectedServices] = useState<
    { categoryId: string; serviceName: string; basePrice: string; description: string }[]
  >([]);

  const [serviceAreas, setServiceAreas] = useState<
    { city: string; state: string; zipCode: string }[]
  >([{ city: '', state: '', zipCode: '' }]);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('service_categories')
        .select('*')
        .order('name');

      if (error) throw error;
      if (data) setCategories(data);
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  };

  const addService = () => {
    setSelectedServices([
      ...selectedServices,
      { categoryId: '', serviceName: '', basePrice: '', description: '' }
    ]);
  };

  const removeService = (index: number) => {
    setSelectedServices(selectedServices.filter((_, i) => i !== index));
  };

  const updateService = (index: number, field: string, value: string) => {
    const updated = [...selectedServices];
    updated[index] = { ...updated[index], [field]: value };
    setSelectedServices(updated);
  };

  const addServiceArea = () => {
    setServiceAreas([...serviceAreas, { city: '', state: '', zipCode: '' }]);
  };

  const removeServiceArea = (index: number) => {
    setServiceAreas(serviceAreas.filter((_, i) => i !== index));
  };

  const updateServiceArea = (index: number, field: string, value: string) => {
    const updated = [...serviceAreas];
    updated[index] = { ...updated[index], [field]: value };
    setServiceAreas(updated);
  };

  const validateAddressWithGeocoding = async (address: string): Promise<{ success: boolean; displayName?: string; lat?: number; lon?: number }> => {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=us&addressdetails=1&limit=1`;
      console.log('Validating address:', address);
      console.log('API URL:', url);

      const response = await fetch(url);

      console.log('Response status:', response.status);

      if (!response.ok) {
        throw new Error('Geocoding service unavailable');
      }

      const data = await response.json();
      console.log('Geocoding response:', data);

      if (data && data.length > 0) {
        return {
          success: true,
          displayName: data[0].display_name,
          lat: parseFloat(data[0].lat),
          lon: parseFloat(data[0].lon)
        };
      }

      return { success: false };
    } catch (err) {
      console.error('Error validating address:', err);
      throw err;
    }
  };

  const [addressWarning, setAddressWarning] = useState('');

  const handleValidateAddress = async () => {
    const trimmed = formData.businessAddress.trim();

    if (trimmed.length < 10) {
      setError('Please enter a complete business address');
      setAddressValidated(false);
      setAddressWarning('');
      return;
    }

    const hasNumber = /\d/.test(trimmed);
    if (!hasNumber) {
      setError('Address must include a street number');
      setAddressValidated(false);
      setAddressWarning('');
      return;
    }

    setValidatingAddress(true);
    setError('');
    setAddressWarning('');

    try {
      const result = await validateAddressWithGeocoding(formData.businessAddress);

      if (result.success) {
        setAddressValidated(true);
        setAddressWarning('');
        console.log('Address validated successfully:', result.displayName);
        setFormData(prev => ({
          ...prev,
          businessLatitude: result.lat || null,
          businessLongitude: result.lon || null
        }));
      } else {
        setAddressValidated(true);
        setAddressWarning('Could not auto-verify address, but you may proceed. Please ensure the address is correct.');
      }
    } catch (err) {
      setAddressValidated(true);
      setAddressWarning('Could not auto-verify address, but you may proceed. Please ensure the address is correct.');
      console.error('Validation error:', err);
    } finally {
      setValidatingAddress(false);
    }
  };

  const handleNextStep = () => {
    if (!formData.businessAddress) {
      setError('Please enter a business address');
      return;
    }

    if (!addressValidated) {
      setError('Please validate your business address before continuing');
      return;
    }

    setError('');
    setStep(2);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Logo file must be less than 5MB');
        return;
      }
      if (!file.type.startsWith('image/')) {
        setError('Logo must be an image file');
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setError('');
    }
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile || !user) return null;

    setUploadingLogo(true);
    try {
      const fileExt = logoFile.name.split('.').pop();
      const fileName = `${user.id}/logo.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('service-provider-logos')
        .upload(fileName, logoFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('service-provider-logos')
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (err) {
      console.error('Error uploading logo:', err);
      throw err;
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let logoUrl = null;
      if (logoFile) {
        logoUrl = await uploadLogo();
      }

      const { error: userProfileError } = await supabase
        .from('profiles')
        .update({
          full_name: formData.contactName,
          phone_number: formData.phoneNumber,
        })
        .eq('id', user?.id);

      if (userProfileError) throw userProfileError;

      const { error: profileError } = await supabase
        .from('service_provider_profiles')
        .insert({
          id: user?.id,
          business_name: formData.businessName,
          business_address: formData.businessAddress,
          business_email: formData.email,
          license_number: formData.licenseNumber || null,
          insurance_verified: formData.insuranceVerified,
          years_experience: formData.yearsExperience,
          bio: formData.bio || null,
          service_radius_miles: formData.serviceRadiusMiles,
          logo_url: logoUrl,
          business_latitude: formData.businessLatitude,
          business_longitude: formData.businessLongitude,
        });

      if (profileError) throw profileError;

      if (selectedServices.length > 0) {
        const servicesData = selectedServices
          .filter(s => s.categoryId && s.serviceName)
          .map(s => ({
            provider_id: user?.id,
            category_id: s.categoryId,
            service_name: s.serviceName,
            description: s.description || null,
            base_price: s.basePrice ? parseFloat(s.basePrice) : null,
          }));

        if (servicesData.length > 0) {
          const { error: servicesError } = await supabase
            .from('service_provider_services')
            .insert(servicesData);

          if (servicesError) throw servicesError;
        }
      }

      if (serviceAreas.length > 0) {
        const areasData = serviceAreas
          .filter(a => a.city && a.state)
          .map(a => ({
            provider_id: user?.id,
            city: a.city,
            state: a.state,
            zip_code: a.zipCode || null,
          }));

        if (areasData.length > 0) {
          const { error: areasError } = await supabase
            .from('service_areas')
            .insert(areasData);

          if (areasError) throw areasError;
        }
      }

      navigate('/dashboard');
    } catch (err: any) {
      console.error('Error creating profile:', err);
      setError(err.message || 'Failed to create profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-lg">
        <div className="bg-blue-600 text-white p-8 rounded-t-lg">
          <h1 className="text-3xl font-bold mb-2">Complete Your Service Provider Profile</h1>
          <p className="text-blue-100">Set up your business profile to start receiving jobs</p>
          <div className="mt-6 flex items-center">
            <div className={`flex items-center ${step >= 1 ? 'text-white' : 'text-blue-300'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step >= 1 ? 'bg-white text-blue-600' : 'bg-blue-500'
              } font-bold`}>
                1
              </div>
              <span className="ml-2 font-medium">Business Info</span>
            </div>
            <div className="w-16 h-1 bg-blue-400 mx-4"></div>
            <div className={`flex items-center ${step >= 2 ? 'text-white' : 'text-blue-300'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step >= 2 ? 'bg-white text-blue-600' : 'bg-blue-500'
              } font-bold`}>
                2
              </div>
              <span className="ml-2 font-medium">Services & Areas</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="mx-8 mt-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Business Name *
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    value={formData.businessName}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                    required
                    placeholder="Your Business Name"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Business Address *
                </label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                      <input
                        type="text"
                        value={formData.businessAddress}
                        onChange={(e) => {
                          setFormData({ ...formData, businessAddress: e.target.value });
                          setAddressValidated(false);
                        }}
                        required
                        placeholder="123 Main St, City, State ZIP"
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleValidateAddress}
                      disabled={validatingAddress || !formData.businessAddress}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center"
                    >
                      {validatingAddress ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Validating...
                        </>
                      ) : (
                        'Validate Address'
                      )}
                    </button>
                  </div>
                  {addressValidated && !addressWarning && (
                    <div className="flex items-center text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                      <CheckCircle size={16} className="mr-2" />
                      <span className="text-sm font-medium">Address verified</span>
                    </div>
                  )}
                  {addressValidated && addressWarning && (
                    <div className="flex items-center text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                      <CheckCircle size={16} className="mr-2" />
                      <span className="text-sm font-medium">{addressWarning}</span>
                    </div>
                  )}
                  <p className="text-xs text-gray-500">
                    Enter your full business address including street, city, state, and ZIP code
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Name *
                </label>
                <input
                  type="text"
                  value={formData.contactName}
                  onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                  required
                  placeholder="Your full name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    required
                    placeholder="(555) 123-4567"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    placeholder="your@email.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    License Number
                  </label>
                  <div className="relative">
                    <Award className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="text"
                      value={formData.licenseNumber}
                      onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                      placeholder="License Number"
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Years of Experience *
                  </label>
                  <div className="relative">
                    <TrendingUp className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="number"
                      value={formData.yearsExperience}
                      onChange={(e) => setFormData({ ...formData, yearsExperience: parseInt(e.target.value) || 0 })}
                      required
                      min="0"
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Service Radius (miles) *
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="number"
                    value={formData.serviceRadiusMiles}
                    onChange={(e) => setFormData({ ...formData, serviceRadiusMiles: parseInt(e.target.value) || 0 })}
                    required
                    min="1"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bio
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 text-gray-400" size={20} />
                  <textarea
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    placeholder="Tell clients about your business and experience..."
                    rows={4}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Business Logo
                </label>
                <div className="flex items-start gap-4">
                  {logoPreview ? (
                    <div className="relative">
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        className="w-32 h-32 object-contain rounded-lg border-2 border-gray-200 bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setLogoFile(null);
                          setLogoPreview('');
                        }}
                        className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 transition"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                      <ImageIcon className="text-gray-400" size={32} />
                    </div>
                  )}
                  <div className="flex-1">
                    <label className="cursor-pointer inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition">
                      <Upload size={20} className="mr-2" />
                      Choose Logo
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        className="hidden"
                      />
                    </label>
                    <p className="text-xs text-gray-500 mt-2">
                      Upload your business logo (max 5MB). Recommended size: 500x500px
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="insurance"
                  checked={formData.insuranceVerified}
                  onChange={(e) => setFormData({ ...formData, insuranceVerified: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="insurance" className="ml-2 flex items-center text-sm text-gray-700">
                  <Shield className="mr-1" size={16} />
                  I have valid insurance coverage
                </label>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition"
                >
                  Next: Services & Areas
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Services Offered</h3>
                  <button
                    type="button"
                    onClick={addService}
                    className="flex items-center text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    <Plus size={16} className="mr-1" />
                    Add Service
                  </button>
                </div>

                {selectedServices.length === 0 ? (
                  <p className="text-gray-600 text-sm mb-4">Add services you offer to clients</p>
                ) : (
                  <div className="space-y-4">
                    {selectedServices.map((service, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="font-medium text-gray-800">Service {index + 1}</h4>
                          <button
                            type="button"
                            onClick={() => removeService(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X size={20} />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Category *
                            </label>
                            <select
                              value={service.categoryId}
                              onChange={(e) => updateService(index, 'categoryId', e.target.value)}
                              required
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            >
                              <option value="">Select category</option>
                              {categories.map((cat) => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Service Name *
                            </label>
                            <input
                              type="text"
                              value={service.serviceName}
                              onChange={(e) => updateService(index, 'serviceName', e.target.value)}
                              required
                              placeholder="e.g., Kitchen Remodel"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Base Price
                            </label>
                            <input
                              type="number"
                              value={service.basePrice}
                              onChange={(e) => updateService(index, 'basePrice', e.target.value)}
                              placeholder="Starting price"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Description
                            </label>
                            <input
                              type="text"
                              value={service.description}
                              onChange={(e) => updateService(index, 'description', e.target.value)}
                              placeholder="Brief description"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Service Areas</h3>
                  <button
                    type="button"
                    onClick={addServiceArea}
                    className="flex items-center text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    <Plus size={16} className="mr-1" />
                    Add Area
                  </button>
                </div>

                <div className="space-y-4">
                  {serviceAreas.map((area, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-medium text-gray-800">Area {index + 1}</h4>
                        {index > 0 && (
                          <button
                            type="button"
                            onClick={() => removeServiceArea(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X size={20} />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            City *
                          </label>
                          <input
                            type="text"
                            value={area.city}
                            onChange={(e) => updateServiceArea(index, 'city', e.target.value)}
                            required
                            placeholder="City"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            State *
                          </label>
                          <select
                            value={area.state}
                            onChange={(e) => updateServiceArea(index, 'state', e.target.value)}
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          >
                            <option value="">Select state</option>
                            {US_STATES.map((state) => (
                              <option key={state} value={state}>{state}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            ZIP Code
                          </label>
                          <input
                            type="text"
                            value={area.zipCode}
                            onChange={(e) => updateServiceArea(index, 'zipCode', e.target.value)}
                            placeholder="ZIP"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-gray-600 hover:text-gray-800 font-medium"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creating Profile...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={20} className="mr-2" />
                      Complete Setup
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
