import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Clock, DollarSign, MapPin, User, Calendar, Edit, Save, X, Plus, Upload, File, Trash2, CheckCircle, Download, FileText } from 'lucide-react';
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
  notes: string | null;
  buyer_id?: string | null;
  property_owner?: {
    id: string;
    full_name: string;
    phone_number: string;
  };
  buyer?: {
    id: string;
    full_name: string;
    email: string;
    phone_number: string;
  };
};

type JobUpdate = {
  id: string;
  update_type: string;
  title: string;
  description: string | null;
  old_value: string | null;
  new_value: string | null;
  hours_logged: number | null;
  cost_added: number | null;
  created_at: string;
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

type JobDetailsProps = {
  jobId: string;
};

export function JobDetails({ jobId }: JobDetailsProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [updates, setUpdates] = useState<JobUpdate[]>([]);
  const [attachments, setAttachments] = useState<JobAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [editedJob, setEditedJob] = useState<Partial<Job>>({});
  const [buyerSearchQuery, setBuyerSearchQuery] = useState('');
  const [buyerSearchResults, setBuyerSearchResults] = useState<Array<{ id: string; full_name: string; email: string; phone_number: string }>>([]);
  const [showBuyerSearch, setShowBuyerSearch] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [updateForm, setUpdateForm] = useState({
    update_type: 'progress_update',
    title: '',
    description: '',
    hours_logged: '',
    cost_added: '',
  });

  useEffect(() => {
    if (user && jobId) {
      loadJob();
      loadUpdates();
      loadAttachments();
    }
  }, [user, jobId]);

  const loadJob = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('service_provider_jobs')
        .select(`
          *,
          property_owner:property_owner_id(id, full_name, phone_number),
          buyer:buyer_id(id, full_name, phone_number)
        `)
        .eq('id', jobId)
        .single();

      if (error) throw error;

      // Fetch emails from auth.users using helper function
      const [propertyOwnerEmailResult, buyerEmailResult] = await Promise.all([
        data.property_owner_id
          ? supabase.rpc('get_user_email', { user_id: data.property_owner_id })
          : Promise.resolve({ data: null, error: null }),
        data.buyer_id
          ? supabase.rpc('get_user_email', { user_id: data.buyer_id })
          : Promise.resolve({ data: null, error: null })
      ]);

      // Merge email data
      const enrichedData = {
        ...data,
        property_owner: data.property_owner ? {
          ...data.property_owner,
          email: propertyOwnerEmailResult.data
        } : null,
        buyer: data.buyer ? {
          ...data.buyer,
          email: buyerEmailResult.data
        } : null
      };

      setJob(enrichedData);
      setEditedJob(enrichedData);
    } catch (error) {
      console.error('Error loading job:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUpdates = async () => {
    try {
      const { data, error } = await supabase
        .from('service_provider_job_updates')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUpdates(data || []);
    } catch (error) {
      console.error('Error loading updates:', error);
    }
  };

  const loadAttachments = async () => {
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

  const handleSaveJob = async () => {
    if (!job) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('service_provider_jobs')
        .update({
          title: editedJob.title,
          description: editedJob.description,
          location: editedJob.location,
          priority: editedJob.priority,
          estimated_hours: editedJob.estimated_hours,
          estimated_cost: editedJob.estimated_cost,
          notes: editedJob.notes,
          buyer_id: editedJob.buyer_id,
        })
        .eq('id', jobId);

      if (error) throw error;

      await loadJob();
      setEditing(false);
      setShowBuyerSearch(false);
    } catch (error: any) {
      alert(error.message || 'Failed to save job');
    } finally {
      setSaving(false);
    }
  };

  const searchBuyers = async (query: string) => {
    if (!query || query.length < 2) {
      setBuyerSearchResults([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone_number')
        .eq('user_type', 'buyer')
        .ilike('full_name', `%${query}%`)
        .limit(10);

      if (error) throw error;

      // Fetch emails for each buyer
      const buyersWithEmails = await Promise.all(
        (data || []).map(async (buyer) => {
          const { data: email } = await supabase.rpc('get_user_email', { user_id: buyer.id });
          return { ...buyer, email: email || '' };
        })
      );

      setBuyerSearchResults(buyersWithEmails);
    } catch (error) {
      console.error('Error searching buyers:', error);
    }
  };

  const handleBuyerSearchChange = (query: string) => {
    setBuyerSearchQuery(query);
    searchBuyers(query);
  };

  const handleSelectBuyer = (buyer: { id: string; full_name: string; email: string }) => {
    setEditedJob({ ...editedJob, buyer_id: buyer.id, buyer });
    setBuyerSearchQuery(buyer.full_name);
    setBuyerSearchResults([]);
    setShowBuyerSearch(false);
  };

  const handleRemoveBuyer = () => {
    setEditedJob({ ...editedJob, buyer_id: null, buyer: undefined });
    setBuyerSearchQuery('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !job) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user!.id}/${jobId}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('job-attachments')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { error: dbError } = await supabase
          .from('service_provider_job_attachments')
          .insert({
            job_id: jobId,
            service_provider_id: user!.id,
            file_name: file.name,
            file_path: fileName,
            file_type: file.type,
            file_size: file.size,
          });

        if (dbError) throw dbError;
      }

      await loadAttachments();
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      alert(error.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
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

  const handleDeleteAttachment = async (attachment: JobAttachment) => {
    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
      const { error: storageError } = await supabase.storage
        .from('job-attachments')
        .remove([attachment.file_path]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('service_provider_job_attachments')
        .delete()
        .eq('id', attachment.id);

      if (dbError) throw dbError;

      await loadAttachments();
    } catch (error: any) {
      alert(error.message || 'Failed to delete file');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!job) return;

    if (!confirm(`Are you sure you want to change the job status to "${newStatus}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('service_provider_jobs')
        .update({ status: newStatus })
        .eq('id', jobId);

      if (error) throw error;

      await loadJob();
      await loadUpdates();
    } catch (error: any) {
      alert(error.message || 'Failed to update status');
    }
  };

  const handleAddUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job) return;

    setSaving(true);
    try {
      const hoursLogged = updateForm.hours_logged ? parseFloat(updateForm.hours_logged) : null;
      const costAdded = updateForm.cost_added ? parseFloat(updateForm.cost_added) : null;

      const { error: updateError } = await supabase
        .from('service_provider_job_updates')
        .insert({
          job_id: jobId,
          service_provider_id: user!.id,
          update_type: updateForm.update_type,
          title: updateForm.title,
          description: updateForm.description || null,
          hours_logged: hoursLogged,
          cost_added: costAdded,
        });

      if (updateError) throw updateError;

      if (hoursLogged || costAdded) {
        const { error: jobError } = await supabase
          .from('service_provider_jobs')
          .update({
            actual_hours: (job.actual_hours || 0) + (hoursLogged || 0),
            actual_cost: (job.actual_cost || 0) + (costAdded || 0),
          })
          .eq('id', jobId);

        if (jobError) throw jobError;
      }

      setUpdateForm({
        update_type: 'progress_update',
        title: '',
        description: '',
        hours_logged: '',
        cost_added: '',
      });
      setShowUpdateModal(false);
      await loadJob();
      await loadUpdates();
    } catch (error: any) {
      alert(error.message || 'Failed to add update');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC'
    });
  };

  const getUpdateIcon = (type: string) => {
    switch (type) {
      case 'status_change':
        return <CheckCircle size={16} className="text-blue-600" />;
      case 'time_logged':
        return <Clock size={16} className="text-green-600" />;
      case 'cost_update':
        return <DollarSign size={16} className="text-purple-600" />;
      default:
        return <File size={16} className="text-gray-600" />;
    }
  };

  const exportToPDF = () => {
    if (!job) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups to export PDF');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Job #${job.job_number} - ${job.title}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: Arial, sans-serif;
              padding: 40px;
              color: #333;
              line-height: 1.6;
            }
            .header {
              border-bottom: 3px solid #2563eb;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            h1 {
              font-size: 28px;
              color: #1f2937;
              margin-bottom: 8px;
            }
            .job-number {
              font-size: 18px;
              color: #6b7280;
              font-weight: normal;
            }
            .status-badge {
              display: inline-block;
              padding: 6px 12px;
              background: #dbeafe;
              color: #1e40af;
              border-radius: 6px;
              font-size: 14px;
              font-weight: 600;
              text-transform: uppercase;
              margin-top: 10px;
            }
            .section {
              margin-bottom: 30px;
              page-break-inside: avoid;
            }
            .section-title {
              font-size: 18px;
              font-weight: bold;
              color: #1f2937;
              margin-bottom: 12px;
              padding-bottom: 8px;
              border-bottom: 2px solid #e5e7eb;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin-bottom: 20px;
            }
            .info-item {
              margin-bottom: 12px;
            }
            .info-label {
              font-size: 12px;
              color: #6b7280;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 4px;
            }
            .info-value {
              font-size: 14px;
              color: #1f2937;
              font-weight: 500;
            }
            .description {
              background: #f9fafb;
              padding: 15px;
              border-radius: 8px;
              border-left: 4px solid #2563eb;
              margin-bottom: 20px;
            }
            .update-item {
              border-left: 4px solid #2563eb;
              padding-left: 15px;
              margin-bottom: 20px;
              padding-top: 8px;
              padding-bottom: 8px;
            }
            .update-title {
              font-weight: bold;
              color: #1f2937;
              margin-bottom: 6px;
            }
            .update-description {
              color: #4b5563;
              font-size: 14px;
              margin-bottom: 8px;
            }
            .update-meta {
              font-size: 12px;
              color: #6b7280;
            }
            .cost-breakdown {
              background: #f0fdf4;
              padding: 15px;
              border-radius: 8px;
              border: 1px solid #bbf7d0;
            }
            .cost-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .cost-row:last-child {
              border-bottom: none;
              font-weight: bold;
              font-size: 16px;
              padding-top: 12px;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 2px solid #e5e7eb;
              text-align: center;
              color: #6b7280;
              font-size: 12px;
            }
            @media print {
              body { padding: 20px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${job.title}</h1>
            <div class="job-number">Job #${job.job_number}</div>
            <div class="status-badge">${job.status.replace('_', ' ')}</div>
          </div>

          <div class="section">
            <div class="section-title">Job Details</div>
            ${job.description ? `<div class="description">${job.description}</div>` : ''}
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Location</div>
                <div class="info-value">${job.location || 'Not specified'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Priority</div>
                <div class="info-value">${job.priority.toUpperCase()}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Start Date</div>
                <div class="info-value">${formatDate(job.start_date)}</div>
              </div>
              ${job.end_date ? `
              <div class="info-item">
                <div class="info-label">End Date</div>
                <div class="info-value">${formatDate(job.end_date)}</div>
              </div>
              ` : ''}
            </div>
            ${job.notes ? `
            <div class="info-item">
              <div class="info-label">Internal Notes</div>
              <div class="description">${job.notes}</div>
            </div>
            ` : ''}
          </div>

          ${(job.buyer || job.property_owner) ? `
          <div class="section">
            <div class="section-title">Client Information</div>
            <div class="info-item">
              <div class="info-label">Name</div>
              <div class="info-value">${job.buyer?.full_name || job.property_owner?.full_name || 'N/A'}</div>
            </div>
            ${(job.buyer?.phone_number || job.property_owner?.phone_number) ? `
            <div class="info-item">
              <div class="info-label">Phone</div>
              <div class="info-value">${job.buyer?.phone_number || job.property_owner?.phone_number || 'N/A'}</div>
            </div>
            ` : ''}
          </div>
          ` : ''}

          <div class="section">
            <div class="section-title">Time & Cost Summary</div>
            <div class="cost-breakdown">
              <div class="cost-row">
                <span>Estimated Hours</span>
                <span>${job.estimated_hours || 0} hours</span>
              </div>
              <div class="cost-row">
                <span>Actual Hours Logged</span>
                <span>${job.actual_hours || 0} hours</span>
              </div>
              <div class="cost-row">
                <span>Estimated Cost</span>
                <span>$${(job.estimated_cost || 0).toLocaleString()}</span>
              </div>
              <div class="cost-row">
                <span>Actual Cost</span>
                <span>$${(job.actual_cost || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          ${updates.length > 0 ? `
          <div class="section">
            <div class="section-title">Job History</div>
            ${updates.map(update => `
              <div class="update-item">
                <div class="update-title">${update.title}</div>
                ${update.description ? `<div class="update-description">${update.description}</div>` : ''}
                <div class="update-meta">
                  ${formatDate(update.created_at)}
                  ${update.hours_logged ? ` • ${update.hours_logged}h logged` : ''}
                  ${update.cost_added ? ` • $${update.cost_added} added` : ''}
                </div>
              </div>
            `).join('')}
          </div>
          ` : ''}

          <div class="footer">
            Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  if (loading || !job) {
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
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => navigate('/service-provider/jobs')}
              className="text-gray-600 hover:text-blue-600 transition"
            >
              <ArrowLeft size={24} />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-gray-800">{job.title}</h1>
                <span className="text-lg text-gray-500">#{job.job_number}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={exportToPDF}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                <Download size={18} className="mr-2" />
                Export to PDF
              </button>
              <button
                onClick={() => setEditing(!editing)}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <Edit size={18} className="mr-2" />
                {editing ? 'Cancel Edit' : 'Edit Job'}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {['scheduled', 'in_progress', 'on_hold', 'completed', 'cancelled'].map((status) => (
              <button
                key={status}
                onClick={() => handleStatusChange(status)}
                disabled={job.status === status}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  job.status === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Job Details</h2>

              {editing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <input
                      type="text"
                      value={editedJob.title || ''}
                      onChange={(e) => setEditedJob({ ...editedJob, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={editedJob.description || ''}
                      onChange={(e) => setEditedJob({ ...editedJob, description: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                    <input
                      type="text"
                      value={editedJob.location || ''}
                      onChange={(e) => setEditedJob({ ...editedJob, location: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                      <select
                        value={editedJob.priority || 'normal'}
                        onChange={(e) => setEditedJob({ ...editedJob, priority: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Hours</label>
                      <input
                        type="number"
                        step="0.5"
                        value={editedJob.estimated_hours || ''}
                        onChange={(e) => setEditedJob({ ...editedJob, estimated_hours: parseFloat(e.target.value) || null })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Cost</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editedJob.estimated_cost || ''}
                        onChange={(e) => setEditedJob({ ...editedJob, estimated_cost: parseFloat(e.target.value) || null })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Assign to Buyer (Optional)
                    </label>
                    {editedJob.buyer ? (
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md border border-gray-300">
                        <div>
                          <p className="font-medium text-gray-800">{editedJob.buyer.full_name}</p>
                          <p className="text-sm text-gray-600">{editedJob.buyer.email}</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleRemoveBuyer}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <input
                          type="text"
                          value={buyerSearchQuery}
                          onChange={(e) => handleBuyerSearchChange(e.target.value)}
                          onFocus={() => setShowBuyerSearch(true)}
                          placeholder="Search buyer by name or email..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                        {showBuyerSearch && buyerSearchResults.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                            {buyerSearchResults.map((buyer) => (
                              <button
                                key={buyer.id}
                                type="button"
                                onClick={() => handleSelectBuyer(buyer)}
                                className="w-full text-left px-4 py-2 hover:bg-gray-100 transition"
                              >
                                <p className="font-medium text-gray-800">{buyer.full_name}</p>
                                <p className="text-sm text-gray-600">{buyer.email}</p>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Assign this job to a buyer so they can view the completed report and documents
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea
                      value={editedJob.notes || ''}
                      onChange={(e) => setEditedJob({ ...editedJob, notes: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveJob}
                      disabled={saving}
                      className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50"
                    >
                      <Save size={18} className="mr-2" />
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      onClick={() => {
                        setEditing(false);
                        setEditedJob(job);
                      }}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {job.description && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">Description</p>
                      <p className="text-gray-800 mt-1">{job.description}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center text-gray-600">
                      <MapPin size={16} className="mr-2" />
                      <span>{job.location || 'No location specified'}</span>
                    </div>
                    <div className="flex items-center text-gray-600">
                      <Calendar size={16} className="mr-2" />
                      <span>{formatDate(job.start_date)}</span>
                    </div>
                  </div>
                  {job.notes && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">Internal Notes</p>
                      <p className="text-gray-800 mt-1 text-sm">{job.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800">Job History</h2>
                <button
                  onClick={() => setShowUpdateModal(true)}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition text-sm"
                >
                  <Plus size={16} className="mr-2" />
                  Add Update
                </button>
              </div>

              <div className="space-y-4">
                {updates.length === 0 ? (
                  <p className="text-gray-600 text-center py-8">No updates yet</p>
                ) : (
                  updates.map((update) => (
                    <div key={update.id} className="border-l-4 border-blue-600 pl-4 py-2">
                      <div className="flex items-start gap-2">
                        {getUpdateIcon(update.update_type)}
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-800">{update.title}</h3>
                          {update.description && (
                            <p className="text-sm text-gray-600 mt-1">{update.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span>{formatDate(update.created_at)}</span>
                            {update.hours_logged && (
                              <span className="flex items-center">
                                <Clock size={12} className="mr-1" />
                                {update.hours_logged}h logged
                              </span>
                            )}
                            {update.cost_added && (
                              <span className="flex items-center">
                                <DollarSign size={12} className="mr-1" />
                                ${update.cost_added} added
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800">Documents & Attachments</h2>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className={`flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition cursor-pointer ${
                      uploading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <Upload size={16} className="mr-2" />
                    {uploading ? 'Uploading...' : 'Upload Files'}
                  </label>
                </div>
              </div>

              <div className="space-y-3">
                {attachments.length === 0 ? (
                  <div className="text-center py-12 text-gray-600 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <FileText size={48} className="mx-auto text-gray-400 mb-3" />
                    <p className="font-medium">No documents attached</p>
                    <p className="text-sm mt-1">Upload inspection reports, photos, or other relevant documents</p>
                  </div>
                ) : (
                  attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition bg-white"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <FileText className="text-blue-600" size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 truncate">{attachment.file_name}</p>
                          <p className="text-sm text-gray-600">
                            {formatFileSize(attachment.file_size)} • {new Date(attachment.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleDownloadFile(attachment)}
                          disabled={downloadingFile === attachment.id}
                          className="flex items-center px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-md transition disabled:opacity-50"
                        >
                          <Download size={16} className="mr-1" />
                          {downloadingFile === attachment.id ? 'Downloading...' : 'Download'}
                        </button>
                        <button
                          onClick={() => handleDeleteAttachment(attachment)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-md transition"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {(job.property_owner || job.buyer) && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4">Client Information</h2>
                {job.property_owner && (
                  <div className="space-y-3 text-sm mb-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Property Owner</p>
                      <p className="font-medium text-gray-800">{job.property_owner.full_name}</p>
                    </div>
                    {job.property_owner.phone_number && (
                      <div>
                        <p className="text-gray-600">Phone</p>
                        <p className="text-gray-800">{job.property_owner.phone_number}</p>
                      </div>
                    )}
                  </div>
                )}
                {job.buyer && (
                  <div className="space-y-3 text-sm pt-4 border-t border-gray-200">
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Buyer</p>
                      <p className="font-medium text-gray-800">{job.buyer.full_name}</p>
                    </div>
                    {job.buyer.phone_number && (
                      <div>
                        <p className="text-gray-600">Phone</p>
                        <p className="text-gray-800">{job.buyer.phone_number}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-gray-600">Email</p>
                      <p className="text-gray-800">{job.buyer.email}</p>
                    </div>
                    {job.status === 'completed' && (
                      <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded">
                        <p className="text-xs text-green-800">
                          Buyer can view this completed report
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Time & Cost</h2>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Hours Logged</span>
                    <span className="font-semibold">
                      {job.actual_hours}
                      {job.estimated_hours && ` / ${job.estimated_hours}`}
                    </span>
                  </div>
                  {job.estimated_hours && (
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${Math.min((job.actual_hours / job.estimated_hours) * 100, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
                <div className="pt-4 border-t">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Estimated Cost</span>
                    <span className="font-semibold">${job.estimated_cost?.toLocaleString() || '0'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Actual Cost</span>
                    <span className="font-semibold text-green-600">${job.actual_cost?.toLocaleString() || '0'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showUpdateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-800">Add Job Update</h2>
              <button
                onClick={() => setShowUpdateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleAddUpdate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Update Type</label>
                <select
                  value={updateForm.update_type}
                  onChange={(e) => setUpdateForm({ ...updateForm, update_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="progress_update">Progress Update</option>
                  <option value="note">Note</option>
                  <option value="time_logged">Time Logged</option>
                  <option value="cost_update">Cost Update</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={updateForm.title}
                  onChange={(e) => setUpdateForm({ ...updateForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="e.g., Completed foundation inspection"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={updateForm.description}
                  onChange={(e) => setUpdateForm({ ...updateForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Additional details..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hours Logged</label>
                  <input
                    type="number"
                    step="0.25"
                    value={updateForm.hours_logged}
                    onChange={(e) => setUpdateForm({ ...updateForm, hours_logged: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cost Added</label>
                  <input
                    type="number"
                    step="0.01"
                    value={updateForm.cost_added}
                    onChange={(e) => setUpdateForm({ ...updateForm, cost_added: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {saving ? 'Adding...' : 'Add Update'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowUpdateModal(false)}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
