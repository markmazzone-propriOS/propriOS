import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Briefcase, Star, MapPin, Calendar, Clock, CheckCircle, AlertCircle, User, Phone, Mail, Award, TrendingUp, DollarSign, Pencil, Save, X, Upload, Image as ImageIcon, Eye, Trash2, CreditCard } from 'lucide-react';
import { ServiceProviderCalendar } from './ServiceProviderCalendar';
import { PhotoGallery } from './PhotoGallery';
import { ServiceProviderDocuments } from './ServiceProviderDocuments';
import { ServiceProviderInvitations } from './ServiceProviderInvitations';
import JobDetailsModal from './JobDetailsModal';
import { useNavigate } from '../Navigation/Router';
import { InvitationInfo } from '../shared/InvitationInfo';

type ServiceProviderProfile = {
  id: string;
  business_name: string;
  business_address?: string;
  business_email?: string;
  license_number?: string;
  insurance_verified: boolean;
  years_experience: number;
  bio?: string;
  service_radius_miles: number;
  average_rating: number;
  total_reviews: number;
  total_jobs_completed: number;
  profile_photo_url?: string;
  logo_url?: string;
};

type UserProfile = {
  full_name: string;
  phone_number?: string;
};

type ServiceJob = {
  id: string;
  job_number: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  start_date?: string;
  end_date?: string;
  completed_at?: string;
  estimated_cost?: number;
  estimated_hours?: number;
  actual_cost?: number;
  actual_hours?: number;
  location: string;
  service_category?: {
    name: string;
  };
  property_owner?: {
    full_name: string;
    phone_number?: string;
  };
  buyer?: {
    full_name: string;
    phone_number?: string;
  };
};

type Service = {
  id: string;
  service_name: string;
  description?: string;
  base_price?: number;
  category: {
    name: string;
  };
};

type ServiceArea = {
  id: string;
  city: string;
  state: string;
  zip_code?: string;
};

type ServiceCategory = {
  id: string;
  name: string;
  description?: string;
};

export function ServiceProviderDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ServiceProviderProfile | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'jobs' | 'calendar' | 'photos' | 'documents' | 'invitations'>('overview');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editedProfile, setEditedProfile] = useState<ServiceProviderProfile | null>(null);
  const [editedUserProfile, setEditedUserProfile] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isEditingServices, setIsEditingServices] = useState(false);
  const [editedServices, setEditedServices] = useState<Service[]>([]);
  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>([]);
  const [savingServices, setSavingServices] = useState(false);
  const [servicesError, setServicesError] = useState('');
  const [isEditingAreas, setIsEditingAreas] = useState(false);
  const [editedAreas, setEditedAreas] = useState<ServiceArea[]>([]);
  const [savingAreas, setSavingAreas] = useState(false);
  const [areasError, setAreasError] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadDashboardData();
      loadServiceCategories();
    }
  }, [user]);

  const loadServiceCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('service_categories')
        .select('*')
        .order('name');

      if (error) throw error;
      if (data) setServiceCategories(data);
    } catch (error) {
      console.error('Error loading service categories:', error);
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      const [profileResult, userProfileResult, servicesResult, areasResult, jobsResult] = await Promise.all([
        supabase
          .from('service_provider_profiles')
          .select('*')
          .eq('id', user?.id)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('full_name, phone_number')
          .eq('id', user?.id)
          .maybeSingle(),
        supabase
          .from('service_provider_services')
          .select('*, category:service_categories(name)')
          .eq('provider_id', user?.id),
        supabase
          .from('service_areas')
          .select('*')
          .eq('provider_id', user?.id),
        supabase
          .from('service_provider_jobs')
          .select('*, property_owner:profiles!property_owner_id(full_name, phone_number), buyer:profiles!buyer_id(full_name, phone_number)')
          .eq('service_provider_id', user?.id)
          .order('created_at', { ascending: false })
      ]);

      console.log('User profile loaded:', userProfileResult.data);

      if (profileResult.data) setProfile(profileResult.data);
      if (userProfileResult.data) setUserProfile(userProfileResult.data);
      if (servicesResult.data) setServices(servicesResult.data as Service[]);
      if (areasResult.data) setServiceAreas(areasResult.data);
      if (jobsResult.data) setJobs(jobsResult.data as ServiceJob[]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleUpdateJobStatus = async (jobId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('service_provider_jobs')
        .update({ status: newStatus })
        .eq('id', jobId);

      if (error) throw error;

      setJobs(jobs.map(job =>
        job.id === jobId ? { ...job, status: newStatus } : job
      ));
    } catch (error) {
      console.error('Error updating job status:', error);
      alert('Failed to update job status');
    }
  };

  const handleDeleteJob = async (jobId: string, event: React.MouseEvent) => {
    event.stopPropagation();

    if (!confirm('Are you sure you want to delete this job? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('service_provider_jobs')
        .delete()
        .eq('id', jobId);

      if (error) throw error;

      setJobs(jobs.filter(job => job.id !== jobId));
      alert('Job deleted successfully');
    } catch (error) {
      console.error('Error deleting job:', error);
      alert('Failed to delete job');
    }
  };

  const handleEditProfile = () => {
    setEditedProfile(profile);
    setEditedUserProfile(userProfile || { full_name: '', phone_number: '' });
    setIsEditingProfile(true);
    setSaveError('');
  };

  const handleCancelEdit = () => {
    setIsEditingProfile(false);
    setEditedProfile(null);
    setEditedUserProfile(null);
    setSaveError('');
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setSaveError('Logo file must be less than 5MB');
        return;
      }
      if (!file.type.startsWith('image/')) {
        setSaveError('Logo must be an image file');
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setSaveError('');
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

  const handleEditServices = () => {
    setEditedServices([...services]);
    setIsEditingServices(true);
    setServicesError('');
  };

  const handleCancelServicesEdit = () => {
    setIsEditingServices(false);
    setEditedServices([]);
    setServicesError('');
  };

  const handleAddService = () => {
    setEditedServices([
      ...editedServices,
      {
        id: `new-${Date.now()}`,
        service_name: '',
        description: '',
        base_price: undefined,
        category: { name: '' }
      }
    ]);
  };

  const handleRemoveService = (index: number) => {
    setEditedServices(editedServices.filter((_, i) => i !== index));
  };

  const handleUpdateService = (index: number, field: string, value: any) => {
    const updated = [...editedServices];
    if (field === 'category') {
      const category = serviceCategories.find(c => c.id === value);
      updated[index] = { ...updated[index], category: { name: category?.name || '' } };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setEditedServices(updated);
  };

  const handleSaveServices = async () => {
    setSavingServices(true);
    setServicesError('');

    try {
      const existingServiceIds = services.map(s => s.id).filter(id => !id.startsWith('new-'));
      const editedServiceIds = editedServices.map(s => s.id).filter(id => !id.startsWith('new-'));
      const servicesToDelete = existingServiceIds.filter(id => !editedServiceIds.includes(id));

      if (servicesToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('service_provider_services')
          .delete()
          .in('id', servicesToDelete);

        if (deleteError) throw deleteError;
      }

      for (const service of editedServices) {
        const categoryId = (service as any).categoryId ||
          serviceCategories.find(c => c.name === service.category.name)?.id;

        if (!categoryId || !service.service_name) continue;

        const serviceData = {
          provider_id: user?.id,
          category_id: categoryId,
          service_name: service.service_name,
          description: service.description || null,
          base_price: service.base_price || null,
        };

        if (service.id.startsWith('new-')) {
          const { error: insertError } = await supabase
            .from('service_provider_services')
            .insert(serviceData);

          if (insertError) throw insertError;
        } else {
          const { error: updateError } = await supabase
            .from('service_provider_services')
            .update(serviceData)
            .eq('id', service.id);

          if (updateError) throw updateError;
        }
      }

      await loadDashboardData();
      setIsEditingServices(false);
      setEditedServices([]);
    } catch (error: any) {
      console.error('Error saving services:', error);
      setServicesError(error.message || 'Failed to save services');
    } finally {
      setSavingServices(false);
    }
  };

  const handleEditAreas = () => {
    setEditedAreas([...serviceAreas]);
    setIsEditingAreas(true);
    setAreasError('');
  };

  const handleCancelAreasEdit = () => {
    setIsEditingAreas(false);
    setEditedAreas([]);
    setAreasError('');
  };

  const handleAddArea = () => {
    setEditedAreas([
      ...editedAreas,
      {
        id: `new-${Date.now()}`,
        city: '',
        state: '',
        zip_code: ''
      }
    ]);
  };

  const handleRemoveArea = (index: number) => {
    setEditedAreas(editedAreas.filter((_, i) => i !== index));
  };

  const handleUpdateArea = (index: number, field: string, value: string) => {
    const updated = [...editedAreas];
    updated[index] = { ...updated[index], [field]: value };
    setEditedAreas(updated);
  };

  const handleSaveAreas = async () => {
    setSavingAreas(true);
    setAreasError('');

    try {
      const existingAreaIds = serviceAreas.map(a => a.id).filter(id => !id.startsWith('new-'));
      const editedAreaIds = editedAreas.map(a => a.id).filter(id => !id.startsWith('new-'));
      const areasToDelete = existingAreaIds.filter(id => !editedAreaIds.includes(id));

      if (areasToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('service_areas')
          .delete()
          .in('id', areasToDelete);

        if (deleteError) throw deleteError;
      }

      for (const area of editedAreas) {
        if (!area.city || !area.state) continue;

        const areaData = {
          provider_id: user?.id,
          city: area.city,
          state: area.state,
          zip_code: area.zip_code || null,
        };

        if (area.id.startsWith('new-')) {
          const { error: insertError } = await supabase
            .from('service_areas')
            .insert(areaData);

          if (insertError) throw insertError;
        } else {
          const { error: updateError } = await supabase
            .from('service_areas')
            .update(areaData)
            .eq('id', area.id);

          if (updateError) throw updateError;
        }
      }

      await loadDashboardData();
      setIsEditingAreas(false);
      setEditedAreas([]);
    } catch (error: any) {
      console.error('Error saving service areas:', error);
      setAreasError(error.message || 'Failed to save service areas');
    } finally {
      setSavingAreas(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!editedProfile || !editedUserProfile || !user) return;

    try {
      setSaving(true);
      setSaveError('');

      const { data: updateData, error: userProfileError } = await supabase
        .from('profiles')
        .update({
          full_name: editedUserProfile.full_name,
          phone_number: editedUserProfile.phone_number || null,
        })
        .eq('id', user.id)
        .select();

      if (userProfileError) {
        console.error('Error updating user profile:', userProfileError);
        throw userProfileError;
      }

      console.log('User profile updated successfully:', updateData);

      const { data: providerData, error } = await supabase
        .from('service_provider_profiles')
        .update({
          business_name: editedProfile.business_name,
          business_address: editedProfile.business_address,
          business_email: editedProfile.business_email,
          license_number: editedProfile.license_number,
          years_experience: editedProfile.years_experience,
          bio: editedProfile.bio,
          service_radius_miles: editedProfile.service_radius_miles,
          insurance_verified: editedProfile.insurance_verified,
        })
        .eq('id', user.id)
        .select();

      if (error) {
        console.error('Error updating provider profile:', error);
        throw error;
      }

      console.log('Provider profile updated successfully:', providerData);

      setIsEditingProfile(false);
      setEditedProfile(null);
      setEditedUserProfile(null);

      await loadDashboardData();
    } catch (error: any) {
      console.error('Error saving profile:', error);
      setSaveError(error.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const completedJobs = jobs.filter(j => j.status === 'completed');
  const inProgressJobs = jobs.filter(j => j.status === 'in_progress');
  const scheduledJobs = jobs.filter(j => j.status === 'scheduled');
  const pendingJobs = jobs.filter(j => j.status === 'pending');

  const totalRevenue = completedJobs.reduce((sum, job) => sum + (job.actual_cost || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-2">Complete Your Profile</h2>
          <p className="text-gray-700">You need to set up your service provider profile to access the dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <InvitationInfo />
      </div>

      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Service Provider Dashboard</h1>
          <p className="text-gray-600 mt-2">Manage your business and track your jobs</p>
        </div>
        <div className="relative group">
          {profile.logo_url ? (
            <div className="relative">
              <img
                src={profile.logo_url}
                alt="Business Logo"
                className="w-48 h-48 object-contain rounded-lg border-2 border-gray-200 bg-white shadow-sm"
              />
              <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <label className="cursor-pointer flex flex-col items-center text-white">
                  <Upload size={32} className="mb-2" />
                  <span className="text-sm font-medium">Change Logo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          ) : (
            <label className="cursor-pointer w-48 h-48 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition">
              <ImageIcon className="text-gray-400 mb-2" size={40} />
              <span className="text-sm font-medium text-gray-600">Upload Logo</span>
              <span className="text-xs text-gray-500 mt-1">Max 5MB</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="hidden"
              />
            </label>
          )}
          {logoFile && logoPreview && (
            <div className="absolute inset-0">
              <img
                src={logoPreview}
                alt="Logo preview"
                className="w-48 h-48 object-contain rounded-lg border-2 border-blue-500 bg-white shadow-lg"
              />
              <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      onClick={async () => {
                        try {
                          setUploadingLogo(true);
                          const newLogoUrl = await uploadLogo();
                          if (newLogoUrl) {
                            const { error } = await supabase
                              .from('service_provider_profiles')
                              .update({ logo_url: newLogoUrl })
                              .eq('id', user?.id);
                            if (error) throw error;
                            await loadDashboardData();
                            setLogoFile(null);
                            setLogoPreview('');
                          }
                        } catch (error) {
                          console.error('Error uploading logo:', error);
                          alert('Failed to upload logo');
                        } finally {
                          setUploadingLogo(false);
                        }
                      }}
                      disabled={uploadingLogo}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 text-sm"
                    >
                      {uploadingLogo ? 'Uploading...' : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setLogoFile(null);
                        setLogoPreview('');
                      }}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
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

      <div className="mb-6 border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('jobs')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
              activeTab === 'jobs'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Jobs
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
              activeTab === 'calendar'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Calendar
          </button>
          <button
            onClick={() => setActiveTab('photos')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
              activeTab === 'photos'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Photos
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
              activeTab === 'documents'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Documents
          </button>
          <button
            onClick={() => setActiveTab('invitations')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
              activeTab === 'invitations'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Invitations
          </button>
        </nav>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Jobs</p>
                  <p className="text-3xl font-bold text-gray-800 mt-1">{profile.total_jobs_completed}</p>
                </div>
                <CheckCircle className="text-green-500" size={40} />
              </div>
            </div>

            <div
              className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate('/reviews')}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Average Rating</p>
                  <div className="flex items-center mt-1">
                    <p className="text-3xl font-bold text-gray-800">{profile.average_rating.toFixed(1)}</p>
                    <Star className="text-yellow-500 ml-2" size={24} fill="currentColor" />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{profile.total_reviews} reviews</p>
                  <p className="text-xs text-blue-600 mt-2 font-medium">View all reviews →</p>
                </div>
                <Award className="text-yellow-500" size={40} />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">In Progress</p>
                  <p className="text-3xl font-bold text-gray-800 mt-1">{inProgressJobs.length}</p>
                </div>
                <Clock className="text-blue-500" size={40} />
              </div>
            </div>

            <div
              className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate('/revenue')}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Revenue</p>
                  <p className="text-3xl font-bold text-gray-800 mt-1">${totalRevenue.toLocaleString()}</p>
                  <p className="text-xs text-blue-600 mt-2 font-medium">View detailed reports →</p>
                </div>
                <DollarSign className="text-green-500" size={40} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-gray-800">Business Profile</h2>
                    {!isEditingProfile && (
                      <button
                        onClick={handleEditProfile}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition"
                        title="Edit Profile"
                      >
                        <Pencil size={18} />
                      </button>
                    )}
                  </div>
                  {isEditingProfile && (
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveProfile}
                        disabled={saving}
                        className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition disabled:opacity-50"
                      >
                        <Save size={16} className="mr-2" />
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        disabled={saving}
                        className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition disabled:opacity-50"
                      >
                        <X size={16} className="mr-2" />
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {saveError && (
                <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {saveError}
                </div>
              )}

              <div className="p-6 space-y-4">
                {!isEditingProfile ? (
                  <>
                    <div className="flex items-start">
                      <Briefcase className="text-gray-400 mt-1 mr-3" size={20} />
                      <div>
                        <p className="text-sm text-gray-600">Business Name</p>
                        <p className="font-medium text-gray-800">{profile.business_name}</p>
                      </div>
                    </div>

                    {profile.business_address && (
                      <div className="flex items-start">
                        <MapPin className="text-gray-400 mt-1 mr-3" size={20} />
                        <div>
                          <p className="text-sm text-gray-600">Business Address</p>
                          <p className="font-medium text-gray-800">{profile.business_address}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start">
                      <User className="text-gray-400 mt-1 mr-3" size={20} />
                      <div>
                        <p className="text-sm text-gray-600">Contact Name</p>
                        <p className="font-medium text-gray-800">{userProfile?.full_name || 'Not provided'}</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <Mail className="text-gray-400 mt-1 mr-3" size={20} />
                      <div>
                        <p className="text-sm text-gray-600">Business Email</p>
                        <p className="font-medium text-gray-800">{profile.business_email || 'Not provided'}</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <Phone className="text-gray-400 mt-1 mr-3" size={20} />
                      <div>
                        <p className="text-sm text-gray-600">Phone</p>
                        <p className="font-medium text-gray-800">{userProfile?.phone_number || 'Not provided'}</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <TrendingUp className="text-gray-400 mt-1 mr-3" size={20} />
                      <div>
                        <p className="text-sm text-gray-600">Years of Experience</p>
                        <p className="font-medium text-gray-800">{profile.years_experience} years</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <MapPin className="text-gray-400 mt-1 mr-3" size={20} />
                      <div>
                        <p className="text-sm text-gray-600">Service Radius</p>
                        <p className="font-medium text-gray-800">{profile.service_radius_miles} miles</p>
                      </div>
                    </div>

                    {profile.license_number && (
                      <div className="flex items-start">
                        <Award className="text-gray-400 mt-1 mr-3" size={20} />
                        <div>
                          <p className="text-sm text-gray-600">License Number</p>
                          <p className="font-medium text-gray-800">{profile.license_number}</p>
                        </div>
                      </div>
                    )}

                    {profile.insurance_verified && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="flex items-center">
                          <CheckCircle className="text-green-600 mr-2" size={20} />
                          <p className="text-sm font-medium text-green-800">Insurance Verified</p>
                        </div>
                      </div>
                    )}

                    {profile.bio && (
                      <div className="pt-4 border-t border-gray-200">
                        <p className="text-sm text-gray-600 mb-2">About</p>
                        <p className="text-gray-800">{profile.bio}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Business Name *
                      </label>
                      <input
                        type="text"
                        value={editedProfile?.business_name || ''}
                        onChange={(e) => setEditedProfile(editedProfile ? { ...editedProfile, business_name: e.target.value } : null)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Business Address
                      </label>
                      <input
                        type="text"
                        value={editedProfile?.business_address || ''}
                        onChange={(e) => setEditedProfile(editedProfile ? { ...editedProfile, business_address: e.target.value } : null)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Business Email *
                      </label>
                      <input
                        type="email"
                        value={editedProfile?.business_email || ''}
                        onChange={(e) => setEditedProfile(editedProfile ? { ...editedProfile, business_email: e.target.value } : null)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="contact@business.com"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Contact Name *
                      </label>
                      <input
                        type="text"
                        value={editedUserProfile?.full_name || ''}
                        onChange={(e) => setEditedUserProfile(editedUserProfile ? { ...editedUserProfile, full_name: e.target.value } : null)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        value={editedUserProfile?.phone_number || ''}
                        onChange={(e) => setEditedUserProfile(editedUserProfile ? { ...editedUserProfile, phone_number: e.target.value } : null)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        License Number
                      </label>
                      <input
                        type="text"
                        value={editedProfile?.license_number || ''}
                        onChange={(e) => setEditedProfile(editedProfile ? { ...editedProfile, license_number: e.target.value } : null)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Years of Experience
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editedProfile?.years_experience || 0}
                          onChange={(e) => setEditedProfile(editedProfile ? { ...editedProfile, years_experience: parseInt(e.target.value) || 0 } : null)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Service Radius (miles)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={editedProfile?.service_radius_miles || 25}
                          onChange={(e) => setEditedProfile(editedProfile ? { ...editedProfile, service_radius_miles: parseInt(e.target.value) || 25 } : null)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={editedProfile?.insurance_verified || false}
                          onChange={(e) => setEditedProfile(editedProfile ? { ...editedProfile, insurance_verified: e.target.checked } : null)}
                          className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="text-sm font-medium text-gray-700">Insurance Verified</span>
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        About Your Business
                      </label>
                      <textarea
                        value={editedProfile?.bio || ''}
                        onChange={(e) => setEditedProfile(editedProfile ? { ...editedProfile, bio: e.target.value } : null)}
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Tell clients about your business, expertise, and what makes you stand out..."
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-800">Services Offered</h2>
                    {!isEditingServices ? (
                      <button
                        onClick={handleEditServices}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition"
                        title="Edit Services"
                      >
                        <Pencil size={18} />
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveServices}
                          disabled={savingServices}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                        >
                          <Save size={16} />
                          {savingServices ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={handleCancelServicesEdit}
                          disabled={savingServices}
                          className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:bg-gray-100"
                        >
                          <X size={16} />
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-6">
                  {servicesError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
                      {servicesError}
                    </div>
                  )}
                  {!isEditingServices ? (
                    services.length === 0 ? (
                      <p className="text-gray-600 text-sm">No services added yet</p>
                    ) : (
                      <div className="space-y-3">
                        {services.map((service) => (
                          <div key={service.id} className="border-b border-gray-200 pb-3 last:border-0">
                            <p className="font-medium text-gray-800">{service.service_name}</p>
                            <p className="text-xs text-gray-500">{service.category.name}</p>
                            {service.description && (
                              <p className="text-sm text-gray-600 mt-1">{service.description}</p>
                            )}
                            {service.base_price && (
                              <p className="text-sm text-green-600 mt-1">From ${service.base_price}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  ) : (
                    <div className="space-y-4">
                      {editedServices.map((service, index) => (
                        <div key={service.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Category *
                                </label>
                                <select
                                  value={(service as any).categoryId || serviceCategories.find(c => c.name === service.category.name)?.id || ''}
                                  onChange={(e) => handleUpdateService(index, 'category', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  required
                                >
                                  <option value="">Select a category</option>
                                  {serviceCategories.map((cat) => (
                                    <option key={cat.id} value={cat.id}>
                                      {cat.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Service Name *
                                </label>
                                <input
                                  type="text"
                                  value={service.service_name}
                                  onChange={(e) => handleUpdateService(index, 'service_name', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder="e.g., Kitchen Faucet Repair"
                                  required
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Description
                              </label>
                              <textarea
                                value={service.description || ''}
                                onChange={(e) => handleUpdateService(index, 'description', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                rows={2}
                                placeholder="Brief description of this service"
                              />
                            </div>
                            <div className="flex items-end gap-3">
                              <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Base Price
                                </label>
                                <input
                                  type="number"
                                  value={service.base_price || ''}
                                  onChange={(e) => handleUpdateService(index, 'base_price', e.target.value ? parseFloat(e.target.value) : undefined)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder="0.00"
                                  min="0"
                                  step="0.01"
                                />
                              </div>
                              <button
                                onClick={() => handleRemoveService(index)}
                                className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-md transition"
                                title="Remove service"
                              >
                                <X size={20} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={handleAddService}
                        className="w-full py-2 border-2 border-dashed border-gray-300 text-gray-600 rounded-md hover:border-blue-500 hover:text-blue-600 transition"
                      >
                        + Add Service
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-800">Service Areas</h2>
                    {!isEditingAreas ? (
                      <button
                        onClick={handleEditAreas}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition"
                        title="Edit Service Areas"
                      >
                        <Pencil size={18} />
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveAreas}
                          disabled={savingAreas}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                        >
                          <Save size={16} />
                          {savingAreas ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={handleCancelAreasEdit}
                          disabled={savingAreas}
                          className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:bg-gray-100"
                        >
                          <X size={16} />
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-6">
                  {areasError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
                      {areasError}
                    </div>
                  )}
                  {!isEditingAreas ? (
                    serviceAreas.length === 0 ? (
                      <p className="text-gray-600 text-sm">No service areas added yet</p>
                    ) : (
                      <div className="space-y-2">
                        {serviceAreas.map((area) => (
                          <div key={area.id} className="flex items-center text-sm">
                            <MapPin className="text-gray-400 mr-2" size={16} />
                            <span className="text-gray-800">
                              {area.city}, {area.state}
                              {area.zip_code && ` ${area.zip_code}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )
                  ) : (
                    <div className="space-y-4">
                      {editedAreas.map((area, index) => (
                        <div key={area.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  City *
                                </label>
                                <input
                                  type="text"
                                  value={area.city}
                                  onChange={(e) => handleUpdateArea(index, 'city', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder="e.g., Austin"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  State *
                                </label>
                                <input
                                  type="text"
                                  value={area.state}
                                  onChange={(e) => handleUpdateArea(index, 'state', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder="e.g., TX"
                                  maxLength={2}
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  ZIP Code
                                </label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={area.zip_code || ''}
                                    onChange={(e) => handleUpdateArea(index, 'zip_code', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="78701"
                                    maxLength={10}
                                  />
                                  <button
                                    onClick={() => handleRemoveArea(index)}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-md transition flex-shrink-0"
                                    title="Remove area"
                                  >
                                    <X size={20} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={handleAddArea}
                        className="w-full py-2 border-2 border-dashed border-gray-300 text-gray-600 rounded-md hover:border-blue-500 hover:text-blue-600 transition"
                      >
                        + Add Service Area
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">Recent Jobs</h2>
            </div>
            <div className="p-6">
              {jobs.length === 0 ? (
                <p className="text-gray-600 text-center py-8">No jobs yet</p>
              ) : (
                <div className="space-y-4">
                  {jobs.slice(0, 5).map((job) => (
                    <div key={job.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-800">{job.title}</h3>
                          <p className="text-sm text-gray-600 mt-1">{job.description}</p>
                          <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
                            <span className="flex items-center">
                              <MapPin size={16} className="mr-1" />
                              {job.location}
                            </span>
                            {job.start_date && (
                              <span className="flex items-center">
                                <Calendar size={16} className="mr-1" />
                                {new Date(job.start_date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          job.status === 'completed' ? 'bg-green-100 text-green-800' :
                          job.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                          job.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {job.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'jobs' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-yellow-800 font-medium">Pending</p>
                  <p className="text-2xl font-bold text-yellow-900 mt-1">{pendingJobs.length}</p>
                </div>
                <AlertCircle className="text-yellow-600" size={32} />
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-800 font-medium">Scheduled</p>
                  <p className="text-2xl font-bold text-blue-900 mt-1">{scheduledJobs.length}</p>
                </div>
                <Calendar className="text-blue-600" size={32} />
              </div>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-orange-800 font-medium">In Progress</p>
                  <p className="text-2xl font-bold text-orange-900 mt-1">{inProgressJobs.length}</p>
                </div>
                <Clock className="text-orange-600" size={32} />
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-800 font-medium">Completed</p>
                  <p className="text-2xl font-bold text-green-900 mt-1">{completedJobs.length}</p>
                </div>
                <CheckCircle className="text-green-600" size={32} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">All Jobs</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {jobs.length === 0 ? (
                <div className="p-8 text-center text-gray-600">
                  <Briefcase className="mx-auto mb-4 text-gray-400" size={48} />
                  <p>No jobs yet</p>
                </div>
              ) : (
                jobs.map((job) => (
                  <div
                    key={job.id}
                    className="p-6 hover:bg-gray-50 transition"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-gray-800 text-lg">{job.title}</h3>
                          <select
                            value={job.status}
                            onChange={(e) => handleUpdateJobStatus(job.id, e.target.value)}
                            className={`px-3 py-1 rounded-full text-xs font-medium border-0 cursor-pointer ${
                              job.status === 'completed' ? 'bg-green-100 text-green-800' :
                              job.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                              job.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800' :
                              job.status === 'pending' ? 'bg-orange-100 text-orange-800' :
                              'bg-gray-100 text-gray-800'
                            }`}
                          >
                            <option value="pending">Pending</option>
                            <option value="scheduled">Scheduled</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </div>
                        <p className="text-gray-600 mt-2">{job.description}</p>
                        <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
                          <span className="flex items-center">
                            <User size={16} className="mr-1" />
                            {job.buyer?.full_name || job.property_owner?.full_name || 'Unknown Client'}
                          </span>
                          <span className="flex items-center">
                            <MapPin size={16} className="mr-1" />
                            {job.location}
                          </span>
                          {job.start_date && (
                            <span className="flex items-center">
                              <Calendar size={16} className="mr-1" />
                              {new Date(job.start_date).toLocaleString()}
                            </span>
                          )}
                          {job.service_category && (
                            <span className="flex items-center">
                              <Briefcase size={16} className="mr-1" />
                              {job.service_category.name}
                            </span>
                          )}
                        </div>
                        {(job.estimated_cost || job.actual_cost) && (
                          <div className="mt-3 flex items-center gap-4 text-sm">
                            {job.estimated_cost && (
                              <span className="text-gray-600">
                                Estimated: <span className="font-medium">${job.estimated_cost}</span>
                              </span>
                            )}
                            {job.actual_cost && (
                              <span className="text-green-600">
                                Final: <span className="font-semibold">${job.actual_cost}</span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedJobId(job.id)}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm whitespace-nowrap"
                        >
                          <Eye size={18} />
                          View Details
                        </button>
                        <button
                          onClick={(e) => handleDeleteJob(job.id, e)}
                          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm whitespace-nowrap"
                          title="Delete job"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'calendar' && (
        <ServiceProviderCalendar jobs={jobs} onJobUpdate={loadDashboardData} />
      )}

      {activeTab === 'photos' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Photo Gallery</h2>
            <p className="text-gray-600">
              Upload photos to showcase your work and highlight your business on your public profile
            </p>
          </div>
          <PhotoGallery providerId={user?.id || ''} isEditable={true} />
        </div>
      )}

      {activeTab === 'documents' && (
        <ServiceProviderDocuments />
      )}

      {activeTab === 'invitations' && (
        <ServiceProviderInvitations />
      )}

      {selectedJobId && (
        <JobDetailsModal
          jobId={selectedJobId}
          onClose={() => setSelectedJobId(null)}
          onUpdate={() => loadDashboardData()}
          isPropertyOwner={false}
        />
      )}
    </div>
  );
}
