import { useState, useEffect } from 'react';
import { Upload, FileText, Trash2, Share2, X, Users, Check, Download, Search, Filter } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type BrokerageDocument = {
  id: string;
  brokerage_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  document_type: string;
  description: string | null;
  uploaded_by: string;
  uploaded_at: string;
  shares?: {
    id: string;
    agent_id: string | null;
    shared_at: string;
    agent?: {
      id: string;
      full_name: string;
    };
  }[];
};

type Agent = {
  agent_id: string;
  profile: {
    full_name: string;
  };
};

type BrokerageDocumentManagementProps = {
  brokerageId: string;
};

export function BrokerageDocumentManagement({ brokerageId }: BrokerageDocumentManagementProps) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<BrokerageDocument[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<BrokerageDocument | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDocType, setUploadDocType] = useState('policy');
  const [uploadDescription, setUploadDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  const documentTypes = [
    { value: 'policy', label: 'Policy' },
    { value: 'form', label: 'Form' },
    { value: 'contract', label: 'Contract' },
    { value: 'training', label: 'Training' },
    { value: 'resource', label: 'Resource' },
    { value: 'template', label: 'Template' },
    { value: 'compliance', label: 'Compliance' },
    { value: 'other', label: 'Other' }
  ];

  useEffect(() => {
    loadDocuments();
    loadAgents();
  }, [brokerageId]);

  const loadDocuments = async () => {
    try {
      const { data: docsData, error: docsError } = await supabase
        .from('brokerage_documents')
        .select('*')
        .eq('brokerage_id', brokerageId)
        .order('uploaded_at', { ascending: false });

      if (docsError) throw docsError;

      const documentsWithShares = await Promise.all(
        (docsData || []).map(async (doc) => {
          const { data: sharesData } = await supabase
            .from('brokerage_document_shares')
            .select('id, agent_id, shared_at')
            .eq('document_id', doc.id);

          const sharesWithProfiles = await Promise.all(
            (sharesData || []).map(async (share) => {
              if (share.agent_id) {
                const { data: profileData } = await supabase
                  .from('profiles')
                  .select('id, full_name')
                  .eq('id', share.agent_id)
                  .maybeSingle();

                return {
                  ...share,
                  agent: profileData
                };
              }
              return share;
            })
          );

          return {
            ...doc,
            shares: sharesWithProfiles
          };
        })
      );

      setDocuments(documentsWithShares);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAgents = async () => {
    try {
      const { data, error } = await supabase
        .from('brokerage_agents')
        .select(`
          agent_id,
          profile:profiles!brokerage_agents_agent_id_fkey(
            full_name
          )
        `)
        .eq('brokerage_id', brokerageId)
        .eq('status', 'active');

      if (error) throw error;
      setAgents(data || []);
    } catch (error) {
      console.error('Error loading agents:', error);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploadFile(files[0]);
    setShowUploadModal(true);
    event.target.value = '';
  };

  const handleUploadSubmit = async () => {
    if (!uploadFile || !user) return;

    setUploading(true);

    try {
      const fileExt = uploadFile.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${brokerageId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('brokerage-documents')
        .upload(filePath, uploadFile);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from('brokerage_documents')
        .insert({
          brokerage_id: brokerageId,
          file_name: uploadFile.name,
          file_type: uploadFile.type,
          file_size: uploadFile.size,
          storage_path: filePath,
          document_type: uploadDocType,
          description: uploadDescription || null,
          uploaded_by: user.id
        });

      if (dbError) throw dbError;

      await loadDocuments();
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadDescription('');
      setUploadDocType('policy');
      alert('Document uploaded successfully!');
    } catch (error: any) {
      console.error('Error uploading document:', error);
      alert(error.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (documentId: string, storagePath: string) => {
    if (!confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      return;
    }

    try {
      const { error: storageError } = await supabase.storage
        .from('brokerage-documents')
        .remove([storagePath]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('brokerage_documents')
        .delete()
        .eq('id', documentId);

      if (dbError) throw dbError;

      setDocuments(documents.filter(doc => doc.id !== documentId));
    } catch (error: any) {
      console.error('Error deleting document:', error);
      alert(error.message || 'Failed to delete document');
    }
  };

  const handleDownloadDocument = async (storagePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('brokerage-documents')
        .download(storagePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error downloading document:', error);
      alert(error.message || 'Failed to download document');
    }
  };

  const openShareModal = (document: BrokerageDocument) => {
    setSelectedDocument(document);
    setShowShareModal(true);
  };

  const handleShareWithAll = async () => {
    if (!selectedDocument || !user) return;

    const hasAllShare = selectedDocument.shares?.some(share => share.agent_id === null);

    if (hasAllShare) {
      if (!confirm('This document is already shared with all agents. Do you want to remove this share?')) {
        return;
      }

      const shareToDelete = selectedDocument.shares?.find(share => share.agent_id === null);
      if (shareToDelete) {
        const { error } = await supabase
          .from('brokerage_document_shares')
          .delete()
          .eq('id', shareToDelete.id);

        if (error) {
          console.error('Error removing share:', error);
          alert('Failed to remove share');
          return;
        }

        setSelectedDocument({
          ...selectedDocument,
          shares: selectedDocument.shares?.filter(s => s.id !== shareToDelete.id)
        });
      }
    } else {
      const { data, error } = await supabase
        .from('brokerage_document_shares')
        .insert({
          document_id: selectedDocument.id,
          agent_id: null,
          shared_by: user.id
        })
        .select('id, agent_id, shared_at')
        .single();

      if (error) {
        console.error('Error sharing document:', error);
        alert('Failed to share document');
        return;
      }

      setSelectedDocument({
        ...selectedDocument,
        shares: [...(selectedDocument.shares || []), data]
      });
    }

    await loadDocuments();
  };

  const handleShareWithAgent = async (agentId: string) => {
    if (!selectedDocument || !user) return;

    const hasShare = selectedDocument.shares?.some(share => share.agent_id === agentId);

    if (hasShare) {
      const shareToDelete = selectedDocument.shares?.find(share => share.agent_id === agentId);
      if (shareToDelete) {
        const { error } = await supabase
          .from('brokerage_document_shares')
          .delete()
          .eq('id', shareToDelete.id);

        if (error) {
          console.error('Error removing share:', error);
          return;
        }

        setSelectedDocument({
          ...selectedDocument,
          shares: selectedDocument.shares?.filter(s => s.id !== shareToDelete.id)
        });
      }
    } else {
      const { data, error } = await supabase
        .from('brokerage_document_shares')
        .insert({
          document_id: selectedDocument.id,
          agent_id: agentId,
          shared_by: user.id
        })
        .select('id, agent_id, shared_at')
        .single();

      if (error) {
        console.error('Error sharing document:', error);
        return;
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('id', agentId)
        .maybeSingle();

      const newShare = {
        ...data,
        agent: profileData
      };

      setSelectedDocument({
        ...selectedDocument,
        shares: [...(selectedDocument.shares || []), newShare]
      });
    }

    await loadDocuments();
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (doc.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesFilter = filterType === 'all' || doc.document_type === filterType;
    return matchesSearch && matchesFilter;
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getSharedWithText = (doc: BrokerageDocument) => {
    if (!doc.shares || doc.shares.length === 0) return 'Not shared';

    const hasAllShare = doc.shares.some(share => share.agent_id === null);
    if (hasAllShare) return 'All agents';

    const agentShares = doc.shares.filter(share => share.agent_id !== null);
    if (agentShares.length === 1) return `1 agent`;
    return `${agentShares.length} agents`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex items-center gap-4 ml-4">
          <div className="flex items-center gap-2">
            <Filter size={20} className="text-gray-600" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              {documentTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition cursor-pointer font-medium">
            <Upload size={20} />
            Upload Document
            <input
              type="file"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {filteredDocuments.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <FileText className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-gray-800 mb-2">No Documents</h3>
          <p className="text-gray-600 mb-4">
            {searchQuery || filterType !== 'all'
              ? 'No documents match your search criteria'
              : 'Upload documents to share with your agents'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDocuments.map((document) => (
            <div
              key={document.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div className="bg-blue-100 rounded-lg p-3">
                    <FileText className="text-blue-600" size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-800 mb-1 truncate">{document.file_name}</h3>
                    {document.description && (
                      <p className="text-sm text-gray-600 mb-2">{document.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="px-2 py-1 bg-gray-100 rounded-full text-xs font-medium">
                        {documentTypes.find(t => t.value === document.document_type)?.label}
                      </span>
                      <span>{formatFileSize(document.file_size)}</span>
                      <span>{new Date(document.uploaded_at).toLocaleDateString()}</span>
                      <span className="flex items-center gap-1">
                        <Users size={14} />
                        {getSharedWithText(document)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleDownloadDocument(document.storage_path, document.file_name)}
                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title="Download"
                  >
                    <Download size={20} />
                  </button>
                  <button
                    onClick={() => openShareModal(document)}
                    className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition"
                    title="Share with agents"
                  >
                    <Share2 size={20} />
                  </button>
                  <button
                    onClick={() => handleDeleteDocument(document.id, document.storage_path)}
                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Delete"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showUploadModal && uploadFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800">Upload Document</h2>
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadFile(null);
                    setUploadDescription('');
                    setUploadDocType('policy');
                  }}
                  className="text-gray-400 hover:text-gray-600 transition"
                  disabled={uploading}
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  File
                </label>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <FileText className="text-gray-400" size={24} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">{uploadFile.name}</p>
                    <p className="text-sm text-gray-500">
                      {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Document Type
                </label>
                <select
                  value={uploadDocType}
                  onChange={(e) => setUploadDocType(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={uploading}
                >
                  {documentTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Add a description for this document..."
                  disabled={uploading}
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50 flex gap-3">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadFile(null);
                  setUploadDescription('');
                  setUploadDocType('policy');
                }}
                className="flex-1 bg-white text-gray-700 border border-gray-300 py-3 rounded-lg hover:bg-gray-50 transition font-medium"
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                onClick={handleUploadSubmit}
                disabled={uploading}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showShareModal && selectedDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Share Document</h2>
                  <p className="text-gray-600 mt-1">{selectedDocument.file_name}</p>
                </div>
                <button
                  onClick={() => {
                    setShowShareModal(false);
                    setSelectedDocument(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-6">
                <button
                  onClick={handleShareWithAll}
                  className={`w-full flex items-center justify-between p-4 border-2 rounded-lg transition ${
                    selectedDocument.shares?.some(share => share.agent_id === null)
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-blue-500 hover:bg-blue-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Users className="text-gray-600" size={24} />
                    <div className="text-left">
                      <div className="font-semibold text-gray-800">All Agents</div>
                      <div className="text-sm text-gray-600">Share with all agents in your brokerage</div>
                    </div>
                  </div>
                  {selectedDocument.shares?.some(share => share.agent_id === null) && (
                    <Check className="text-green-600" size={24} />
                  )}
                </button>
              </div>

              <div className="mb-4">
                <h3 className="font-semibold text-gray-800 mb-3">Share with Specific Agents</h3>
                <div className="space-y-2">
                  {agents.length === 0 ? (
                    <p className="text-gray-600 text-center py-4">No agents in your brokerage yet</p>
                  ) : (
                    agents.map((agent) => {
                      const isShared = selectedDocument.shares?.some(share => share.agent_id === agent.agent_id);
                      return (
                        <button
                          key={agent.agent_id}
                          onClick={() => handleShareWithAgent(agent.agent_id)}
                          className={`w-full flex items-center justify-between p-3 border rounded-lg transition ${
                            isShared
                              ? 'border-green-500 bg-green-50'
                              : 'border-gray-200 hover:border-blue-500 hover:bg-blue-50'
                          }`}
                        >
                          <span className="font-medium text-gray-800">{agent.profile.full_name}</span>
                          {isShared && <Check className="text-green-600" size={20} />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setShowShareModal(false);
                  setSelectedDocument(null);
                }}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
