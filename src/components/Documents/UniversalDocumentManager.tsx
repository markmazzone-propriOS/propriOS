import { useState, useEffect } from 'react';
import {
  Upload,
  File,
  FileText,
  Download,
  Trash2,
  FolderPlus,
  Folder,
  Search,
  X,
  ChevronRight,
  Edit2,
  Tag,
  Eye,
  ArrowLeft,
  ClipboardList
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from '../Navigation/Router';
import { DocumentChecklistManager } from '../Agents/DocumentChecklistManager';

type Document = {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  document_type: string;
  description: string | null;
  uploaded_at: string;
  folder_id: string | null;
  agent_id?: string | null;
  owner_id?: string | null;
  service_provider_id?: string | null;
  shared_with_me?: boolean;
  can_download?: boolean;
};

type Folder = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  owner_id: string;
};

export function UniversalDocumentManager() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'documents' | 'checklists'>('documents');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDescription, setNewFolderDescription] = useState('');
  const [editDocumentType, setEditDocumentType] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadDocumentType, setUploadDocumentType] = useState('Other');
  const [uploadDescription, setUploadDescription] = useState('');
  const [error, setError] = useState('');

  const documentTypes = [
    'License',
    'Insurance',
    'Certification',
    'Contract',
    'Invoice',
    'Inspection',
    'Work Photo',
    'Identification',
    'Appraisal',
    'Disclosure',
    'Offer',
    'Other'
  ];

  useEffect(() => {
    loadDocuments();
    loadFolders();
  }, [user, selectedFolder]);

  const loadDocuments = async () => {
    if (!user) return;

    try {
      // Load owned documents
      let ownedQuery = supabase
        .from('documents')
        .select('*')
        .eq('owner_id', user.id)
        .order('uploaded_at', { ascending: false });

      if (selectedFolder) {
        ownedQuery = ownedQuery.eq('folder_id', selectedFolder);
      } else {
        ownedQuery = ownedQuery.is('folder_id', null);
      }

      const { data: ownedDocs, error: ownedError } = await ownedQuery;
      if (ownedError) throw ownedError;

      // Load documents that are accessible but not owned
      // This includes: documents shared via document_shares AND documents owned by assigned clients
      const { data: accessibleDocs, error: accessibleError } = await supabase
        .from('documents')
        .select('*')
        .neq('owner_id', user.id)
        .order('uploaded_at', { ascending: false });

      if (accessibleError) throw accessibleError;

      // For each accessible document, check if it's explicitly shared to determine can_download
      const accessibleDocsWithPerms = await Promise.all(
        (accessibleDocs || []).map(async (doc) => {
          const { data: shareData } = await supabase
            .from('document_shares')
            .select('can_download')
            .eq('document_id', doc.id)
            .eq('shared_with', user.id)
            .maybeSingle();

          return {
            ...doc,
            shared_with_me: true,
            can_download: shareData?.can_download ?? true // Default to true for client documents
          };
        })
      );

      // Combine both lists
      const allDocs = [
        ...(ownedDocs || []).map(doc => ({ ...doc, shared_with_me: false })),
        ...accessibleDocsWithPerms
      ];

      setDocuments(allDocs);
    } catch (err: any) {
      console.error('Error loading documents:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadFolders = async () => {
    if (!user) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('document_folders')
        .select('*')
        .eq('owner_id', user.id)
        .order('name');

      if (fetchError) throw fetchError;
      setFolders(data || []);
    } catch (err: any) {
      console.error('Error loading folders:', err);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const oversizedFiles = fileArray.filter(f => f.size > 10 * 1024 * 1024);

    if (oversizedFiles.length > 0) {
      setError(`The following files are too large (max 10MB): ${oversizedFiles.map(f => f.name).join(', ')}`);
      e.target.value = '';
      return;
    }

    setUploadFiles(fileArray);
    setUploadDocumentType('Other');
    setUploadDescription('');
    setShowUploadModal(true);
    e.target.value = '';
  };

  const handleUploadConfirm = async () => {
    if (!user || uploadFiles.length === 0) return;

    setUploading(true);
    setError('');

    try {
      for (const file of uploadFiles) {
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
            document_type: uploadDocumentType,
            description: uploadDescription || null,
            folder_id: selectedFolder,
          });

        if (dbError) throw dbError;
      }

      setShowUploadModal(false);
      setUploadFiles([]);
      setUploadDocumentType('Other');
      setUploadDescription('');
      await loadDocuments();
    } catch (err: any) {
      setError(err.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleView = async (doc: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from('agent-documents')
        .download(doc.storage_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      window.open(url, '_blank');
    } catch (err: any) {
      setError(err.message || 'Failed to view document');
    }
  };

  const handleDownload = async (doc: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from('agent-documents')
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
    } catch (err: any) {
      setError(err.message || 'Failed to download document');
    }
  };

  const handleDelete = async (docId: string, storagePath: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      const { error: storageError } = await supabase.storage
        .from('agent-documents')
        .remove([storagePath]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', docId);

      if (dbError) throw dbError;

      setDocuments(documents.filter(d => d.id !== docId));
    } catch (err: any) {
      setError(err.message || 'Failed to delete document');
    }
  };

  const handleEditDocument = async () => {
    if (!editingDocument) return;

    try {
      const { error } = await supabase
        .from('documents')
        .update({
          document_type: editDocumentType,
          description: editDescription || null,
        })
        .eq('id', editingDocument.id);

      if (error) throw error;

      setShowEditModal(false);
      setEditingDocument(null);
      await loadDocuments();
    } catch (err: any) {
      setError(err.message || 'Failed to update document');
    }
  };

  const openEditModal = (doc: Document) => {
    setEditingDocument(doc);
    setEditDocumentType(doc.document_type);
    setEditDescription(doc.description || '');
    setShowEditModal(true);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !user) return;

    try {
      const { error } = await supabase
        .from('document_folders')
        .insert({
          owner_id: user.id,
          name: newFolderName.trim(),
          description: newFolderDescription.trim() || null,
        });

      if (error) throw error;

      setNewFolderName('');
      setNewFolderDescription('');
      setShowNewFolderModal(false);
      await loadFolders();
    } catch (err: any) {
      setError(err.message || 'Failed to create folder');
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm('Delete this folder? Documents inside will be moved to the root level.')) return;

    try {
      await supabase
        .from('documents')
        .update({ folder_id: null })
        .eq('folder_id', folderId);

      const { error } = await supabase
        .from('document_folders')
        .delete()
        .eq('id', folderId);

      if (error) throw error;

      setSelectedFolder(null);
      await loadFolders();
      await loadDocuments();
    } catch (err: any) {
      setError(err.message || 'Failed to delete folder');
    }
  };

  const filteredDocuments = documents.filter(doc =>
    doc.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.document_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (doc.description && doc.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-4"
        >
          <ArrowLeft size={20} />
          Back to Dashboard
        </button>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Document Management</h1>
        <p className="text-gray-600">Organize and manage your documents with folders and labels</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-700 hover:text-red-900">
            <X size={20} />
          </button>
        </div>
      )}

      {profile?.user_type === 'agent' && (
        <div className="mb-6 border-b border-gray-200">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('documents')}
              className={`flex items-center gap-2 px-6 py-3 font-medium border-b-2 transition ${
                activeTab === 'documents'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              <FileText size={20} />
              Documents
            </button>
            <button
              onClick={() => setActiveTab('checklists')}
              className={`flex items-center gap-2 px-6 py-3 font-medium border-b-2 transition ${
                activeTab === 'checklists'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              <ClipboardList size={20} />
              Client Document Checklists
            </button>
          </div>
        </div>
      )}

      {activeTab === 'checklists' ? (
        <DocumentChecklistManager />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Folders</h2>
            <button
              onClick={() => setShowNewFolderModal(true)}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
              title="New Folder"
            >
              <FolderPlus size={20} />
            </button>
          </div>

          <button
            onClick={() => setSelectedFolder(null)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition mb-2 ${
              selectedFolder === null
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Folder size={18} />
            <span>All Documents</span>
          </button>

          <div className="space-y-1">
            {folders.map(folder => (
              <div
                key={folder.id}
                className={`flex items-center justify-between px-3 py-2 rounded-lg transition group ${
                  selectedFolder === folder.id
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <button
                  onClick={() => setSelectedFolder(folder.id)}
                  className="flex items-center gap-2 flex-1 text-left"
                >
                  <Folder size={18} />
                  <span className="truncate">{folder.name}</span>
                </button>
                <button
                  onClick={() => handleDeleteFolder(folder.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-red-600 hover:bg-red-50 rounded transition"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg shadow-md">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-gray-600">
                  {selectedFolder && (
                    <>
                      <button
                        onClick={() => setSelectedFolder(null)}
                        className="text-blue-600 hover:underline"
                      >
                        All Documents
                      </button>
                      <ChevronRight size={16} />
                      <span className="font-medium text-gray-800">
                        {folders.find(f => f.id === selectedFolder)?.name}
                      </span>
                    </>
                  )}
                </div>
                <label className="cursor-pointer">
                  <div className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium">
                    <Upload size={20} />
                    <span>Upload</span>
                  </div>
                  <input
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="p-6">
              {filteredDocuments.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="mx-auto text-gray-400 mb-4" size={64} />
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">No Documents</h3>
                  <p className="text-gray-600">
                    {searchQuery ? 'No documents match your search' : 'Upload your first document to get started'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredDocuments.map(doc => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition group"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="p-3 bg-blue-50 rounded-lg flex-shrink-0">
                          <File className="text-blue-600" size={24} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-gray-800 truncate">{doc.file_name}</h3>
                            {doc.shared_with_me && (
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                                Shared
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-600 mt-1 flex-wrap">
                            <span className="px-2 py-1 bg-gray-100 rounded text-xs flex items-center gap-1">
                              <Tag size={12} />
                              {doc.document_type}
                            </span>
                            <span>{formatFileSize(doc.file_size)}</span>
                            <span>{new Date(doc.uploaded_at).toLocaleDateString()}</span>
                          </div>
                          {doc.description && (
                            <p className="text-sm text-gray-500 mt-1 line-clamp-1">{doc.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {!doc.shared_with_me && (
                          <button
                            onClick={() => openEditModal(doc)}
                            className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition"
                            title="Edit"
                          >
                            <Edit2 size={20} />
                          </button>
                        )}
                        <button
                          onClick={() => handleView(doc)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="View"
                        >
                          <Eye size={20} />
                        </button>
                        <button
                          onClick={() => handleDownload(doc)}
                          disabled={doc.shared_with_me && !doc.can_download}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                          title={doc.shared_with_me && !doc.can_download ? 'Download not allowed' : 'Download'}
                        >
                          <Download size={20} />
                        </button>
                        {!doc.shared_with_me && (
                          <button
                            onClick={() => handleDelete(doc.id, doc.storage_path)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Delete"
                          >
                            <Trash2 size={20} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        </div>
      )}

      {showNewFolderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">Create New Folder</h2>
              <button
                onClick={() => {
                  setShowNewFolderModal(false);
                  setNewFolderName('');
                  setNewFolderDescription('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Folder Name *
                </label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Contracts"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={newFolderDescription}
                  onChange={(e) => setNewFolderDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Optional description"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowNewFolderModal(false);
                    setNewFolderName('');
                    setNewFolderDescription('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateFolder}
                  disabled={!newFolderName.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditModal && editingDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">Edit Document</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  File Name
                </label>
                <input
                  type="text"
                  value={editingDocument.file_name}
                  disabled
                  className="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Document Type
                </label>
                <select
                  value={editDocumentType}
                  onChange={(e) => setEditDocumentType(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {documentTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Optional description"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditDocument}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">Upload Documents</h2>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadFiles([]);
                  setUploadDocumentType('Other');
                  setUploadDescription('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Files ({uploadFiles.length})
                </label>
                <div className="bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                  {uploadFiles.map((file, index) => (
                    <div key={index} className="text-sm text-gray-700 flex items-center gap-2 py-1">
                      <File size={16} className="text-blue-600 flex-shrink-0" />
                      <span className="truncate">{file.name}</span>
                      <span className="text-gray-500 text-xs flex-shrink-0">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Document Type *
                </label>
                <select
                  value={uploadDocumentType}
                  onChange={(e) => setUploadDocumentType(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {documentTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Optional description for all files"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadFiles([]);
                    setUploadDocumentType('Other');
                    setUploadDescription('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
                  disabled={uploading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleUploadConfirm}
                  disabled={uploading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={18} />
                      <span>Upload</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
