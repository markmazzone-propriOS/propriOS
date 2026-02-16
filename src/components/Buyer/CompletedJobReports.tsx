import { useState, useEffect } from 'react';
import { FileText, Download, Calendar, DollarSign, Clock, ChevronRight, Eye } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useNavigate } from '../Navigation/Router';

type Job = {
  id: string;
  job_number: string;
  title: string;
  description: string | null;
  status: string;
  completed_at: string | null;
  actual_hours: number;
  actual_cost: number;
  service_provider: {
    id: string;
    full_name: string;
  };
};

type JobAttachment = {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  description: string | null;
  created_at: string;
};

export function CompletedJobReports() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [attachments, setAttachments] = useState<JobAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadJobs();
    }
  }, [user]);

  const loadJobs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('service_provider_jobs')
        .select(`
          id,
          job_number,
          title,
          description,
          status,
          completed_at,
          actual_hours,
          actual_cost,
          service_provider:service_provider_id(id, full_name)
        `)
        .eq('buyer_id', user!.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error loading jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAttachments = async (jobId: string) => {
    try {
      const { data, error } = await supabase
        .from('service_provider_job_attachments')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAttachments(data || []);
    } catch (error) {
      console.error('Error loading attachments:', error);
    }
  };

  const handleViewJob = (job: Job) => {
    setSelectedJob(job);
    loadAttachments(job.id);
  };

  const handleDownloadFile = async (attachment: JobAttachment) => {
    try {
      setDownloadingFile(attachment.id);
      const { data, error } = await supabase.storage
        .from('job-attachments')
        .download(attachment.file_path);

      if (error) throw error;

      const url = window.URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.file_name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      alert(error.message || 'Failed to download file');
    } finally {
      setDownloadingFile(null);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC'
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (selectedJob) {
    return (
      <div>
        <div className="bg-white shadow-sm border-b mb-8">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <button
              onClick={() => setSelectedJob(null)}
              className="text-blue-600 hover:text-blue-700 font-medium mb-4"
            >
              ← Back to Reports
            </button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-800">{selectedJob.title}</h1>
                <p className="text-gray-600 mt-1">Job #{selectedJob.job_number}</p>
              </div>
              <div className="bg-green-100 text-green-800 px-4 py-2 rounded-lg font-semibold">
                Completed
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 pb-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Report Details</h2>
                {selectedJob.description && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-600 mb-2">Description</p>
                    <p className="text-gray-800">{selectedJob.description}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 font-medium mb-1">Completed Date</p>
                    <div className="flex items-center text-gray-800">
                      <Calendar size={16} className="mr-2" />
                      {formatDate(selectedJob.completed_at)}
                    </div>
                  </div>
                  <div>
                    <p className="text-gray-600 font-medium mb-1">Service Provider</p>
                    <p className="text-gray-800">{selectedJob.service_provider.full_name}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Documents & Reports</h2>
                {attachments.length === 0 ? (
                  <p className="text-gray-600 text-center py-8">No documents available</p>
                ) : (
                  <div className="space-y-3">
                    {attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <FileText className="text-blue-600" size={20} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-800 truncate">{attachment.file_name}</p>
                            <p className="text-sm text-gray-600">
                              {formatFileSize(attachment.file_size)} • {formatDate(attachment.created_at)}
                            </p>
                            {attachment.description && (
                              <p className="text-sm text-gray-500 mt-1">{attachment.description}</p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDownloadFile(attachment)}
                          disabled={downloadingFile === attachment.id}
                          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50"
                        >
                          <Download size={18} className="mr-2" />
                          {downloadingFile === attachment.id ? 'Downloading...' : 'Download'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4">Summary</h2>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600 flex items-center">
                        <Clock size={16} className="mr-2" />
                        Hours Logged
                      </span>
                      <span className="font-semibold">{selectedJob.actual_hours || 0}h</span>
                    </div>
                  </div>
                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 flex items-center">
                        <DollarSign size={16} className="mr-2" />
                        Total Cost
                      </span>
                      <span className="font-semibold text-green-600">
                        ${selectedJob.actual_cost?.toLocaleString() || '0'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-white shadow-sm border-b mb-8">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-800">Completed Service Reports</h1>
          <p className="text-gray-600 mt-2">View inspection reports, appraisals, and other completed services</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-12">
        {jobs.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <FileText className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No Completed Reports</h3>
            <p className="text-gray-600">
              Service reports from inspections, appraisals, and other services will appear here once completed.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="bg-white rounded-lg shadow p-6 hover:shadow-md transition cursor-pointer"
                onClick={() => handleViewJob(job)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-gray-800">{job.title}</h3>
                      <span className="text-sm text-gray-500">#{job.job_number}</span>
                    </div>
                    {job.description && (
                      <p className="text-gray-600 mb-3 line-clamp-2">{job.description}</p>
                    )}
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <div className="flex items-center">
                        <Calendar size={16} className="mr-2" />
                        Completed {formatDate(job.completed_at)}
                      </div>
                      <div className="flex items-center">
                        <Clock size={16} className="mr-2" />
                        {job.actual_hours || 0} hours
                      </div>
                      <div className="flex items-center">
                        <DollarSign size={16} className="mr-2" />
                        ${job.actual_cost?.toLocaleString() || '0'}
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      By {job.service_provider.full_name}
                    </p>
                  </div>
                  <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition">
                    <Eye size={18} className="mr-2" />
                    View Report
                    <ChevronRight size={18} className="ml-1" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
