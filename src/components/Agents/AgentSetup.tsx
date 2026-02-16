import { useState, useEffect } from 'react';
import { Upload, X, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useNavigate } from '../Navigation/Router';

export function AgentSetup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasProfile, setHasProfile] = useState(false);
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string>('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [formData, setFormData] = useState({
    license_number: '',
    languages: 'English',
    locations: '',
    meet_in_person: true,
    video_chat: true,
    bio: '',
    years_experience: '',
    brokerage: '',
    specialization: '',
  });

  useEffect(() => {
    checkExistingProfile();
  }, [user]);

  const checkExistingProfile = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('agent_profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (data) {
      setHasProfile(true);
      setFormData({
        license_number: data.license_number,
        languages: data.languages.join(', '),
        locations: data.locations.join(', '),
        meet_in_person: data.meet_in_person,
        video_chat: data.video_chat,
        bio: data.bio,
        years_experience: data.years_experience || '',
        brokerage: data.brokerage || '',
        specialization: data.specialization || '',
      });
      if (data.profile_photo_url) {
        setProfilePhotoPreview(data.profile_photo_url);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Photo must be less than 5MB');
      return;
    }

    setProfilePhotoFile(file);
    const previewUrl = URL.createObjectURL(file);
    setProfilePhotoPreview(previewUrl);
  };

  const removePhoto = () => {
    if (profilePhotoPreview && profilePhotoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(profilePhotoPreview);
    }
    setProfilePhotoFile(null);
    setProfilePhotoPreview('');
  };

  const uploadProfilePhoto = async (): Promise<string | null> => {
    if (!profilePhotoFile || !user) return null;

    const fileExt = profilePhotoFile.name.split('.').pop();
    const fileName = `${user.id}/profile.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('agent-profile-photos')
      .upload(fileName, profilePhotoFile, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('agent-profile-photos')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError('');

    try {
      let photoUrl = profilePhotoPreview && !profilePhotoPreview.startsWith('blob:') ? profilePhotoPreview : null;

      if (profilePhotoFile) {
        setUploadingPhoto(true);
        photoUrl = await uploadProfilePhoto();
      }

      const agentData = {
        id: user.id,
        license_number: formData.license_number,
        languages: formData.languages.split(',').map(l => l.trim()).filter(l => l),
        locations: formData.locations.split(',').map(l => l.trim()).filter(l => l),
        meet_in_person: formData.meet_in_person,
        video_chat: formData.video_chat,
        bio: formData.bio,
        profile_photo_url: photoUrl,
        years_experience: formData.years_experience ? parseInt(formData.years_experience) : null,
        brokerage: formData.brokerage || null,
        specialization: formData.specialization || null,
      };

      if (hasProfile) {
        const { error: updateError } = await supabase
          .from('agent_profiles')
          .update(agentData)
          .eq('id', user.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('agent_profiles')
          .insert(agentData);

        if (insertError) throw insertError;
      }

      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to save agent profile');
    } finally {
      setLoading(false);
      setUploadingPhoto(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-8">
      <h2 className="text-3xl font-bold text-gray-800 mb-2">
        {hasProfile ? 'Update Agent Profile' : 'Complete Your Agent Profile'}
      </h2>
      <p className="text-gray-600 mb-6">
        Fill out your professional information to start listing properties
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Profile Photo
          </label>
          <div className="flex items-center gap-6">
            <div className="relative">
              {profilePhotoPreview ? (
                <div className="relative group">
                  <img
                    src={profilePhotoPreview}
                    alt="Profile"
                    className="w-32 h-32 rounded-full object-cover border-4 border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={removePhoto}
                    className="absolute top-0 right-0 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition opacity-0 group-hover:opacity-100"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="w-32 h-32 rounded-full bg-gray-100 flex items-center justify-center border-4 border-gray-200">
                  <User size={48} className="text-gray-400" />
                </div>
              )}
            </div>
            <div>
              <input
                type="file"
                id="profile-photo-upload"
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
              />
              <label
                htmlFor="profile-photo-upload"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition cursor-pointer"
              >
                <Upload size={20} />
                <span>Upload Photo</span>
              </label>
              <p className="text-sm text-gray-500 mt-2">
                JPG, PNG or WEBP (max 5MB)
              </p>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            License Number *
          </label>
          <input
            type="text"
            name="license_number"
            value={formData.license_number}
            onChange={handleInputChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Languages (comma-separated)
          </label>
          <input
            type="text"
            name="languages"
            value={formData.languages}
            onChange={handleInputChange}
            placeholder="English, Spanish, French"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Service Locations (comma-separated)
          </label>
          <input
            type="text"
            name="locations"
            value={formData.locations}
            onChange={handleInputChange}
            placeholder="San Francisco, Oakland, Berkeley"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Years of Experience
            </label>
            <input
              type="number"
              name="years_experience"
              value={formData.years_experience}
              onChange={handleInputChange}
              min="0"
              placeholder="e.g., 5"
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
              placeholder="e.g., Keller Williams"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Specialization
            </label>
            <input
              type="text"
              name="specialization"
              value={formData.specialization}
              onChange={handleInputChange}
              placeholder="e.g., Luxury Homes"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            Meeting Options
          </label>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              name="meet_in_person"
              checked={formData.meet_in_person}
              onChange={handleInputChange}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-700">Available for in-person meetings</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              name="video_chat"
              checked={formData.video_chat}
              onChange={handleInputChange}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-700">Available for video chat</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Bio
          </label>
          <textarea
            name="bio"
            value={formData.bio}
            onChange={handleInputChange}
            rows={5}
            placeholder="Tell potential clients about your experience, specialties, and approach to real estate..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? (uploadingPhoto ? 'Uploading Photo...' : 'Saving...') : hasProfile ? 'Update Profile' : 'Complete Setup'}
          </button>
          {hasProfile && (
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
