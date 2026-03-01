import { useState, useEffect } from 'react';
import { User, Mail, Phone, Trash2, Save, AlertTriangle, ArrowLeft, LogOut, LifeBuoy, Camera, X, Lock, Key, Moon, Sun } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useNavigate, useRouter } from '../Navigation/Router';
import SupportTickets from './SupportTickets';

export function UserProfile() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();
  const { currentRoute } = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'profile' | 'support'>('profile');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswordSection, setShowPasswordSection] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    phoneNumber: '',
  });

  const [agentData, setAgentData] = useState({
    bio: '',
    yearsExperience: 0,
    brokerage: '',
    specialization: '',
    licenseNumber: '',
    languages: [] as string[],
    locations: [] as string[],
    meetInPerson: false,
    videoChat: false,
  });

  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        fullName: profile.full_name || '',
        phoneNumber: profile.phone_number || '',
      });
      loadProfilePhoto();
      loadAgentProfile();
    }

    const tabParam = currentRoute.params?.tab;
    if (tabParam && ['profile', 'support'].includes(tabParam)) {
      setActiveTab(tabParam as 'profile' | 'support');
    }
  }, [profile, currentRoute.params?.tab]);

  const loadAgentProfile = async () => {
    if (!user || profile?.user_type !== 'agent') return;

    try {
      const { data: agentProfile } = await supabase
        .from('agent_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (agentProfile) {
        setAgentData({
          bio: agentProfile.bio || '',
          yearsExperience: agentProfile.years_experience || 0,
          brokerage: agentProfile.brokerage || '',
          specialization: agentProfile.specialization || '',
          licenseNumber: agentProfile.license_number || '',
          languages: agentProfile.languages || [],
          locations: agentProfile.locations || [],
          meetInPerson: agentProfile.meet_in_person || false,
          videoChat: agentProfile.video_chat || false,
        });
      }
    } catch (error) {
      console.error('Error loading agent profile:', error);
    }
  };

  const loadProfilePhoto = async () => {
    if (!user || !profile) return;

    // For agents, check agent_profiles table for profile photo
    if (profile.user_type === 'agent') {
      const { data: agentProfile } = await supabase
        .from('agent_profiles')
        .select('profile_photo_url')
        .eq('id', user.id)
        .maybeSingle();

      if (agentProfile?.profile_photo_url) {
        setProfilePhotoUrl(agentProfile.profile_photo_url);
        return;
      }
    }

    // For service providers, check service_provider_profiles table
    if (profile.user_type === 'service_provider') {
      const { data: spProfile } = await supabase
        .from('service_provider_profiles')
        .select('logo_url')
        .eq('id', user.id)
        .maybeSingle();

      if (spProfile?.logo_url) {
        setProfilePhotoUrl(spProfile.logo_url);
        return;
      }
    }

    // For all other users, use profile_photo_url from profiles table
    setProfilePhotoUrl(profile.profile_photo_url || null);
  };


  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: formData.fullName,
          phone_number: formData.phoneNumber || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user!.id);

      if (updateError) throw updateError;

      if (profile?.user_type === 'agent') {
        const { error: agentError } = await supabase
          .from('agent_profiles')
          .update({
            bio: agentData.bio || null,
            years_experience: agentData.yearsExperience || null,
            brokerage: agentData.brokerage || null,
            specialization: agentData.specialization || null,
            languages: agentData.languages.length > 0 ? agentData.languages : null,
            locations: agentData.locations.length > 0 ? agentData.locations : null,
            meet_in_person: agentData.meetInPerson,
            video_chat: agentData.videoChat,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user!.id);

        if (agentError) throw agentError;
      }

      // Refresh the profile in AuthContext to update the cached data
      await refreshProfile();

      setSuccess('Profile updated successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Photo must be less than 5MB');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('File must be an image');
      return;
    }

    setUploadingPhoto(true);
    setError('');

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/profile-photo.${fileExt}`;
      let bucketName = 'profile-photos';
      let tableName = 'profiles';
      let columnName = 'profile_photo_url';

      // Determine bucket and table based on user type
      if (profile?.user_type === 'agent') {
        bucketName = 'agent-profile-photos';
        tableName = 'agent_profiles';
        columnName = 'profile_photo_url';
      } else if (profile?.user_type === 'service_provider') {
        bucketName = 'service-provider-logos';
        tableName = 'service_provider_profiles';
        columnName = 'logo_url';
      }

      if (profilePhotoUrl) {
        const oldPath = profilePhotoUrl.split('/').pop();
        if (oldPath) {
          await supabase.storage.from(bucketName).remove([`${user.id}/${oldPath}`]);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(bucketName).getPublicUrl(fileName);
      const photoUrl = data.publicUrl;

      const { error: updateError } = await supabase
        .from(tableName)
        .update({ [columnName]: photoUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Refresh the profile in AuthContext to update the cached data
      await refreshProfile();

      setProfilePhotoUrl(photoUrl);
      setSuccess('Profile photo updated successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handlePhotoDelete = async () => {
    if (!user || !profilePhotoUrl) return;

    setUploadingPhoto(true);
    setError('');

    try {
      let bucketName = 'profile-photos';
      let tableName = 'profiles';
      let columnName = 'profile_photo_url';

      // Determine bucket and table based on user type
      if (profile?.user_type === 'agent') {
        bucketName = 'agent-profile-photos';
        tableName = 'agent_profiles';
        columnName = 'profile_photo_url';
      } else if (profile?.user_type === 'service_provider') {
        bucketName = 'service-provider-logos';
        tableName = 'service_provider_profiles';
        columnName = 'logo_url';
      }

      const oldPath = profilePhotoUrl.split('/').slice(-2).join('/');
      await supabase.storage.from(bucketName).remove([oldPath]);

      const { error: updateError } = await supabase
        .from(tableName)
        .update({ [columnName]: null })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Refresh the profile in AuthContext to update the cached data
      await refreshProfile();

      setProfilePhotoUrl(null);
      setSuccess('Profile photo removed successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to remove photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangingPassword(true);
    setError('');
    setSuccess('');

    if (passwordData.newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      setChangingPassword(false);
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('Passwords do not match');
      setChangingPassword(false);
      return;
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (updateError) throw updateError;

      setSuccess('Password updated successfully');
      setPasswordData({ newPassword: '', confirmPassword: '' });
      setShowPasswordSection(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      setError('Please type DELETE to confirm');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: deleteError } = await supabase.rpc('delete_user_account');

      if (deleteError) throw deleteError;

      await supabase.auth.signOut();
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to delete account');
      setLoading(false);
    }
  };

  if (!user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-white shadow-sm border-b mb-8 -mx-4 px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-gray-600 hover:text-blue-600 transition"
              title="Back to Dashboard"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Account Settings</h1>
              <p className="text-gray-600 mt-1">Manage your profile and account preferences</p>
            </div>
          </div>
          <button
            onClick={async () => {
              await signOut();
              navigate('/');
            }}
            className="flex items-center gap-2 text-gray-700 hover:text-red-600 transition font-medium"
          >
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      <div className="mb-6 border-b">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition ${
              activeTab === 'profile'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <User size={20} />
            Profile
          </button>
          <button
            onClick={() => setActiveTab('support')}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition ${
              activeTab === 'support'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <LifeBuoy size={20} />
            Support
          </button>
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

      {activeTab === 'profile' && (
        <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Profile Information</h2>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="flex items-start gap-6 pb-6 border-b border-gray-200">
              <div className="relative">
                {profilePhotoUrl ? (
                  <div className="relative group">
                    <img
                      src={profilePhotoUrl}
                      alt="Profile"
                      className="w-32 h-32 rounded-full object-cover border-4 border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={handlePhotoDelete}
                      disabled={uploadingPhoto}
                      className="absolute top-0 right-0 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition opacity-0 group-hover:opacity-100 disabled:opacity-50"
                      title="Remove photo"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center border-4 border-gray-300">
                    <User size={48} className="text-gray-400" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Profile Photo
                </label>
                <p className="text-sm text-gray-600 mb-3">
                  Upload a profile photo. Max size 5MB. Supports JPG, PNG, GIF.
                </p>
                <label className="inline-flex items-center gap-2 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                  <Camera size={20} />
                  {uploadingPhoto ? 'Uploading...' : profilePhotoUrl ? 'Change Photo' : 'Upload Photo'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    disabled={uploadingPhoto}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="email"
                  value={user.email || ''}
                  disabled
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                />
              </div>
              <p className="mt-1 text-sm text-gray-500">Email cannot be changed</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  required
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  placeholder="(555) 123-4567"
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {profile.user_type === 'agent' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Professional Bio / Description
                  </label>
                  <textarea
                    value={agentData.bio}
                    onChange={(e) => setAgentData({ ...agentData, bio: e.target.value })}
                    rows={5}
                    placeholder="Tell potential clients about your experience, specialties, and what makes you unique..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Years of Experience
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={agentData.yearsExperience}
                      onChange={(e) => setAgentData({ ...agentData, yearsExperience: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Brokerage
                    </label>
                    <input
                      type="text"
                      value={agentData.brokerage}
                      onChange={(e) => setAgentData({ ...agentData, brokerage: e.target.value })}
                      placeholder="Your brokerage name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Specialization
                  </label>
                  <input
                    type="text"
                    value={agentData.specialization}
                    onChange={(e) => setAgentData({ ...agentData, specialization: e.target.value })}
                    placeholder="e.g., Residential, Commercial, Luxury Homes"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agentData.meetInPerson}
                      onChange={(e) => setAgentData({ ...agentData, meetInPerson: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Available for in-person meetings</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agentData.videoChat}
                      onChange={(e) => setAgentData({ ...agentData, videoChat: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Available for video chat</span>
                  </label>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account Type
              </label>
              <input
                type="text"
                value={profile.user_type}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600 capitalize"
              />
            </div>

            <div className="border-t border-gray-200 pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Appearance
              </label>
              <button
                type="button"
                onClick={toggleDarkMode}
                className="flex items-center justify-between w-full p-4 border border-gray-300 rounded-md hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-3">
                  {darkMode ? (
                    <Moon className="text-blue-600" size={20} />
                  ) : (
                    <Sun className="text-yellow-600" size={20} />
                  )}
                  <div className="text-left">
                    <p className="font-medium text-gray-800">
                      {darkMode ? 'Dark Mode' : 'Light Mode'}
                    </p>
                    <p className="text-sm text-gray-600">
                      {darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
                    </p>
                  </div>
                </div>
                <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  darkMode ? 'bg-blue-600' : 'bg-gray-300'
                }`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    darkMode ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </div>
              </button>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 bg-blue-600 text-white py-2 px-6 rounded-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                <Save size={20} />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Key className="text-blue-600" size={24} />
              <h2 className="text-xl font-bold text-gray-800">Password & Security</h2>
            </div>
            {!showPasswordSection && (
              <button
                onClick={() => setShowPasswordSection(true)}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium transition"
              >
                <Lock size={20} />
                Change Password
              </button>
            )}
          </div>

          {showPasswordSection ? (
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    placeholder="Enter new password"
                    required
                    minLength={6}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <p className="mt-1 text-sm text-gray-500">Must be at least 6 characters</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    placeholder="Confirm new password"
                    required
                    minLength={6}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="flex items-center gap-2 bg-blue-600 text-white py-2 px-6 rounded-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  <Save size={20} />
                  {changingPassword ? 'Updating...' : 'Update Password'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordSection(false);
                    setPasswordData({ newPassword: '', confirmPassword: '' });
                    setError('');
                  }}
                  disabled={changingPassword}
                  className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition disabled:opacity-50 font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <p className="text-gray-600">
              Click "Change Password" to update your password. Your password must be at least 6 characters long.
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-2 border-red-200">
          <h2 className="text-xl font-bold text-red-600 mb-2 flex items-center gap-2">
            <AlertTriangle size={24} />
            Danger Zone
          </h2>
          <p className="text-gray-600 mb-4">
            Once you delete your account, there is no going back. This action cannot be undone.
          </p>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 bg-red-600 text-white py-2 px-6 rounded-md hover:bg-red-700 transition font-medium"
            >
              <Trash2 size={20} />
              Delete Account
            </button>
          ) : (
            <div className="space-y-4 p-4 bg-red-50 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="text-red-600 flex-shrink-0 mt-1" size={24} />
                <div className="flex-1">
                  <h3 className="font-bold text-red-800 mb-2">
                    Are you absolutely sure?
                  </h3>
                  <p className="text-sm text-red-700 mb-4">
                    This will permanently delete your account and all associated data including:
                  </p>
                  <ul className="text-sm text-red-700 list-disc list-inside space-y-1 mb-4">
                    <li>Your profile information</li>
                    <li>All saved favorites and property views</li>
                    <li>Message history</li>
                    <li>Document uploads</li>
                    {profile.user_type === 'agent' && <li>All property listings</li>}
                  </ul>
                  <p className="text-sm text-red-700 mb-4 font-semibold">
                    Type <span className="font-mono bg-red-100 px-2 py-1 rounded">DELETE</span> to confirm:
                  </p>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="Type DELETE"
                    className="w-full px-3 py-2 border-2 border-red-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={handleDeleteAccount}
                      disabled={loading || deleteConfirmText !== 'DELETE'}
                      className="flex items-center gap-2 bg-red-600 text-white py-2 px-6 rounded-md hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      <Trash2 size={20} />
                      {loading ? 'Deleting...' : 'Permanently Delete Account'}
                    </button>
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteConfirmText('');
                        setError('');
                      }}
                      disabled={loading}
                      className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition disabled:opacity-50 font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        </div>
      )}

      {activeTab === 'support' && (
        <SupportTickets />
      )}
    </div>
  );
}
