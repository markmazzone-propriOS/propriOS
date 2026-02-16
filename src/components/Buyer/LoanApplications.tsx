import { useState, useEffect } from 'react';
import { ArrowLeft, FileText, Clock, DollarSign, Home, Calendar, Upload, AlertCircle, CheckCircle, Send, Trash2, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from '../Navigation/Router';

type LoanApplication = {
  id: string;
  buyer_id: string;
  lender_id: string;
  property_id: string | null;
  application_type: string;
  status: string;
  loan_amount: number;
  loan_type: string;
  property_type?: string | null;
  interest_rate: number | null;
  estimated_closing_date: string | null;
  created_at: string;
  updated_at: string;
  lender_name?: string;
  lender_company?: string;
  property_address?: string;
  proof_of_income?: string;
  proof_of_employment?: string;
  tax_returns?: string;
  bank_statements?: string;
  credit_report?: string;
  purchase_agreement?: string;
};

type ApplicationDocument = {
  id: string;
  application_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  document_type: string;
  description: string;
  uploaded_by: string;
  created_at: string;
};

export function LoanApplications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [selectedApp, setSelectedApp] = useState<LoanApplication | null>(null);
  const [lenderDocuments, setLenderDocuments] = useState<ApplicationDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<{ [key: string]: boolean }>({});
  const [message, setMessage] = useState('');
  const [sendingBack, setSendingBack] = useState(false);

  const getPropertyTypeLabel = (propertyType: string | null | undefined): string => {
    if (!propertyType) return '';
    const labels: { [key: string]: string } = {
      'single_family': 'Single Family Home',
      'condo': 'Condo',
      'townhouse': 'Townhouse',
      'multi_family': 'Multi-Family',
      'manufactured': 'Manufactured/Mobile Home',
      'land': 'Land',
      'commercial': 'Commercial'
    };
    return labels[propertyType] || propertyType.replace(/_/g, ' ');
  };

  useEffect(() => {
    loadApplications();
  }, []);

  useEffect(() => {
    if (selectedApp) {
      loadLenderDocuments(selectedApp.id);
    } else {
      setLenderDocuments([]);
    }
  }, [selectedApp]);

  const loadApplications = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('loan_applications')
        .select(`
          *,
          properties(address_line1, city, state, zip_code)
        `)
        .eq('buyer_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedApps = await Promise.all(
        (data || []).map(async (app: any) => {
          let lenderName = 'Unknown Lender';
          let lenderCompany = '';

          if (app.lender_id) {
            const { data: lenderProfile } = await supabase
              .from('mortgage_lender_profiles')
              .select('company_name')
              .eq('id', app.lender_id)
              .maybeSingle();

            if (lenderProfile) {
              lenderCompany = lenderProfile.company_name || '';
            }

            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', app.lender_id)
              .maybeSingle();

            if (profile?.full_name) {
              lenderName = profile.full_name;
            }
          }

          let propertyDisplay = 'Not specified';
          if (app.properties) {
            propertyDisplay = `${app.properties.address_line1}, ${app.properties.city}, ${app.properties.state}`;
          } else if (app.property_type) {
            propertyDisplay = getPropertyTypeLabel(app.property_type);
          }

          return {
            ...app,
            lender_name: lenderName,
            lender_company: lenderCompany,
            property_address: propertyDisplay
          };
        })
      );

      setApplications(formattedApps);
    } catch (error) {
      console.error('Error loading loan applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLenderDocuments = async (applicationId: string) => {
    try {
      const { data, error } = await supabase
        .from('application_documents')
        .select('*')
        .eq('application_id', applicationId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const documentsWithUrls = await Promise.all(
          data.map(async (doc) => {
            if (doc.storage_path) {
              const { data: urlData } = await supabase.storage
                .from('application-documents')
                .createSignedUrl(doc.storage_path, 3600);
              return { ...doc, file_url: urlData?.signedUrl || null };
            }
            return doc;
          })
        );
        setLenderDocuments(documentsWithUrls);
      }
    } catch (error) {
      console.error('Error loading lender documents:', error);
    }
  };

  const getFieldLabel = (field: string): string => {
    const labels: { [key: string]: string } = {
      'proof_of_income': 'Proof of Income',
      'proof_of_employment': 'Proof of Employment',
      'tax_returns': 'Tax Returns',
      'bank_statements': 'Bank Statements',
      'credit_report': 'Credit Report',
      'purchase_agreement': 'Loan Application'
    };
    return labels[field] || field.replace(/_/g, ' ');
  };

  const handleFileUpload = async (appId: string, field: string, file: File) => {
    console.log('Starting file upload:', { appId, field, fileName: file.name, fileSize: file.size });
    setUploading((prev) => ({ ...prev, [field]: true }));

    try {
      if (!file) {
        throw new Error('No file selected');
      }

      if (file.size > 10 * 1024 * 1024) {
        throw new Error('File size must be less than 10MB');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user!.id}/${appId}/${field}-${Date.now()}.${fileExt}`;

      console.log('Uploading to:', fileName);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('agent-documents')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      console.log('Upload successful:', uploadData);

      const { data: urlData } = supabase.storage
        .from('agent-documents')
        .getPublicUrl(fileName);

      console.log('Public URL:', urlData.publicUrl);

      const { error: updateError } = await supabase
        .from('loan_applications')
        .update({ [field]: urlData.publicUrl })
        .eq('id', appId);

      if (updateError) {
        console.error('Database update error:', updateError);
        throw updateError;
      }

      console.log('Database updated successfully');

      // Reload the selected application details
      if (selectedApp && selectedApp.id === appId) {
        const { data: updatedApp, error: fetchError } = await supabase
          .from('loan_applications')
          .select(`
            *,
            properties(address_line1, city, state, zip_code)
          `)
          .eq('id', appId)
          .maybeSingle();

        if (!fetchError && updatedApp) {
          let lenderName = 'Unknown Lender';
          let lenderCompany = '';

          if (updatedApp.lender_id) {
            const { data: lenderProfile } = await supabase
              .from('mortgage_lender_profiles')
              .select('company_name')
              .eq('id', updatedApp.lender_id)
              .maybeSingle();

            if (lenderProfile) {
              lenderCompany = lenderProfile.company_name || '';
            }

            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', updatedApp.lender_id)
              .maybeSingle();

            if (profile?.full_name) {
              lenderName = profile.full_name;
            }
          }

          const formattedApp = {
            ...updatedApp,
            lender_name: lenderName,
            lender_company: lenderCompany,
            property_address: updatedApp.properties
              ? `${updatedApp.properties.address_line1}, ${updatedApp.properties.city}, ${updatedApp.properties.state}`
              : 'Not specified'
          };

          setSelectedApp(formattedApp);
        }
      }

      await loadApplications();
      alert(`${getFieldLabel(field)} uploaded successfully!`);
    } catch (error: any) {
      console.error(`Error uploading ${field}:`, error);
      alert(`Failed to upload ${getFieldLabel(field)}: ${error.message || 'Unknown error'}`);
    } finally {
      setUploading((prev) => ({ ...prev, [field]: false }));
    }
  };

  const handleFileDelete = async (appId: string, field: string, fileUrl: string) => {
    if (!confirm(`Are you sure you want to delete this ${getFieldLabel(field)}?`)) {
      return;
    }

    setUploading((prev) => ({ ...prev, [field]: true }));

    try {
      const url = new URL(fileUrl);
      const pathMatch = url.pathname.match(/\/agent-documents\/(.+)$/);

      if (pathMatch) {
        const filePath = pathMatch[1];

        const { error: deleteError } = await supabase.storage
          .from('agent-documents')
          .remove([filePath]);

        if (deleteError) {
          console.error('Storage delete error:', deleteError);
        }
      }

      const { error: updateError } = await supabase
        .from('loan_applications')
        .update({ [field]: null })
        .eq('id', appId);

      if (updateError) {
        console.error('Database update error:', updateError);
        throw updateError;
      }

      if (selectedApp && selectedApp.id === appId) {
        const { data: updatedApp, error: fetchError } = await supabase
          .from('loan_applications')
          .select(`
            *,
            properties(address_line1, city, state, zip_code)
          `)
          .eq('id', appId)
          .maybeSingle();

        if (!fetchError && updatedApp) {
          let lenderName = 'Unknown Lender';
          let lenderCompany = '';

          if (updatedApp.lender_id) {
            const { data: lenderProfile } = await supabase
              .from('mortgage_lender_profiles')
              .select('company_name')
              .eq('id', updatedApp.lender_id)
              .maybeSingle();

            if (lenderProfile) {
              lenderCompany = lenderProfile.company_name || '';
            }

            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', updatedApp.lender_id)
              .maybeSingle();

            if (profile?.full_name) {
              lenderName = profile.full_name;
            }
          }

          const formattedApp = {
            ...updatedApp,
            lender_name: lenderName,
            lender_company: lenderCompany,
            property_address: updatedApp.properties
              ? `${updatedApp.properties.address_line1}, ${updatedApp.properties.city}, ${updatedApp.properties.state}`
              : 'Not specified'
          };

          setSelectedApp(formattedApp);
        }
      }

      await loadApplications();
      alert(`${getFieldLabel(field)} deleted successfully!`);
    } catch (error: any) {
      console.error(`Error deleting ${field}:`, error);
      alert(`Failed to delete ${getFieldLabel(field)}: ${error.message || 'Unknown error'}`);
    } finally {
      setUploading((prev) => ({ ...prev, [field]: false }));
    }
  };

  const handleSendBack = async () => {
    if (!selectedApp) return;

    setSendingBack(true);
    try {
      const { error } = await supabase
        .from('loan_applications')
        .update({
          status: 'under_review',
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedApp.id);

      if (error) throw error;

      await supabase.from('activities').insert({
        user_id: selectedApp.lender_id,
        activity_type: 'loan_application_updated',
        title: 'Loan Application Updated',
        description: `${user?.email || 'Buyer'} has updated their loan application and sent it back for review.`,
        metadata: { application_id: selectedApp.id }
      });

      alert('Application sent back to lender successfully!');
      await loadApplications();
      setSelectedApp(null);
    } catch (error) {
      console.error('Error sending application back:', error);
      alert('Failed to send application back');
    } finally {
      setSendingBack(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'denied':
        return 'bg-red-100 text-red-800';
      case 'under_review':
        return 'bg-blue-100 text-blue-800';
      case 'pending_review':
        return 'bg-yellow-100 text-yellow-800';
      case 'documents_requested':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getDocumentFields = () => [
    { key: 'proof_of_income', label: 'Proof of Income' },
    { key: 'proof_of_employment', label: 'Proof of Employment' },
    { key: 'tax_returns', label: 'Tax Returns (Last 2 Years)' },
    { key: 'bank_statements', label: 'Bank Statements' },
    { key: 'credit_report', label: 'Credit Report' },
    { key: 'purchase_agreement', label: 'Loan Application' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading loan applications...</p>
          </div>
        </div>
      </div>
    );
  }

  if (selectedApp) {
    const allDocsUploaded = getDocumentFields().every(
      (field) => selectedApp[field.key as keyof LoanApplication]
    );

    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => setSelectedApp(null)}
            className="flex items-center text-blue-600 hover:text-blue-700 mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to All Applications
          </button>

          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Loan Application</h2>
                <p className="text-gray-600">Submitted on {formatDate(selectedApp.created_at)}</p>
              </div>
              <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(selectedApp.status)}`}>
                {selectedApp.status.replace('_', ' ')}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 pb-6 border-b">
              <div className="flex items-start">
                <DollarSign className="w-5 h-5 text-gray-400 mr-3 mt-1" />
                <div>
                  <p className="text-sm text-gray-600">Loan Amount</p>
                  <p className="text-lg font-semibold text-gray-800">
                    {formatCurrency(selectedApp.loan_amount)}
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <FileText className="w-5 h-5 text-gray-400 mr-3 mt-1" />
                <div>
                  <p className="text-sm text-gray-600">Loan Type</p>
                  <p className="text-lg font-semibold text-gray-800 capitalize">
                    {selectedApp.loan_type}
                  </p>
                </div>
              </div>

              {selectedApp.property_type && (
                <div className="flex items-start">
                  <Home className="w-5 h-5 text-gray-400 mr-3 mt-1" />
                  <div>
                    <p className="text-sm text-gray-600">Property Type</p>
                    <p className="text-lg font-semibold text-gray-800">
                      {getPropertyTypeLabel(selectedApp.property_type)}
                    </p>
                  </div>
                </div>
              )}

              {selectedApp.property_address && (
                <div className="flex items-start">
                  <Home className="w-5 h-5 text-gray-400 mr-3 mt-1" />
                  <div>
                    <p className="text-sm text-gray-600">Property</p>
                    <p className="text-sm text-gray-800">{selectedApp.property_address}</p>
                  </div>
                </div>
              )}

              {selectedApp.estimated_closing_date && (
                <div className="flex items-start">
                  <Calendar className="w-5 h-5 text-gray-400 mr-3 mt-1" />
                  <div>
                    <p className="text-sm text-gray-600">Estimated Closing</p>
                    <p className="text-sm font-semibold text-gray-800">
                      {formatDate(selectedApp.estimated_closing_date)}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-start md:col-span-2">
                <FileText className="w-5 h-5 text-gray-400 mr-3 mt-1" />
                <div>
                  <p className="text-sm text-gray-600">Lender</p>
                  <p className="font-semibold text-gray-800">{selectedApp.lender_name}</p>
                  {selectedApp.lender_company && (
                    <p className="text-sm text-gray-600">{selectedApp.lender_company}</p>
                  )}
                </div>
              </div>
            </div>

            {lenderDocuments.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Documents from Lender</h3>
                <div className="space-y-3">
                  {lenderDocuments.map((doc: any) => (
                    <div key={doc.id} className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center flex-1">
                        <FileText className="w-5 h-5 text-blue-600 mr-3" />
                        <div>
                          <p className="font-medium text-gray-800">{doc.file_name || 'Document'}</p>
                          {doc.description && (
                            <p className="text-sm text-gray-600">{doc.description}</p>
                          )}
                          <p className="text-xs text-gray-500">
                            Uploaded {new Date(doc.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      {doc.file_url ? (
                        <a
                          href={doc.file_url}
                          download={doc.file_name}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          <span>Download</span>
                        </a>
                      ) : (
                        <span className="flex items-center gap-2 px-4 py-2 bg-gray-300 text-gray-600 rounded-lg cursor-not-allowed">
                          <Clock className="w-4 h-4" />
                          <span>Pending Upload</span>
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Required Documents</h3>
              {selectedApp.status === 'documents_requested' && (
                <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mr-3 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800">Documents Requested</p>
                    <p className="text-sm text-yellow-700">Your lender has requested additional documents. Please upload them below.</p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {getDocumentFields().map((field) => {
                  const docUrl = selectedApp[field.key as keyof LoanApplication] as string | undefined;
                  const isUploading = uploading[field.key];

                  return (
                    <div key={field.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center flex-1">
                        <FileText className="w-5 h-5 text-gray-400 mr-3" />
                        <div>
                          <p className="font-medium text-gray-800">{field.label}</p>
                          {docUrl ? (
                            <a
                              href={docUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:text-blue-700"
                            >
                              View uploaded document
                            </a>
                          ) : (
                            <p className="text-sm text-gray-500">Not uploaded</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {docUrl && <CheckCircle className="w-5 h-5 text-green-600" />}
                        {docUrl && (
                          <button
                            onClick={() => handleFileDelete(selectedApp.id, field.key, docUrl)}
                            disabled={isUploading}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                              isUploading
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-red-600 hover:bg-red-700'
                            } text-white`}
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Delete</span>
                          </button>
                        )}
                        <label className={`cursor-pointer ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleFileUpload(selectedApp.id, field.key, file);
                              }
                              e.target.value = '';
                            }}
                            disabled={isUploading}
                          />
                          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                            isUploading
                              ? 'bg-gray-400 cursor-not-allowed'
                              : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
                          } text-white`}>
                            <Upload className="w-4 h-4" />
                            <span>{isUploading ? 'Uploading...' : docUrl ? 'Re-upload' : 'Upload'}</span>
                          </div>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {allDocsUploaded && (selectedApp.status === 'documents_requested' || selectedApp.status === 'pending_review') && (
              <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-600 mr-3 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-800">All Documents Uploaded</p>
                    <p className="text-sm text-green-700">Send your application to the lender for review</p>
                  </div>
                </div>
                <button
                  onClick={handleSendBack}
                  disabled={sendingBack}
                  className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {sendingBack ? 'Sending...' : 'Send to Lender'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center text-blue-600 hover:text-blue-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Loan Applications</h1>
          <p className="text-gray-600">Review and manage loan applications from your lender</p>
        </div>

        {applications.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No Loan Applications</h3>
            <p className="text-gray-600">
              Your lender will send you loan applications when they're ready to process your mortgage.
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            {applications.map((app) => (
              <div
                key={app.id}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setSelectedApp(app)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-gray-800">
                        {formatCurrency(app.loan_amount)} Loan
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(app.status)}`}>
                        {app.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Submitted {formatDate(app.created_at)}
                    </p>
                  </div>
                  {app.status === 'documents_requested' && (
                    <div className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-medium flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      Action Required
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
                  <div>
                    <p className="text-sm text-gray-600">Loan Type</p>
                    <p className="font-medium text-gray-800 capitalize">{app.loan_type}</p>
                  </div>
                  {app.property_type && (
                    <div>
                      <p className="text-sm text-gray-600">Property Type</p>
                      <p className="font-medium text-gray-800">{getPropertyTypeLabel(app.property_type)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-600">Property</p>
                    <p className="font-medium text-gray-800 text-sm">{app.property_address}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Lender</p>
                    <p className="font-medium text-gray-800">{app.lender_name}</p>
                    {app.lender_company && (
                      <p className="text-sm text-gray-600">{app.lender_company}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
