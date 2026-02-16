import { useState, useEffect } from 'react';
import { FileText, Download, Trash2, Eye, Share2, Users, ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from '../Navigation/Router';
import { DocumentSharing } from './DocumentSharing';

interface Document {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  document_type: string;
  description: string | null;
  uploaded_at: string;
  owner_id?: string;
  shared_with_me?: boolean;
  can_download?: boolean;
  is_brokerage_doc?: boolean;
  owner?: {
    full_name: string;
    user_type: string;
  };
  shared_by?: {
    full_name: string;
    user_type: string;
  };
}

interface DocumentListProps {
  refreshTrigger: number;
}

export function DocumentList({ refreshTrigger }: DocumentListProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sharingDoc, setSharingDoc] = useState<{ id: string; name: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'my' | 'shared'>('my');

  useEffect(() => {
    if (user) {
      loadDocuments();
    }
  }, [user, refreshTrigger]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const { data: myDocs, error: myError } = await supabase
        .from('documents')
        .select('*')
        .eq('owner_id', user!.id)
        .order('uploaded_at', { ascending: false });

      if (myError) throw myError;

      // Load documents that are accessible but not owned
      // This includes: documents shared via document_shares AND documents owned by assigned clients
      const { data: accessibleDocs, error: accessibleError } = await supabase
        .from('documents')
        .select(`
          *,
          owner:profiles!documents_owner_id_fkey(full_name, user_type)
        `)
        .neq('owner_id', user!.id)
        .order('uploaded_at', { ascending: false });

      if (accessibleError) throw accessibleError;

      // For each accessible document, check if it's explicitly shared to determine can_download and shared_by
      const accessibleDocsWithPerms = await Promise.all(
        (accessibleDocs || []).map(async (doc) => {
          const { data: shareData } = await supabase
            .from('document_shares')
            .select('can_download, shared_by, sharer:profiles!document_shares_shared_by_fkey(full_name, user_type)')
            .eq('document_id', doc.id)
            .eq('shared_with', user!.id)
            .maybeSingle();

          return {
            ...doc,
            shared_with_me: true,
            can_download: shareData?.can_download ?? true, // Default to true for client documents
            shared_by: shareData?.sharer ? {
              full_name: (shareData.sharer as any).full_name,
              user_type: (shareData.sharer as any).user_type
            } : undefined
          };
        })
      );

      // Load brokerage documents shared with this agent
      const { data: brokerageAgent } = await supabase
        .from('brokerage_agents')
        .select('brokerage_id, brokerage:brokerages(company_name)')
        .eq('agent_id', user!.id)
        .eq('status', 'active')
        .maybeSingle();

      let brokerageDocs: any[] = [];
      if (brokerageAgent) {
        const { data: brokerageDocsData } = await supabase
          .from('brokerage_documents')
          .select('*')
          .eq('brokerage_id', brokerageAgent.brokerage_id)
          .order('uploaded_at', { ascending: false });

        if (brokerageDocsData) {
          const brokerageDocsWithShares = await Promise.all(
            brokerageDocsData.map(async (doc) => {
              const { data: shareData } = await supabase
                .from('brokerage_document_shares')
                .select('agent_id')
                .eq('document_id', doc.id);

              const isSharedWithMe = shareData && shareData.some(share =>
                share.agent_id === user!.id || share.agent_id === null
              );

              if (isSharedWithMe) {
                return {
                  ...doc,
                  shared_with_me: true,
                  can_download: true,
                  is_brokerage_doc: true,
                  owner: {
                    full_name: (brokerageAgent.brokerage as any)?.company_name || 'Brokerage',
                    user_type: 'brokerage'
                  }
                };
              }
              return null;
            })
          );
          brokerageDocs = brokerageDocsWithShares.filter(doc => doc !== null);
        }
      }

      const myDocsWithFlag = (myDocs || []).map(doc => ({ ...doc, shared_with_me: false }));

      setDocuments([...myDocsWithFlag, ...accessibleDocsWithPerms, ...brokerageDocs]);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (doc: Document) => {
    try {
      const bucket = doc.is_brokerage_doc ? 'brokerage-documents' : 'agent-documents';
      const { data, error } = await supabase.storage
        .from(bucket)
        .download(doc.storage_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
      alert('Failed to download document');
    }
  };

  const handleView = async (doc: Document) => {
    try {
      const bucket = doc.is_brokerage_doc ? 'brokerage-documents' : 'agent-documents';
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(doc.storage_path, 3600);

      if (error) throw error;

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      console.error('Error viewing document:', error);
      alert('Failed to view document');
    }
  };

  const handleDelete = async (doc: Document) => {
    if (!confirm(`Are you sure you want to delete "${doc.file_name}"?`)) {
      return;
    }

    setDeletingId(doc.id);
    try {
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', doc.id);

      if (dbError) throw dbError;

      await supabase.storage
        .from('agent-documents')
        .remove([doc.storage_path]);

      await loadDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Failed to delete document');
    } finally {
      setDeletingId(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      license: 'License',
      certification: 'Certification',
      contract: 'Contract',
      identification: 'Identification',
      insurance: 'Insurance',
      inspection: 'Inspection',
      appraisal: 'Appraisal',
      disclosure: 'Disclosure',
      offer: 'Offer',
      other: 'Other',
      policy: 'Policy',
      form: 'Form',
      training: 'Training',
      resource: 'Resource',
      template: 'Template',
      compliance: 'Compliance',
    };
    return labels[type] || type;
  };

  const getDocumentTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      license: 'bg-blue-100 text-blue-700',
      certification: 'bg-green-100 text-green-700',
      contract: 'bg-purple-100 text-purple-700',
      identification: 'bg-yellow-100 text-yellow-700',
      insurance: 'bg-red-100 text-red-700',
      inspection: 'bg-orange-100 text-orange-700',
      appraisal: 'bg-teal-100 text-teal-700',
      disclosure: 'bg-pink-100 text-pink-700',
      offer: 'bg-cyan-100 text-cyan-700',
      other: 'bg-gray-100 text-gray-700',
      policy: 'bg-slate-100 text-slate-700',
      form: 'bg-blue-100 text-blue-700',
      training: 'bg-green-100 text-green-700',
      resource: 'bg-amber-100 text-amber-700',
      template: 'bg-sky-100 text-sky-700',
      compliance: 'bg-red-100 text-red-700',
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  const myDocuments = documents.filter(doc => !doc.shared_with_me);
  const sharedDocuments = documents.filter(doc => doc.shared_with_me);
  const displayDocuments = activeTab === 'my' ? myDocuments : sharedDocuments;

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading documents...</p>
        </div>
      </div>
    );
  }


  return (
    <>
      {sharingDoc && (
        <DocumentSharing
          documentId={sharingDoc.id}
          documentName={sharingDoc.name}
          onClose={() => {
            setSharingDoc(null);
            loadDocuments();
          }}
        />
      )}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b">
          <div className="p-6 pb-0">
            <div className="flex items-center gap-4 mb-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="text-gray-600 hover:text-blue-600 transition"
                title="Back"
              >
                <ArrowLeft size={24} />
              </button>
              <h3 className="text-lg font-semibold text-gray-800">Documents</h3>
            </div>
          </div>
          <div className="flex px-6">
            <button
              onClick={() => setActiveTab('my')}
              className={`px-4 py-3 font-medium border-b-2 transition ${
                activeTab === 'my'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              Documents & Data Room ({myDocuments.length})
            </button>
            <button
              onClick={() => setActiveTab('shared')}
              className={`px-4 py-3 font-medium border-b-2 transition ${
                activeTab === 'shared'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              Shared with Me ({sharedDocuments.length})
            </button>
          </div>
        </div>

        {displayDocuments.length === 0 ? (
          <div className="p-6 text-center py-12">
            <FileText className="mx-auto text-gray-400 mb-3" size={48} />
            <p className="text-gray-600">
              {activeTab === 'my' ? 'No documents uploaded yet' : 'No documents shared with you'}
            </p>
            {activeTab === 'my' && (
              <p className="text-sm text-gray-500 mt-1">Upload your first document to get started</p>
            )}
          </div>
        ) : (
          <div className="divide-y">
            {displayDocuments.map((doc) => (
              <div key={doc.id} className="p-6 hover:bg-gray-50 transition">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <FileText className="text-gray-400 flex-shrink-0 mt-1" size={24} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-800 truncate">{doc.file_name}</h4>
                        {doc.shared_with_me && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium flex items-center gap-1">
                            <Users size={12} />
                            Shared
                          </span>
                        )}
                      </div>
                      {doc.description && (
                        <p className="text-sm text-gray-600 mt-1">{doc.description}</p>
                      )}
                      {doc.shared_with_me && (
                        <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                          {doc.shared_by && (
                            <p>
                              Shared by {doc.shared_by.full_name} ({doc.shared_by.user_type})
                            </p>
                          )}
                          {doc.owner && (
                            <p>
                              Owned by {doc.owner.full_name} ({doc.owner.user_type})
                            </p>
                          )}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-3 mt-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getDocumentTypeColor(doc.document_type)}`}>
                          {getDocumentTypeLabel(doc.document_type)}
                        </span>
                        <span className="text-xs text-gray-500">{formatFileSize(doc.file_size)}</span>
                        <span className="text-xs text-gray-500">{formatDate(doc.uploaded_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleView(doc)}
                      className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                      title="View"
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      onClick={() => handleDownload(doc)}
                      disabled={doc.shared_with_me && !doc.can_download}
                      className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
                      title={doc.shared_with_me && !doc.can_download ? 'Download not allowed' : 'Download'}
                    >
                      <Download size={18} />
                    </button>
                    {!doc.shared_with_me && (
                      <>
                        <button
                          onClick={() => setSharingDoc({ id: doc.id, name: doc.file_name })}
                          className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded transition"
                          title="Share"
                        >
                          <Share2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(doc)}
                          disabled={deletingId === doc.id}
                          className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition disabled:opacity-50"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
