import { useState, useEffect } from 'react';
import { Building2, Upload, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from '../Navigation/Router';

const LOAN_TYPE_OPTIONS = [
  'Conventional',
  'FHA',
  'VA',
  'USDA',
  'Jumbo',
  'VA Jumbo',
  'Refinance',
  'First-Time Buyer',
  'Investment Property',
];

export function LenderSetup() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState('');
  const [nmlsNumber, setNmlsNumber] = useState('');
  const [bio, setBio] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [minimumCreditScore, setMinimumCreditScore] = useState('');
  const [interestRateRange, setInterestRateRange] = useState('');
  const [loanTypes, setLoanTypes] = useState<string[]>([]);
  const [yearsExperience, setYearsExperience] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [existingProfile, setExistingProfile] = useState(false);

  useEffect(() => {
    if (user && profile?.user_type === 'mortgage_lender') {
      loadExistingProfile();
    }
  }, [user, profile]);

  const loadExistingProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('mortgage_lender_profiles')
        .select('*')
        .eq('id', user!.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setExistingProfile(true);
        setCompanyName(data.company_name);
        setNmlsNumber(data.nmls_number);
        setBio(data.bio);
        setWebsiteUrl(data.website_url || '');
        setPhoneNumber(data.phone_number || '');
        setEmail(data.email || '');
        setMinimumCreditScore(data.minimum_credit_score?.toString() || '');
        setInterestRateRange(data.interest_rate_range || '');
        setLoanTypes(data.loan_types || []);
        setYearsExperience(data.years_experience?.toString() || '');
        if (data.logo_url) {
          setLogoPreview(data.logo_url);
        }
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleLoanType = (type: string) => {
    setLoanTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let logoUrl = logoPreview;

      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `${user!.id}-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('lender-logos')
          .upload(filePath, logoFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('lender-logos')
          .getPublicUrl(filePath);

        logoUrl = urlData.publicUrl;
      }

      const profileData = {
        id: user!.id,
        company_name: companyName,
        nmls_number: nmlsNumber,
        bio,
        logo_url: logoUrl,
        website_url: websiteUrl || null,
        phone_number: phoneNumber || null,
        email: email || null,
        minimum_credit_score: minimumCreditScore ? parseInt(minimumCreditScore) : null,
        interest_rate_range: interestRateRange || null,
        loan_types: loanTypes,
        years_experience: yearsExperience ? parseInt(yearsExperience) : null,
        updated_at: new Date().toISOString(),
      };

      if (existingProfile) {
        const { error: updateError } = await supabase
          .from('mortgage_lender_profiles')
          .update(profileData)
          .eq('id', user!.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('mortgage_lender_profiles')
          .insert(profileData);

        if (insertError) throw insertError;
      }

      navigate('/lender/dashboard');
    } catch (err: any) {
      console.error('Error saving profile:', err);
      setError(err.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  if (profile?.user_type !== 'mortgage_lender') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-md">
          Access denied. This page is only for mortgage lenders.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="bg-white rounded-lg shadow-md p-8">
        <div className="flex items-center gap-3 mb-6">
          <Building2 className="text-blue-600" size={32} />
          <div>
            <h1 className="text-3xl font-bold text-gray-800">
              {existingProfile ? 'Edit Lender Profile' : 'Set Up Your Lender Profile'}
            </h1>
            <p className="text-gray-600">
              Complete your profile to start connecting with homebuyers
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-md mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Name *
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                NMLS Number *
              </label>
              <input
                type="text"
                value={nmlsNumber}
                onChange={(e) => setNmlsNumber(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Company Logo
            </label>
            <div className="flex items-center gap-4">
              {logoPreview && (
                <div className="relative">
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="w-24 h-24 object-contain border border-gray-300 rounded-md"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setLogoFile(null);
                      setLogoPreview(null);
                    }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50">
                <Upload size={20} />
                <span>Upload Logo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Professional Bio *
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              required
              rows={4}
              placeholder="Tell homebuyers about your company and services..."
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Website URL
              </label>
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Years of Experience
              </label>
              <input
                type="number"
                value={yearsExperience}
                onChange={(e) => setYearsExperience(e.target.value)}
                min="0"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Business Phone
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Business Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Credit Score
              </label>
              <input
                type="number"
                value={minimumCreditScore}
                onChange={(e) => setMinimumCreditScore(e.target.value)}
                min="300"
                max="850"
                placeholder="e.g., 620"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Interest Rate Range
              </label>
              <input
                type="text"
                value={interestRateRange}
                onChange={(e) => setInterestRateRange(e.target.value)}
                placeholder="e.g., 3.5% - 4.2%"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Loan Types Offered
            </label>
            <div className="flex flex-wrap gap-3">
              {LOAN_TYPE_OPTIONS.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleLoanType(type)}
                  className={`px-4 py-2 rounded-md border transition ${
                    loanTypes.includes(type)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-600'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-4 pt-6">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition disabled:opacity-50 font-medium"
            >
              {loading ? 'Saving...' : existingProfile ? 'Update Profile' : 'Create Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
