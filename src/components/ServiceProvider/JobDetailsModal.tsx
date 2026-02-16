import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, MapPin, User, DollarSign, Briefcase, Clock, CheckCircle, FileText, Upload, Image as ImageIcon, Trash2, Receipt, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import jsPDF from 'jspdf';

interface JobDetailsModalProps {
  jobId: string;
  onClose: () => void;
  onUpdate: () => void;
  isPropertyOwner?: boolean;
}

interface JobData {
  id: string;
  title: string;
  description: string;
  status: string;
  location: string;
  start_date: string;
  end_date: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  notes: string | null;
  completion_notes: string | null;
  materials_used: string | null;
  completed_at: string | null;
  created_at: string;
  service_provider_id: string;
  property_owner_id: string;
  buyer_id?: string;
  appointment_id?: string;
  property_owner?: {
    full_name: string;
    email: string;
    phone_number: string;
  };
  buyer?: {
    full_name: string;
    email: string;
    phone_number: string;
  };
  appointment?: {
    client_name: string;
    client_email: string;
    client_phone: string;
  };
  service_provider_profile?: {
    business_name: string;
    business_phone: string;
    business_email: string;
  };
  service_category?: {
    name: string;
  };
}

interface StatusHistory {
  id: string;
  old_status: string | null;
  new_status: string;
  changed_at: string;
  changed_by: string;
  notes: string | null;
}

interface JobPhoto {
  id: string;
  photo_url: string;
  caption: string | null;
  uploaded_at: string;
}

interface JobAttachment {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  description: string | null;
  created_at: string;
}

type Invoice = {
  id: string;
  invoice_number: string;
  status: string;
  total: number;
  issue_date: string;
  due_date: string;
};

export default function JobDetailsModal({ jobId, onClose, onUpdate, isPropertyOwner = false }: JobDetailsModalProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [job, setJob] = useState<JobData | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusHistory[]>([]);
  const [photos, setPhotos] = useState<JobPhoto[]>([]);
  const [attachments, setAttachments] = useState<JobAttachment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [editedJob, setEditedJob] = useState<Partial<JobData>>({});

  useEffect(() => {
    loadJobData();
  }, [jobId]);

  const loadJobData = async () => {
    try {
      const { data: jobData, error: jobError } = await supabase
        .from('service_provider_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (jobError) throw jobError;
      if (!jobData) throw new Error('Job not found');

      const [propertyOwnerResult, buyerResult, providerProfileResult, providerPersonalResult, categoryResult, appointmentResult, historyResult, photosResult, attachmentsResult, invoicesResult] = await Promise.all([
        jobData.property_owner_id ? supabase
          .from('profiles')
          .select('full_name, phone_number')
          .eq('id', jobData.property_owner_id)
          .maybeSingle() : Promise.resolve({ data: null, error: null }),

        jobData.buyer_id ? supabase
          .from('profiles')
          .select('full_name, phone_number')
          .eq('id', jobData.buyer_id)
          .maybeSingle() : Promise.resolve({ data: null, error: null }),

        supabase
          .from('service_provider_profiles')
          .select('business_name, business_email')
          .eq('id', jobData.service_provider_id)
          .maybeSingle(),

        supabase
          .from('profiles')
          .select('phone_number')
          .eq('id', jobData.service_provider_id)
          .maybeSingle(),

        jobData.service_category_id ? supabase
          .from('service_categories')
          .select('name')
          .eq('id', jobData.service_category_id)
          .maybeSingle() : Promise.resolve({ data: null, error: null }),

        jobData.appointment_id ? supabase
          .from('service_provider_appointments')
          .select('client_name, client_email, client_phone')
          .eq('id', jobData.appointment_id)
          .maybeSingle() : Promise.resolve({ data: null, error: null }),

        supabase
          .from('job_status_history')
          .select('*')
          .eq('job_id', jobId)
          .order('changed_at', { ascending: false }),

        supabase
          .from('service_provider_photos')
          .select('*')
          .eq('service_provider_id', jobData.service_provider_id)
          .order('uploaded_at', { ascending: false }),

        supabase
          .from('service_provider_job_attachments')
          .select('*')
          .eq('job_id', jobId)
          .order('created_at', { ascending: false }),

        supabase
          .from('invoices')
          .select('id, invoice_number, status, total, issue_date, due_date')
          .eq('job_id', jobId)
          .order('created_at', { ascending: false })
      ]);

      // Merge service provider profile with phone from profiles table
      const mergedProviderProfile = providerProfileResult.data ? {
        ...providerProfileResult.data,
        business_phone: providerPersonalResult.data?.phone_number || null
      } : null;

      // Fetch emails from auth.users for property owner and buyer using the helper function
      const [propertyOwnerEmailResult, buyerEmailResult] = await Promise.all([
        jobData.property_owner_id
          ? supabase.rpc('get_user_email', { user_id: jobData.property_owner_id })
          : Promise.resolve({ data: null, error: null }),
        jobData.buyer_id
          ? supabase.rpc('get_user_email', { user_id: jobData.buyer_id })
          : Promise.resolve({ data: null, error: null })
      ]);

      const mergedPropertyOwner = propertyOwnerResult.data ? {
        ...propertyOwnerResult.data,
        email: propertyOwnerEmailResult.data
      } : null;

      const mergedBuyer = buyerResult.data ? {
        ...buyerResult.data,
        email: buyerEmailResult.data
      } : null;

      console.log('Job data loaded:', {
        jobData,
        propertyOwner: mergedPropertyOwner,
        buyer: mergedBuyer,
        providerProfile: mergedProviderProfile,
        appointment: appointmentResult.data
      });

      if (providerProfileResult.error) {
        console.error('Error loading service provider profile:', providerProfileResult.error);
      }

      const enrichedJobData = {
        ...jobData,
        property_owner: mergedPropertyOwner,
        buyer: mergedBuyer,
        appointment: appointmentResult.data,
        service_provider_profile: mergedProviderProfile,
        service_category: categoryResult.data
      };

      setJob(enrichedJobData);
      setEditedJob(enrichedJobData);
      setStatusHistory(historyResult.data || []);
      setPhotos(photosResult.data || []);
      setAttachments(attachmentsResult.data || []);
      setInvoices(invoicesResult.data || []);
    } catch (error: any) {
      console.error('Error loading job data:', error);
      alert(`Failed to load job details: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!job) return;
    setIsSaving(true);

    try {
      const updates: any = {
        notes: editedJob.notes,
        completion_notes: editedJob.completion_notes,
        materials_used: editedJob.materials_used,
        actual_cost: editedJob.actual_cost,
        end_date: editedJob.end_date,
      };

      if (editedJob.status !== job.status) {
        updates.status = editedJob.status;
        if (editedJob.status === 'completed' && !job.completed_at) {
          updates.completed_at = new Date().toISOString();
        }
      }

      const { error } = await supabase
        .from('service_provider_jobs')
        .update(updates)
        .eq('id', jobId);

      if (error) throw error;

      await loadJobData();
      setIsEditing(false);
      onUpdate();
      alert('Job updated successfully!');
    } catch (error) {
      console.error('Error updating job:', error);
      alert('Failed to update job');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !job) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB');
      return;
    }

    setUploadingPhoto(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${job.service_provider_id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('service-provider-photos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('service-provider-photos')
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase
        .from('service_provider_photos')
        .insert({
          service_provider_id: job.service_provider_id,
          photo_url: publicUrl,
          caption: `Job: ${job.title}`,
        });

      if (insertError) throw insertError;

      await loadJobData();
      alert('Photo uploaded successfully!');
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = async (photoId: string, photoUrl: string) => {
    if (!confirm('Are you sure you want to delete this photo?')) return;

    try {
      const pathParts = photoUrl.split('/service-provider-photos/');
      if (pathParts.length > 1) {
        const filePath = pathParts[1];
        await supabase.storage.from('service-provider-photos').remove([filePath]);
      }

      const { error } = await supabase
        .from('service_provider_photos')
        .delete()
        .eq('id', photoId);

      if (error) throw error;

      await loadJobData();
    } catch (error) {
      console.error('Error deleting photo:', error);
      alert('Failed to delete photo');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !job) return;

    setUploadingFile(true);
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

      await loadJobData();
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      alert('Files uploaded successfully!');
    } catch (error: any) {
      alert(error.message || 'Failed to upload file');
    } finally {
      setUploadingFile(false);
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

      await loadJobData();
    } catch (error: any) {
      alert(error.message || 'Failed to delete file');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50';
      case 'in_progress': return 'text-blue-600 bg-blue-50';
      case 'scheduled': return 'text-yellow-600 bg-yellow-50';
      case 'pending': return 'text-orange-600 bg-orange-50';
      case 'cancelled': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC'
    });
  };

  const downloadPDF = () => {
    if (!job) return;

    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 20;
      let yPos = 20;

      // Helper to add text with wrapping
      const addText = (text: string, fontSize: number, isBold: boolean = false, maxWidth?: number) => {
        pdf.setFontSize(fontSize);
        pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
        const lines = pdf.splitTextToSize(text, maxWidth || pageWidth - 2 * margin);
        pdf.text(lines, margin, yPos);
        yPos += lines.length * fontSize * 0.5 + 5;
      };

      // Add divider line
      const addLine = () => {
        pdf.setDrawColor(229, 231, 235);
        pdf.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 10;
      };

      // Check if we need a new page
      const checkNewPage = (spaceNeeded: number = 30) => {
        if (yPos + spaceNeeded > pdf.internal.pageSize.getHeight() - margin) {
          pdf.addPage();
          yPos = margin;
        }
      };

      // Prepare data
      const completedAtText = job.completed_at ? formatDate(job.completed_at) : '';
      const startDateText = job.start_date ? formatDate(job.start_date) : 'Not scheduled';
      const endDateText = job.end_date ? formatDate(job.end_date) : '';

      // Title and header
      addText(job.title, 20, true);
      addText(`Status: ${job.status.replace('_', ' ').toUpperCase()}`, 12, false);
      if (completedAtText) {
        addText(`Completed: ${completedAtText}`, 10, false);
      }
      addLine();

      // Client/Provider Information
      checkNewPage();
      addText(isPropertyOwner ? 'Service Provider' : 'Client Information', 14, true);
      if (isPropertyOwner) {
        addText(`Business: ${job.service_provider_profile?.business_name || 'N/A'}`, 10, false);
        addText(`Phone: ${job.service_provider_profile?.business_phone || 'N/A'}`, 10, false);
        addText(`Email: ${job.service_provider_profile?.business_email || 'N/A'}`, 10, false);
      } else {
        const clientName = job.buyer?.full_name || job.property_owner?.full_name || job.appointment?.client_name || 'N/A';
        const clientPhone = job.buyer?.phone_number || job.property_owner?.phone_number || job.appointment?.client_phone || 'N/A';
        const clientEmail = job.buyer?.email || job.property_owner?.email || job.appointment?.client_email || 'N/A';
        addText(`Name: ${clientName}`, 10, false);
        addText(`Phone: ${clientPhone}`, 10, false);
        addText(`Email: ${clientEmail}`, 10, false);
      }
      yPos += 5;
      addLine();

      // Job Details
      checkNewPage();
      addText('Job Details', 14, true);
      addText(`Description: ${job.description || 'No description'}`, 10, false);
      addText(`Location: ${job.location || 'Not specified'}`, 10, false);
      if (job.service_category) {
        addText(`Category: ${job.service_category.name}`, 10, false);
      }
      yPos += 5;
      addLine();

      // Schedule & Cost
      checkNewPage();
      addText('Schedule & Cost', 14, true);
      addText(`Start Date: ${startDateText}`, 10, false);
      if (endDateText) {
        addText(`End Date: ${endDateText}`, 10, false);
      }
      addText(`Estimated Cost: ${job.estimated_cost ? `$${job.estimated_cost.toFixed(2)}` : 'Not provided'}`, 10, false);
      if (job.actual_cost) {
        addText(`Actual Cost: $${job.actual_cost.toFixed(2)}`, 10, true);
      }
      yPos += 5;
      addLine();

      // Work Notes
      if (job.notes) {
        checkNewPage(40);
        addText('Work Notes', 14, true);
        addText(job.notes, 10, false);
        yPos += 5;
        addLine();
      }

      // Materials Used
      if (job.materials_used) {
        checkNewPage(40);
        addText('Materials Used', 14, true);
        addText(job.materials_used, 10, false);
        yPos += 5;
        addLine();
      }

      // Completion Summary
      if (job.completion_notes) {
        checkNewPage(40);
        addText('Completion Summary', 14, true);
        addText(job.completion_notes, 10, false);
        yPos += 5;
        addLine();
      }

      // Invoices
      if (invoices.length > 0) {
        checkNewPage();
        addText('Associated Invoices', 14, true);
        invoices.forEach(invoice => {
          checkNewPage(25);
          addText(`${invoice.invoice_number} - ${invoice.status.toUpperCase()}`, 10, true);
          addText(`Issue: ${new Date(invoice.issue_date).toLocaleDateString()} | Due: ${new Date(invoice.due_date).toLocaleDateString()}`, 9, false);
          addText(`Total: $${invoice.total.toFixed(2)}`, 10, true);
          yPos += 3;
        });
        yPos += 5;
        addLine();
      }

      // Status History
      if (statusHistory.length > 0) {
        checkNewPage();
        addText('Work History', 14, true);
        statusHistory.forEach(history => {
          checkNewPage(20);
          addText(`${history.old_status?.replace('_', ' ') || 'new'} → ${history.new_status.replace('_', ' ')}`, 10, false);
          addText(formatDate(history.changed_at), 9, false);
          yPos += 3;
        });
        yPos += 5;
        addLine();
      }

      // Footer
      checkNewPage();
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, pageWidth / 2, yPos, { align: 'center' });

      // Save the PDF
      pdf.save(`Job-${job.title.replace(/[^a-z0-9]/gi, '-')}-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <p>Loading job details...</p>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <p>Job not found</p>
          <button onClick={onClose} className="mt-4 text-blue-600 hover:underline">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-5xl w-full my-8 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-800">{job.title}</h2>
            <div className="flex items-center gap-3 mt-2">
              {isEditing && !isPropertyOwner ? (
                <select
                  value={editedJob.status}
                  onChange={(e) => setEditedJob({ ...editedJob, status: e.target.value })}
                  className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(editedJob.status || job.status)}`}
                >
                  <option value="pending">Pending</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              ) : (
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                  {job.status.replace('_', ' ').toUpperCase()}
                </span>
              )}
              {job.completed_at && (
                <span className="text-sm text-gray-600 flex items-center">
                  <CheckCircle size={16} className="mr-1" />
                  Completed {new Date(job.completed_at).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 mb-3">
              {isPropertyOwner ? 'Service Provider' : 'Client Information'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {isPropertyOwner ? (
                <>
                  <div>
                    <p className="text-gray-600">Business Name</p>
                    <p className="font-medium">{job.service_provider_profile?.business_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Contact</p>
                    <p className="font-medium">{job.service_provider_profile?.business_phone || 'N/A'}</p>
                    <p className="text-gray-600 text-xs">{job.service_provider_profile?.business_email || 'N/A'}</p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-gray-600">Name</p>
                    <p className="font-medium">{job.buyer?.full_name || job.property_owner?.full_name || job.appointment?.client_name || 'No client'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Contact</p>
                    <p className="font-medium">{job.buyer?.phone_number || job.property_owner?.phone_number || job.appointment?.client_phone || 'N/A'}</p>
                    <p className="text-gray-600 text-xs">{job.buyer?.email || job.property_owner?.email || job.appointment?.client_email || 'N/A'}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
                <Briefcase size={18} className="mr-2" />
                Job Details
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-600">Description</p>
                  <p className="text-gray-800">{job.description}</p>
                </div>
                <div>
                  <p className="text-gray-600">Location</p>
                  <p className="flex items-center text-gray-800">
                    <MapPin size={16} className="mr-1" />
                    {job.location}
                  </p>
                </div>
                {job.service_category && (
                  <div>
                    <p className="text-gray-600">Category</p>
                    <p className="text-gray-800">{job.service_category.name}</p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
                <Calendar size={18} className="mr-2" />
                Schedule & Cost
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-600">Start Date</p>
                  <p className="text-gray-800">
                    {job.start_date ? new Date(job.start_date).toLocaleString() : 'Not scheduled'}
                  </p>
                </div>
                {isEditing && !isPropertyOwner ? (
                  <div>
                    <label className="block text-gray-600 mb-1">End Date</label>
                    <input
                      type="datetime-local"
                      value={editedJob.end_date ? editedJob.end_date.slice(0, 16) : ''}
                      onChange={(e) => setEditedJob({ ...editedJob, end_date: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                ) : job.end_date && (
                  <div>
                    <p className="text-gray-600">End Date</p>
                    <p className="text-gray-800">{formatDate(job.end_date)}</p>
                  </div>
                )}
                <div>
                  <p className="text-gray-600">Estimated Cost</p>
                  <p className="text-gray-800 font-medium">
                    {job.estimated_cost ? `$${job.estimated_cost.toFixed(2)}` : 'Not provided'}
                  </p>
                </div>
                {isEditing && !isPropertyOwner ? (
                  <div>
                    <label className="block text-gray-600 mb-1">Actual Cost</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editedJob.actual_cost || ''}
                      onChange={(e) => setEditedJob({ ...editedJob, actual_cost: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="Final cost"
                    />
                  </div>
                ) : job.actual_cost && (
                  <div>
                    <p className="text-gray-600">Actual Cost</p>
                    <p className="text-gray-800 font-medium text-green-600">
                      ${job.actual_cost.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {(!isPropertyOwner || job.notes) && (
            <div>
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
                <FileText size={18} className="mr-2" />
                Work Notes
              </h3>
              {isEditing && !isPropertyOwner ? (
                <textarea
                  value={editedJob.notes || ''}
                  onChange={(e) => setEditedJob({ ...editedJob, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={4}
                  placeholder="Document work performed, materials used, observations, etc."
                />
              ) : (
                <p className="text-gray-800 bg-gray-50 p-4 rounded-lg whitespace-pre-wrap">
                  {job.notes || 'No work notes yet'}
                </p>
              )}
            </div>
          )}

          {(!isPropertyOwner || job.materials_used) && (
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">Materials Used</h3>
              {isEditing && !isPropertyOwner ? (
                <textarea
                  value={editedJob.materials_used || ''}
                  onChange={(e) => setEditedJob({ ...editedJob, materials_used: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                  placeholder="List materials, parts, or supplies used"
                />
              ) : (
                <p className="text-gray-800 bg-gray-50 p-4 rounded-lg whitespace-pre-wrap">
                  {job.materials_used || 'No materials documented'}
                </p>
              )}
            </div>
          )}

          {(job.status === 'completed' || isEditing) && (!isPropertyOwner || job.completion_notes) && (
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">Completion Summary</h3>
              {isEditing && !isPropertyOwner ? (
                <textarea
                  value={editedJob.completion_notes || ''}
                  onChange={(e) => setEditedJob({ ...editedJob, completion_notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={4}
                  placeholder="Final summary of work completed"
                />
              ) : (
                <p className="text-gray-800 bg-green-50 p-4 rounded-lg whitespace-pre-wrap">
                  {job.completion_notes || 'No completion summary yet'}
                </p>
              )}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800 flex items-center">
                <FileText size={18} className="mr-2" />
                Documents & Attachments
              </h3>
              {!isPropertyOwner && (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload-modal"
                  />
                  <label
                    htmlFor="file-upload-modal"
                    className={`flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition cursor-pointer ${
                      uploadingFile ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <Upload size={16} className="mr-2" />
                    {uploadingFile ? 'Uploading...' : 'Upload Files'}
                  </label>
                </div>
              )}
            </div>
            <div className="space-y-3">
              {attachments.length === 0 ? (
                <div className="text-center py-8 text-gray-600 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <FileText size={40} className="mx-auto text-gray-400 mb-2" />
                  <p className="font-medium">No documents attached</p>
                  <p className="text-sm mt-1">Upload inspection reports, photos, or other relevant documents</p>
                </div>
              ) : (
                attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-blue-300 transition bg-white"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="text-blue-600" size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 truncate text-sm">{attachment.file_name}</p>
                        <p className="text-xs text-gray-600">
                          {formatFileSize(attachment.file_size)} • {new Date(attachment.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleDownloadFile(attachment)}
                        disabled={downloadingFile === attachment.id}
                        className="flex items-center px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition disabled:opacity-50"
                      >
                        <Download size={14} className="mr-1" />
                        {downloadingFile === attachment.id ? 'Downloading...' : 'Download'}
                      </button>
                      {!isPropertyOwner && (
                        <button
                          onClick={() => handleDeleteAttachment(attachment)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800 flex items-center">
                <ImageIcon size={18} className="mr-2" />
                Work Photos
              </h3>
              {!isPropertyOwner && (
                <label className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">
                  <Upload size={18} className="mr-2" />
                  {uploadingPhoto ? 'Uploading...' : 'Upload Photo'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    disabled={uploadingPhoto}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {photos.length === 0 ? (
                <p className="col-span-full text-gray-600 text-center py-8">No photos uploaded yet</p>
              ) : (
                photos.map((photo) => (
                  <div key={photo.id} className="relative group">
                    <img
                      src={photo.photo_url}
                      alt={photo.caption || 'Job photo'}
                      className="w-full h-48 object-cover rounded-lg"
                    />
                    {photo.caption && (
                      <p className="text-xs text-gray-600 mt-1">{photo.caption}</p>
                    )}
                    {!isPropertyOwner && (
                      <button
                        onClick={() => handleDeletePhoto(photo.id, photo.photo_url)}
                        className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {invoices.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
                <Receipt size={18} className="mr-2" />
                Associated Invoices
              </h3>
              <div className="space-y-3">
                {invoices.map((invoice) => (
                  <div key={invoice.id} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <p className="font-medium text-gray-900">{invoice.invoice_number}</p>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            invoice.status === 'paid' ? 'bg-green-100 text-green-700' :
                            invoice.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                            invoice.status === 'overdue' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-2 text-sm text-gray-600">
                          <div>
                            <p className="text-xs text-gray-500">Issue Date</p>
                            <p>{new Date(invoice.issue_date).toLocaleDateString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Due Date</p>
                            <p>{new Date(invoice.due_date).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">
                          ${invoice.total.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
              <Clock size={18} className="mr-2" />
              Work History
            </h3>
            <div className="space-y-3">
              {statusHistory.length === 0 ? (
                <p className="text-gray-600">No status changes recorded</p>
              ) : (
                statusHistory.map((history) => (
                  <div key={history.id} className="flex items-start gap-3 bg-gray-50 p-3 rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm">
                        Status changed from{' '}
                        <span className="font-medium">{history.old_status?.replace('_', ' ') || 'new'}</span>
                        {' to '}
                        <span className="font-medium">{history.new_status.replace('_', ' ')}</span>
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {new Date(history.changed_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-between items-center gap-3">
          <button
            onClick={downloadPDF}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Download size={18} className="mr-2" />
            Download PDF
          </button>
          <div className="flex gap-3">
            {!isPropertyOwner && (
              <>
                {isEditing ? (
                  <>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setEditedJob(job);
                      }}
                      className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Edit Job Details
                  </button>
                )}
              </>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
