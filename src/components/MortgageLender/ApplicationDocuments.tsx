import { useState, useEffect } from 'react';
import { FileText, Upload, CheckCircle, XCircle, Clock, Trash2, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type ApplicationDocument = {
  id: string;
  application_id: string;
  document_name: string;
  document_type: string;
  file_url: string | null;
  status: string;
  required: boolean;
  uploaded_at: string | null;
  reviewed_at: string | null;
  notes: string | null;
};

const REQUIRED_DOCUMENTS = [
  { name: 'Proof of Income', type: 'proof_of_income', field: 'proof_of_income' },
  { name: 'Proof of Employment', type: 'proof_of_employment', field: 'proof_of_employment' },
  { name: 'Tax Returns', type: 'tax_returns', field: 'tax_returns' },
  { name: 'Bank Statements', type: 'bank_statements', field: 'bank_statements' },
  { name: 'Credit Report', type: 'credit_report', field: 'credit_report' },
  { name: 'Loan Application', type: 'purchase_agreement', field: 'purchase_agreement' },
];

export function ApplicationDocuments({ applicationId }: { applicationId: string }) {
  const { user } = useAuth();
  const [buyerDocuments, setBuyerDocuments] = useState<any[]>([]);
  const [lenderDocuments, setLenderDocuments] = useState<ApplicationDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAllDocuments();
  }, [applicationId]);

  const loadAllDocuments = async () => {
    setLoading(true);
    try {
      // Load buyer-uploaded documents from loan_applications table
      const { data: application } = await supabase
        .from('loan_applications')
        .select('proof_of_income, proof_of_employment, tax_returns, bank_statements, credit_report, purchase_agreement')
        .eq('id', applicationId)
        .maybeSingle();

      if (application) {
        const buyerDocs = REQUIRED_DOCUMENTS.map(doc => ({
          id: doc.type,
          document_name: doc.name,
          document_type: doc.type,
          file_url: application[doc.field as keyof typeof application] as string | null,
          status: application[doc.field as keyof typeof application] ? 'received' : 'pending',
          required: true,
          uploaded_at: application[doc.field as keyof typeof application] ? new Date().toISOString() : null,
          reviewed_at: null,
          notes: null,
          source: 'buyer'
        }));
        setBuyerDocuments(buyerDocs);
      }

      // Load lender-uploaded documents from application_documents table (only those with actual files)
      const { data: lenderDocs, error: lenderError } = await supabase
        .from('application_documents')
        .select('*')
        .eq('application_id', applicationId)
        .not('storage_path', 'is', null)
        .order('created_at', { ascending: true });

      if (lenderError) throw lenderError;
      setLenderDocuments(lenderDocs || []);
    } catch (err) {
      console.error('Error loading documents:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (documentType: string, file: File, source: 'buyer' | 'lender') => {
    setUploading(true);
    setError('');

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${applicationId}/${documentType}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('application-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('application-documents')
        .getPublicUrl(fileName);

      if (source === 'buyer') {
        // Update the loan_applications table for buyer documents
        const docConfig = REQUIRED_DOCUMENTS.find(d => d.type === documentType);
        if (docConfig?.field) {
          await supabase
            .from('loan_applications')
            .update({ [docConfig.field]: urlData.publicUrl })
            .eq('id', applicationId);
        }
      }

      loadAllDocuments();
    } catch (err: any) {
      setError(err.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const deleteDocument = async (documentType: string, fileUrl: string | null, source: 'buyer' | 'lender') => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      if (fileUrl) {
        const path = fileUrl.split('/application-documents/')[1];
        if (path) {
          await supabase.storage
            .from('application-documents')
            .remove([path]);
        }
      }

      if (source === 'buyer') {
        // Clear the field in loan_applications
        const docConfig = REQUIRED_DOCUMENTS.find(d => d.type === documentType);
        if (docConfig?.field) {
          await supabase
            .from('loan_applications')
            .update({ [docConfig.field]: null })
            .eq('id', applicationId);
        }
      }

      loadAllDocuments();
    } catch (err) {
      console.error('Error deleting document:', err);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle size={20} className="text-green-600" />;
      case 'rejected':
        return <XCircle size={20} className="text-red-600" />;
      case 'received':
        return <Clock size={20} className="text-blue-600" />;
      default:
        return <FileText size={20} className="text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'received':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-2 text-gray-600">Loading documents...</p>
      </div>
    );
  }

  const uploadedBuyerDocs = buyerDocuments.filter(d => d.status === 'received');
  const progressPercent = buyerDocuments.length > 0
    ? Math.round((uploadedBuyerDocs.length / buyerDocuments.length) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-blue-900">Buyer Document Completion</span>
          <span className="text-sm font-bold text-blue-900">{progressPercent}%</span>
        </div>
        <div className="w-full bg-blue-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="text-xs text-blue-700 mt-2">
          {uploadedBuyerDocs.length} of {buyerDocuments.length} required documents uploaded
        </p>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Buyer Documents</h3>
        <p className="text-sm text-gray-600 mb-4">Documents uploaded by the buyer</p>
        <div className="space-y-3">
          {buyerDocuments.map((doc) => (
            <div
              key={doc.id}
              className="bg-white border border-gray-200 rounded-lg p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 flex-1">
                  {getStatusIcon(doc.status)}
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-800">{doc.document_name}</h4>
                    {doc.file_url && (
                      <p className="text-xs text-gray-500">
                        Uploaded by buyer
                      </p>
                    )}
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(doc.status)}`}>
                  {doc.status.replace('_', ' ')}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {!doc.file_url ? (
                  <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer transition">
                    <Upload size={16} />
                    <span>Upload on behalf of buyer</span>
                    <input
                      type="file"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(doc.document_type, file, 'buyer');
                      }}
                      className="hidden"
                      disabled={uploading}
                    />
                  </label>
                ) : (
                  <>
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition"
                    >
                      <Download size={16} />
                      <span>View</span>
                    </a>
                    <button
                      onClick={() => deleteDocument(doc.document_type, doc.file_url, 'buyer')}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-md transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {lenderDocuments.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Lender Documents</h3>
          <p className="text-sm text-gray-600 mb-4">Documents you uploaded for the buyer</p>
          <div className="space-y-3">
            {lenderDocuments.map((doc) => (
              <div
                key={doc.id}
                className="bg-white border border-gray-200 rounded-lg p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText size={20} className="text-blue-600" />
                    <div>
                      <span className="font-medium text-gray-800">{doc.file_name || doc.document_type}</span>
                      {doc.description && (
                        <p className="text-xs text-gray-500">{doc.description}</p>
                      )}
                    </div>
                  </div>
                  {doc.storage_path && (
                    <a
                      href={`${supabase.storage.from('application-documents').getPublicUrl(doc.storage_path).data.publicUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                    >
                      <Download size={16} />
                      View
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
