import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from '../Navigation/Router';
import { Building2, DollarSign, Users, TrendingUp, Home, Calendar, Plus, List, Upload, FileText, File, Download, Eye, Files, Trash2, Wrench, FileSearch, Star, Globe, ExternalLink } from 'lucide-react';
import { RentProgressTracker } from './RentProgressTracker';
import { AssignedRenters } from './AssignedRenters';
import { RentalApplicationsCard } from './RentalApplicationsCard';
import JobDetailsModal from '../ServiceProvider/JobDetailsModal';
import { InvitationInfo } from '../shared/InvitationInfo';
import { ImportExternalReview } from '../Agents/ImportExternalReview';

type PropertyOwnerProfile = {
  id: string;
  business_name: string | null;
  properties_owned: number;
  total_rental_income: number;
  bio: string | null;
};

type RentalAgreement = {
  id: string;
  property_id: string;
  renter_id: string;
  monthly_rent: number;
  security_deposit: number;
  lease_start_date: string;
  lease_end_date: string;
  status: string;
  payment_due_day: number;
  property?: {
    address_line1: string;
    city: string;
    state: string;
  };
  renter?: {
    full_name: string;
    email: string;
  };
};

export function PropertyOwnerDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [ownerProfile, setOwnerProfile] = useState<PropertyOwnerProfile | null>(null);
  const [agreements, setAgreements] = useState<RentalAgreement[]>([]);
  const [standaloneDocuments, setStandaloneDocuments] = useState<any[]>([]);
  const [agreementDocuments, setAgreementDocuments] = useState<{[key: string]: any[]}>({});
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingAgreementId, setUploadingAgreementId] = useState<string | null>(null);
  const [uploadingGeneral, setUploadingGeneral] = useState(false);
  const [error, setError] = useState('');
  const [reviews, setReviews] = useState<any[]>([]);
  const [showImportReview, setShowImportReview] = useState(false);

  useEffect(() => {
    loadDashboardData();
    loadReviews();
  }, [user]);

  const loadDashboardData = async () => {
    if (!user) return;

    try {
      const { data: profileData, error: profileError } = await supabase
        .from('property_owner_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      setOwnerProfile(profileData);

      const { data: agreementsData, error: agreementsError } = await supabase
        .from('rental_agreements')
        .select(`
          *,
          property:properties(address_line1, city, state),
          renter:profiles!rental_agreements_renter_id_fkey(full_name)
        `)
        .eq('property_owner_id', user.id)
        .order('created_at', { ascending: false });

      if (agreementsError) throw agreementsError;
      setAgreements(agreementsData || []);

      // Load jobs - first try without joins to see if RLS is the issue
      console.log('Loading jobs for property owner:', user.id);
      const { data: jobsData, error: jobsError } = await supabase
        .from('service_provider_jobs')
        .select('*')
        .eq('property_owner_id', user.id)
        .order('start_date', { ascending: false });

      if (jobsError) {
        console.error('Jobs query error:', jobsError);
      } else {
        console.log('Raw jobs data:', jobsData);
      }

      // If we got jobs, enrich them with related data
      if (jobsData && jobsData.length > 0) {
        const enrichedJobs = await Promise.all(
          jobsData.map(async (job) => {
            const enrichedJob = { ...job };

            // Fetch service provider profile
            if (job.service_provider_id) {
              const { data: providerData } = await supabase
                .from('service_provider_profiles')
                .select('business_name')
                .eq('id', job.service_provider_id)
                .maybeSingle();

              if (providerData) {
                enrichedJob.service_provider_profile = providerData;
              }
            }

            // Fetch service category
            if (job.service_category_id) {
              const { data: categoryData } = await supabase
                .from('service_categories')
                .select('name')
                .eq('id', job.service_category_id)
                .maybeSingle();

              if (categoryData) {
                enrichedJob.service_category = categoryData;
              }
            }

            return enrichedJob;
          })
        );

        console.log('Enriched jobs:', enrichedJobs);
        setJobs(enrichedJobs);
      } else {
        setJobs([]);
      }

      // Load standalone rental agreement documents
      const { data: standaloneDocs, error: standaloneError } = await supabase
        .from('documents')
        .select('*')
        .eq('owner_id', user.id)
        .eq('document_type', 'Contract')
        .or('description.ilike.%Lease Agreement%,description.is.null')
        .is('rental_agreement_id', null)
        .order('uploaded_at', { ascending: false });

      if (standaloneError) throw standaloneError;
      setStandaloneDocuments(standaloneDocs || []);

      // Load documents linked to rental agreements
      const { data: linkedDocs, error: linkedError } = await supabase
        .from('documents')
        .select('*')
        .eq('owner_id', user.id)
        .not('rental_agreement_id', 'is', null)
        .order('uploaded_at', { ascending: false });

      if (linkedError) throw linkedError;

      // Group documents by rental_agreement_id
      const docsMap: {[key: string]: any[]} = {};
      (linkedDocs || []).forEach(doc => {
        if (!docsMap[doc.rental_agreement_id]) {
          docsMap[doc.rental_agreement_id] = [];
        }
        docsMap[doc.rental_agreement_id].push(doc);
      });
      setAgreementDocuments(docsMap);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReviews = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('property_owner_reviews')
        .select('id, rating, comment, created_at, is_imported, external_source, external_url, external_reviewer_name')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setReviews(data || []);
    } catch (error) {
      console.error('Error loading reviews:', error);
    }
  };

  const handleAgreementUpload = async (agreementId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;

    setUploadingAgreementId(agreementId);
    setError('');

    try {
      const file = files[0];

      if (file.size > 10 * 1024 * 1024) {
        throw new Error('File is too large. Maximum size is 10MB.');
      }

      const agreement = agreements.find(a => a.id === agreementId);
      if (!agreement) throw new Error('Agreement not found');

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('agent-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const description = `Lease Agreement - ${agreement.property?.address_line1}, ${agreement.property?.city}`;

      const { error: dbError } = await supabase
        .from('documents')
        .insert({
          owner_id: user.id,
          file_name: file.name,
          file_type: file.type || 'application/octet-stream',
          file_size: file.size,
          storage_path: fileName,
          document_type: 'Contract',
          description: description,
          rental_agreement_id: agreementId,
        });

      if (dbError) throw dbError;

      // Reload data to show the new document
      await loadDashboardData();
      alert('Rental agreement uploaded successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to upload agreement');
    } finally {
      setUploadingAgreementId(null);
      e.target.value = '';
    }
  };

  const handleGeneralAgreementUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;

    setUploadingGeneral(true);
    setError('');

    try {
      const file = files[0];

      if (file.size > 10 * 1024 * 1024) {
        throw new Error('File is too large. Maximum size is 10MB.');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('agent-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from('documents')
        .insert({
          owner_id: user.id,
          file_name: file.name,
          file_type: file.type || 'application/octet-stream',
          file_size: file.size,
          storage_path: fileName,
          document_type: 'Contract',
          description: 'Lease Agreement',
        });

      if (dbError) throw dbError;

      // Reload data to show the new document
      await loadDashboardData();
      alert('Rental agreement uploaded successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to upload agreement');
    } finally {
      setUploadingGeneral(false);
      e.target.value = '';
    }
  };

  const handleDownload = async (doc: any) => {
    try {
      const { data, error } = await supabase.storage
        .from('agent-documents')
        .download(doc.storage_path);

      if (error) throw error;

      const url = window.URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert('Failed to download document: ' + err.message);
    }
  };

  const handleView = async (doc: any) => {
    try {
      const { data, error } = await supabase.storage
        .from('agent-documents')
        .download(doc.storage_path);

      if (error) throw error;

      const url = window.URL.createObjectURL(data);
      window.open(url, '_blank');
    } catch (err: any) {
      alert('Failed to view document: ' + err.message);
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

  const handleDeleteDocument = async (doc: any) => {
    if (!confirm(`Are you sure you want to delete "${doc.file_name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error: storageError } = await supabase.storage
        .from('agent-documents')
        .remove([doc.storage_path]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', doc.id);

      if (dbError) throw dbError;

      setStandaloneDocuments(prev => prev.filter(d => d.id !== doc.id));

      setAgreementDocuments(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(agreementId => {
          updated[agreementId] = updated[agreementId].filter(d => d.id !== doc.id);
        });
        return updated;
      });

      alert('Document deleted successfully');
    } catch (err: any) {
      console.error('Error deleting document:', err);
      alert('Failed to delete document: ' + err.message);
    }
  };

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

  const activeAgreements = agreements.filter(a => a.status === 'active');
  const totalMonthlyIncome = activeAgreements.reduce((sum, a) => sum + Number(a.monthly_rent), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <InvitationInfo />
        </div>

        <div className="mb-10">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-3 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl shadow-lg">
                  <Building2 className="text-white" size={32} />
                </div>
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-blue-900 to-gray-900 bg-clip-text text-transparent">
                    Property Portfolio
                  </h1>
                  <p className="text-gray-600 text-lg mt-1">
                    Welcome back, <span className="font-semibold text-gray-800">{ownerProfile?.business_name || profile?.full_name}</span>
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => navigate('/property-owner/tenants')}
                className="flex items-center gap-2 px-5 py-2.5 border-2 border-purple-600 text-purple-700 rounded-xl hover:bg-purple-50 transition-all duration-200 font-semibold shadow-sm hover:shadow-md"
              >
                <Users size={20} />
                Tenant Management
              </button>
              <button
                onClick={() => navigate('/property-owner/analytics')}
                className="flex items-center gap-2 px-5 py-2.5 border-2 border-teal-600 text-teal-700 rounded-xl hover:bg-teal-50 transition-all duration-200 font-semibold shadow-sm hover:shadow-md"
              >
                <TrendingUp size={20} />
                Portfolio Analytics
              </button>
              <button
                onClick={() => navigate('/property-owner/calendar')}
                className="flex items-center gap-2 px-5 py-2.5 border-2 border-green-600 text-green-700 rounded-xl hover:bg-green-50 transition-all duration-200 font-semibold shadow-sm hover:shadow-md"
              >
                <Calendar size={20} />
                View Calendar
              </button>
              <button
                onClick={() => navigate('/property-owner/listings')}
                className="flex items-center gap-2 px-5 py-2.5 border-2 border-blue-600 text-blue-700 rounded-xl hover:bg-blue-50 transition-all duration-200 font-semibold shadow-sm hover:shadow-md"
              >
                <List size={20} />
                View Listings
              </button>
              <button
                onClick={() => navigate('/property-owner/listings/create')}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 py-2.5 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 font-semibold shadow-md hover:shadow-lg"
              >
                <Plus size={20} />
                Create Listing
              </button>
              <button
                onClick={() => navigate('/rental-agreements')}
                className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-green-700 text-white px-5 py-2.5 rounded-xl hover:from-green-700 hover:to-green-800 transition-all duration-200 font-semibold shadow-md hover:shadow-lg"
              >
                <FileText size={20} />
                Lease Agreements
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <div
            onClick={() => navigate('/property-owner/listings')}
            className="group bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 text-white overflow-hidden relative cursor-pointer"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Building2 className="text-white" size={24} />
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold">
                    {ownerProfile?.properties_owned || 0}
                  </div>
                </div>
              </div>
              <p className="text-blue-100 font-medium">Properties Owned</p>
            </div>
          </div>

          <div className="group bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Users className="text-white" size={24} />
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold">
                    {activeAgreements.length}
                  </div>
                </div>
              </div>
              <p className="text-emerald-100 font-medium">Active Renters</p>
            </div>
          </div>

          <div className="group bg-gradient-to-br from-teal-500 to-teal-600 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <DollarSign className="text-white" size={24} />
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    ${totalMonthlyIncome.toLocaleString()}
                  </div>
                </div>
              </div>
              <p className="text-teal-100 font-medium">Monthly Income</p>
            </div>
          </div>

          <div className="group bg-gradient-to-br from-blue-600 to-cyan-600 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <TrendingUp className="text-white" size={24} />
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    ${(ownerProfile?.total_rental_income || 0).toLocaleString()}
                  </div>
                </div>
              </div>
              <p className="text-cyan-100 font-medium">Total Income</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <div className="mb-8">
          <RentalApplicationsCard />
        </div>

        <div className="mb-8">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-orange-600 to-orange-700 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <Wrench className="text-white" size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">Service & Maintenance Jobs</h2>
                    <p className="text-orange-100 text-sm mt-1">Track work across all properties</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-white">
                  <div className="text-center px-4 py-2 bg-white/10 rounded-lg">
                    <div className="text-2xl font-bold">{jobs.filter(j => j.status === 'scheduled').length}</div>
                    <div className="text-xs text-orange-100">Scheduled</div>
                  </div>
                  <div className="text-center px-4 py-2 bg-white/10 rounded-lg">
                    <div className="text-2xl font-bold">{jobs.filter(j => j.status === 'in_progress').length}</div>
                    <div className="text-xs text-orange-100">In Progress</div>
                  </div>
                  <div className="text-center px-4 py-2 bg-white/10 rounded-lg">
                    <div className="text-2xl font-bold">{jobs.filter(j => j.status === 'completed').length}</div>
                    <div className="text-xs text-orange-100">Completed</div>
                  </div>
                </div>
              </div>
            </div>

            {jobs.length === 0 ? (
              <div className="p-12 text-center">
                <Wrench className="mx-auto text-gray-400 mb-4" size={48} />
                <h3 className="text-xl font-semibold text-gray-800 mb-2">No Jobs Yet</h3>
                <p className="text-gray-600 mb-6">
                  When service providers are scheduled for work on your properties, they'll appear here.
                </p>
                <button
                  onClick={() => navigate('/service-providers')}
                  className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700 transition"
                >
                  Find Service Providers
                </button>
              </div>
            ) : (

              <div className="p-6 space-y-6">
                {/* Scheduled Jobs */}
                {jobs.filter(j => j.status === 'scheduled').length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                      Scheduled Jobs
                    </h3>
                    <div className="space-y-3">
                      {jobs.filter(j => j.status === 'scheduled').map((job) => (
                        <div
                          key={job.id}
                          className="p-4 border-2 border-yellow-200 bg-yellow-50 rounded-xl hover:border-yellow-300 transition"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h4 className="font-semibold text-gray-800">{job.title}</h4>
                                <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                  SCHEDULED
                                </span>
                              </div>
                              {job.description && (
                                <p className="text-gray-600 text-sm mb-2">{job.description}</p>
                              )}
                              <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                                {job.service_provider_profile && (
                                  <button
                                    onClick={() => navigate(`/provider/${job.service_provider_id}`)}
                                    className="text-blue-600 hover:text-blue-700 font-medium hover:underline"
                                  >
                                    {job.service_provider_profile.business_name}
                                  </button>
                                )}
                                {job.service_category && (
                                  <span>• {job.service_category.name}</span>
                                )}
                                {job.start_date && (
                                  <span>• Starts: {new Date(job.start_date).toLocaleDateString()}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setSelectedJobId(job.id)}
                                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-medium text-sm"
                              >
                                View
                              </button>
                              <button
                                onClick={(e) => handleDeleteJob(job.id, e)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                                title="Delete"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* In Progress Jobs */}
                {jobs.filter(j => j.status === 'in_progress').length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      In Progress
                    </h3>
                    <div className="space-y-3">
                      {jobs.filter(j => j.status === 'in_progress').map((job) => (
                        <div
                          key={job.id}
                          className="p-4 border-2 border-blue-200 bg-blue-50 rounded-xl hover:border-blue-300 transition"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h4 className="font-semibold text-gray-800">{job.title}</h4>
                                <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  IN PROGRESS
                                </span>
                              </div>
                              {job.description && (
                                <p className="text-gray-600 text-sm mb-2">{job.description}</p>
                              )}
                              <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                                {job.service_provider_profile && (
                                  <button
                                    onClick={() => navigate(`/provider/${job.service_provider_id}`)}
                                    className="text-blue-600 hover:text-blue-700 font-medium hover:underline"
                                  >
                                    {job.service_provider_profile.business_name}
                                  </button>
                                )}
                                {job.service_category && (
                                  <span>• {job.service_category.name}</span>
                                )}
                                {job.start_date && (
                                  <span>• Started: {new Date(job.start_date).toLocaleDateString()}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setSelectedJobId(job.id)}
                                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-medium text-sm"
                              >
                                View
                              </button>
                              <button
                                onClick={(e) => handleDeleteJob(job.id, e)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                                title="Delete"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Completed Jobs */}
                {jobs.filter(j => j.status === 'completed').length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      Completed
                    </h3>
                    <div className="space-y-3">
                      {jobs.filter(j => j.status === 'completed').slice(0, 3).map((job) => (
                        <div
                          key={job.id}
                          className="p-4 border-2 border-green-200 bg-green-50 rounded-xl hover:border-green-300 transition"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h4 className="font-semibold text-gray-800">{job.title}</h4>
                                <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  COMPLETED
                                </span>
                              </div>
                              {job.description && (
                                <p className="text-gray-600 text-sm mb-2">{job.description}</p>
                              )}
                              <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                                {job.service_provider_profile && (
                                  <button
                                    onClick={() => navigate(`/provider/${job.service_provider_id}`)}
                                    className="text-blue-600 hover:text-blue-700 font-medium hover:underline"
                                  >
                                    {job.service_provider_profile.business_name}
                                  </button>
                                )}
                                {job.service_category && (
                                  <span>• {job.service_category.name}</span>
                                )}
                                {job.completed_date && (
                                  <span>• Completed: {new Date(job.completed_date).toLocaleDateString()}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setSelectedJobId(job.id)}
                                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-medium text-sm"
                              >
                                View
                              </button>
                              <button
                                onClick={(e) => handleDeleteJob(job.id, e)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                                title="Delete"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                      {jobs.filter(j => j.status === 'completed').length > 3 && (
                        <p className="text-center text-sm text-gray-600 pt-2">
                          Showing 3 of {jobs.filter(j => j.status === 'completed').length} completed jobs
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <Files className="text-white" size={24} />
                  </div>
                  <h2 className="text-2xl font-bold text-white">Lease Agreements</h2>
                </div>
                <label className="cursor-pointer">
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 font-semibold shadow-md ${
                    uploadingGeneral
                      ? 'bg-white/20 text-white/60'
                      : 'bg-white text-blue-700 hover:bg-blue-50'
                  }`}>
                    {uploadingGeneral ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Upload size={20} />
                        <span>Upload</span>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleGeneralAgreementUpload}
                    disabled={uploadingGeneral || uploadingAgreementId !== null}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
            <div className="p-6 bg-gradient-to-b from-gray-50/50 to-white">
              {activeAgreements.length === 0 && standaloneDocuments.length === 0 ? (
                <div className="text-center py-16">
                  <div className="inline-block p-6 bg-blue-50 rounded-2xl mb-4">
                    <Calendar className="mx-auto text-blue-500" size={56} />
                  </div>
                  <p className="text-gray-700 font-semibold text-lg mb-2">No active rental agreements</p>
                  <p className="text-gray-500">Upload an agreement document to get started</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeAgreements.map((agreement) => (
                    <div
                      key={agreement.id}
                      className="group p-5 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-400 hover:shadow-lg transition-all duration-200"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900 text-lg group-hover:text-blue-700 transition-colors">
                            {agreement.property?.address_line1}
                          </h3>
                          <p className="text-sm text-gray-500 font-medium mt-1">
                            {agreement.property?.city}, {agreement.property?.state}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right bg-green-50 px-4 py-2 rounded-lg">
                            <p className="font-bold text-green-700 text-lg">
                              ${Number(agreement.monthly_rent).toLocaleString()}
                            </p>
                            <p className="text-xs text-green-600 font-medium">per month</p>
                          </div>
                          <label className="cursor-pointer group">
                            <div
                              className={`p-2.5 rounded-xl transition-all duration-200 border-2 shadow-sm hover:shadow-md ${
                                uploadingAgreementId === agreement.id
                                  ? 'bg-gray-100 text-gray-400 border-gray-300'
                                  : 'bg-blue-600 text-white hover:bg-blue-700 border-blue-600'
                              }`}
                              title="Upload Agreement Document"
                            >
                              {uploadingAgreementId === agreement.id ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600"></div>
                              ) : (
                                <Upload size={20} />
                              )}
                            </div>
                            <input
                              type="file"
                              accept=".pdf,.doc,.docx"
                              onChange={(e) => handleAgreementUpload(agreement.id, e)}
                              disabled={uploadingAgreementId !== null}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded-lg mt-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Users size={16} className="text-blue-600" />
                        </div>
                        <span className="font-medium">{agreement.renter?.full_name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mt-2">
                        <Calendar size={16} className="text-gray-400" />
                        <span>
                          {new Date(agreement.lease_start_date).toLocaleDateString()} -{' '}
                          {new Date(agreement.lease_end_date).toLocaleDateString()}
                        </span>
                      </div>

                      {agreementDocuments[agreement.id] && agreementDocuments[agreement.id].length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <p className="text-xs font-semibold text-gray-700 mb-3">Uploaded Documents</p>
                          <div className="space-y-2">
                            {agreementDocuments[agreement.id].map((doc) => (
                              <div key={doc.id} className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-white rounded-lg border border-blue-100 hover:border-blue-300 transition-colors">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <File size={16} className="text-blue-600" />
                                  </div>
                                  <span className="text-sm text-gray-800 font-medium truncate">{doc.file_name}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleView(doc)}
                                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                    title="View"
                                  >
                                    <Eye size={16} />
                                  </button>
                                  <button
                                    onClick={() => handleDownload(doc)}
                                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                    title="Download"
                                  >
                                    <Download size={16} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteDocument(doc)}
                                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {standaloneDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl hover:border-blue-400 hover:shadow-lg transition-all duration-200"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                            <FileText size={24} className="text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-gray-900 truncate text-lg">{doc.file_name}</h3>
                            <p className="text-sm text-gray-600 mt-1">
                              Uploaded on <span className="font-medium">{new Date(doc.uploaded_at).toLocaleDateString()}</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleView(doc)}
                            className="p-2.5 text-gray-700 hover:text-blue-600 hover:bg-white rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
                            title="View Document"
                          >
                            <Eye size={20} />
                          </button>
                          <button
                            onClick={() => handleDownload(doc)}
                            className="p-2.5 text-gray-700 hover:text-blue-600 hover:bg-white rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
                            title="Download Document"
                          >
                            <Download size={20} />
                          </button>
                          <button
                            onClick={() => handleDeleteDocument(doc)}
                            className="p-2.5 text-gray-700 hover:text-red-600 hover:bg-white rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
                            title="Delete Document"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <RentProgressTracker agreements={activeAgreements} />
          </div>
        </div>

        <div className="mt-8">
          <AssignedRenters />
        </div>

        <div className="mt-8">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                    <Star className="text-yellow-500" size={28} />
                    Tenant Reviews
                  </h2>
                  <p className="text-gray-600 mt-1">Reviews from your tenants</p>
                </div>
                <button
                  onClick={() => setShowImportReview(true)}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  <Plus size={20} />
                  Import Review
                </button>
              </div>
            </div>
            <div className="p-6">
              {reviews.length === 0 ? (
                <div className="text-center py-12">
                  <Star size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500 text-lg">No reviews yet</p>
                  <p className="text-gray-400 text-sm mt-2 mb-4">Reviews from your tenants will appear here</p>
                  <button
                    onClick={() => setShowImportReview(true)}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Import your first review
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div key={review.id} className="border-b border-gray-200 pb-4 last:border-b-0">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  size={16}
                                  className={i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                                />
                              ))}
                            </div>
                            <span className="text-gray-500 text-sm">
                              {new Date(review.created_at).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                          {review.is_imported && review.external_source && (
                            <div className="flex items-center gap-2 mb-2">
                              <Globe size={14} className="text-blue-600" />
                              <span className="text-sm text-gray-600">
                                Originally posted on <span className="font-medium text-blue-600">{review.external_source}</span>
                              </span>
                              {review.external_url && (
                                <a
                                  href={review.external_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-700"
                                >
                                  <ExternalLink size={14} />
                                </a>
                              )}
                            </div>
                          )}
                          {review.external_reviewer_name && (
                            <p className="text-sm text-gray-600 mb-2">
                              By {review.external_reviewer_name}
                            </p>
                          )}
                        </div>
                      </div>
                      <p className="text-gray-700 leading-relaxed">{review.comment}</p>
                    </div>
                  ))}
                  {reviews.length >= 5 && (
                    <button
                      onClick={() => navigate('/property-owner/reviews')}
                      className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                    >
                      View all reviews →
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedJobId && (
        <JobDetailsModal
          jobId={selectedJobId}
          onClose={() => setSelectedJobId(null)}
          onUpdate={() => loadDashboardData()}
          isPropertyOwner={true}
        />
      )}

      {showImportReview && (
        <ImportExternalReview
          onClose={() => setShowImportReview(false)}
          onSuccess={() => {
            loadReviews();
            setShowImportReview(false);
          }}
          reviewType="property_owner"
        />
      )}
    </div>
  );
}
