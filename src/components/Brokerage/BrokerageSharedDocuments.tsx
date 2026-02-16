import { useState, useEffect } from 'react';
import { FileText, Download, Search, Filter } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type SharedDocument = {
  id: string;
  brokerage_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  document_type: string;
  description: string | null;
  uploaded_at: string;
  brokerage: {
    company_name: string;
  };
};

export function BrokerageSharedDocuments() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<SharedDocument[]>([]);
  const [loading, setLoading] = useState(true);
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
    loadSharedDocuments();
  }, [user]);

  const loadSharedDocuments = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('brokerage_documents')
        .select(`
          *,
          brokerage:brokerages(company_name)
        `)
        .in('id',
          supabase
            .from('brokerage_document_shares')
            .select('document_id')
        )
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error loading shared documents:', error);
    } finally {
      setLoading(false);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Brokerage Documents</h2>
        <p className="text-gray-600">Documents shared by your brokerage</p>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1">
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
      </div>

      {filteredDocuments.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <FileText className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-gray-800 mb-2">No Documents</h3>
          <p className="text-gray-600">
            {searchQuery || filterType !== 'all'
              ? 'No documents match your search criteria'
              : 'No documents have been shared with you yet'}
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
                      <span className="text-blue-600 font-medium">
                        {document.brokerage.company_name}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="ml-4">
                  <button
                    onClick={() => handleDownloadDocument(document.storage_path, document.file_name)}
                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title="Download"
                  >
                    <Download size={20} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
