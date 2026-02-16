import { useState, useEffect } from 'react';
import { Briefcase, Clock, DollarSign, MapPin, User, Calendar, Plus, ArrowLeft, FileText, CheckCircle, XCircle, AlertCircle, Pause } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useNavigate } from '../Navigation/Router';

type Job = {
  id: string;
  job_number: string;
  title: string;
  description: string | null;
  location: string | null;
  status: string;
  priority: string;
  estimated_hours: number | null;
  actual_hours: number;
  estimated_cost: number | null;
  actual_cost: number;
  start_date: string;
  end_date: string | null;
  completed_at: string | null;
  property_owner?: {
    full_name: string;
  };
  buyer?: {
    full_name: string;
  };
  appointment?: {
    client_name: string;
  };
};

export function JobsManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled'>('all');

  useEffect(() => {
    if (user) {
      loadJobs();
    }
  }, [user, filter]);

  const loadJobs = async () => {
    try {
      setLoading(true);
      console.log('Loading jobs for user:', user?.id);
      console.log('Full user object:', user);

      let query = supabase
        .from('service_provider_jobs')
        .select('*, property_owner:profiles!property_owner_id(full_name), buyer:profiles!buyer_id(full_name)')
        .eq('service_provider_id', user?.id)
        .order('start_date', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading jobs:', error);
        alert('Error loading jobs: ' + error.message);
        throw error;
      }
      console.log('Loaded jobs:', data);
      setJobs(data || []);
    } catch (error: any) {
      console.error('Error loading jobs:', error);
      alert('Failed to load jobs: ' + (error?.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Calendar className="text-blue-600" size={20} />;
      case 'in_progress':
        return <Clock className="text-yellow-600" size={20} />;
      case 'completed':
        return <CheckCircle className="text-green-600" size={20} />;
      case 'cancelled':
        return <XCircle className="text-red-600" size={20} />;
      case 'on_hold':
        return <Pause className="text-gray-600" size={20} />;
      default:
        return <Briefcase className="text-gray-600" size={20} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'on_hold':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'normal':
        return 'bg-blue-100 text-blue-800';
      case 'low':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const activeJobs = jobs.filter(j => j.status === 'scheduled' || j.status === 'in_progress');
  const totalEstimatedRevenue = jobs
    .filter(j => j.status !== 'cancelled')
    .reduce((sum, j) => sum + (j.estimated_cost || 0), 0);
  const totalActualRevenue = jobs
    .filter(j => j.status === 'completed')
    .reduce((sum, j) => sum + (j.actual_cost || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-white shadow-sm border-b mb-8">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => navigate('/service-provider/dashboard')}
              className="text-gray-600 hover:text-blue-600 transition"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Jobs Management</h1>
              <p className="text-gray-600 mt-1">Track all your jobs and their progress</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-medium">Active Jobs</p>
                  <p className="text-2xl font-bold text-blue-900 mt-1">{activeJobs.length}</p>
                </div>
                <Briefcase className="text-blue-600" size={32} />
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600 font-medium">Completed</p>
                  <p className="text-2xl font-bold text-green-900 mt-1">
                    {jobs.filter(j => j.status === 'completed').length}
                  </p>
                </div>
                <CheckCircle className="text-green-600" size={32} />
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600 font-medium">Est. Revenue</p>
                  <p className="text-2xl font-bold text-purple-900 mt-1">
                    ${totalEstimatedRevenue.toLocaleString()}
                  </p>
                </div>
                <DollarSign className="text-purple-600" size={32} />
              </div>
            </div>
            <div className="bg-emerald-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-emerald-600 font-medium">Actual Revenue</p>
                  <p className="text-2xl font-bold text-emerald-900 mt-1">
                    ${totalActualRevenue.toLocaleString()}
                  </p>
                </div>
                <DollarSign className="text-emerald-600" size={32} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-4 border-b">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-md font-medium transition ${
                  filter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Jobs ({jobs.length})
              </button>
              <button
                onClick={() => setFilter('scheduled')}
                className={`px-4 py-2 rounded-md font-medium transition ${
                  filter === 'scheduled'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Scheduled
              </button>
              <button
                onClick={() => setFilter('in_progress')}
                className={`px-4 py-2 rounded-md font-medium transition ${
                  filter === 'in_progress'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                In Progress
              </button>
              <button
                onClick={() => setFilter('completed')}
                className={`px-4 py-2 rounded-md font-medium transition ${
                  filter === 'completed'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Completed
              </button>
              <button
                onClick={() => setFilter('cancelled')}
                className={`px-4 py-2 rounded-md font-medium transition ${
                  filter === 'cancelled'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Cancelled
              </button>
            </div>
          </div>
        </div>

        {jobs.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Briefcase className="mx-auto text-gray-400 mb-4" size={64} />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No Jobs Found</h3>
            <p className="text-gray-600 mb-6">
              Jobs are automatically created when you schedule appointments with property owners.
            </p>
            <button
              onClick={() => navigate('/service-provider/calendar')}
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Calendar className="mr-2" size={20} />
              Schedule Appointment
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <div
                key={job.id}
                onClick={() => navigate(`/service-provider/jobs/${job.id}`)}
                className="bg-white rounded-lg shadow hover:shadow-lg transition cursor-pointer"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-3 flex-1">
                      {getStatusIcon(job.status)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-semibold text-gray-800">{job.title}</h3>
                          <span className="text-sm text-gray-500">#{job.job_number}</span>
                        </div>
                        {job.description && (
                          <p className="text-gray-600 text-sm mb-2 line-clamp-2">{job.description}</p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                            {job.status.replace('_', ' ')}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(job.priority)}`}>
                            {job.priority} priority
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center text-gray-600">
                      <User size={16} className="mr-2 flex-shrink-0" />
                      <span className="truncate">
                        {job.buyer?.full_name || job.property_owner?.full_name || job.appointment?.client_name || 'No client'}
                      </span>
                    </div>
                    {job.location && (
                      <div className="flex items-center text-gray-600">
                        <MapPin size={16} className="mr-2 flex-shrink-0" />
                        <span className="truncate">{job.location}</span>
                      </div>
                    )}
                    <div className="flex items-center text-gray-600">
                      <Calendar size={16} className="mr-2 flex-shrink-0" />
                      <span>Start: {formatDate(job.start_date)}</span>
                    </div>
                    {job.estimated_cost && (
                      <div className="flex items-center text-gray-600">
                        <DollarSign size={16} className="mr-2 flex-shrink-0" />
                        <span>Est: ${job.estimated_cost.toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  {(job.estimated_hours || job.actual_hours > 0) && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center text-gray-600">
                          <Clock size={16} className="mr-2" />
                          <span>
                            Hours: {job.actual_hours}
                            {job.estimated_hours && ` / ${job.estimated_hours}`}
                          </span>
                        </div>
                        {job.actual_cost > 0 && (
                          <div className="text-gray-600">
                            Actual: ${job.actual_cost.toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
