import { useState, useEffect } from 'react';
import { X, FileText, Users, Upload, AlertCircle, Calendar, MousePointer } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PDFFieldPlacer } from '../Documents/PDFFieldPlacer';

interface Client {
  id: string;
  full_name: string;
  email: string;
  user_type: string;
}

interface Document {
  id: string;
  title: string;
  file_url: string;
  document_type: string;
}

interface SendSignatureRequestProps {
  onClose: () => void;
  onSuccess?: () => void;
  preselectedClientId?: string;
  preselectedDocumentId?: string;
}

export default function SendSignatureRequest({
  onClose,
  onSuccess,
  preselectedClientId,
  preselectedDocumentId
}: SendSignatureRequestProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploadingDocument, setUploadingDocument] = useState(false);

  const [formData, setFormData] = useState({
    signer_id: preselectedClientId || '',
    document_id: preselectedDocumentId || '',
    expires_days: 30,
    notes: '',
    document_title: '',
    document_type: 'contract',
    sender_needs_to_sign: false
  });

  const [uploadMode, setUploadMode] = useState(false);
  const [showFieldPlacer, setShowFieldPlacer] = useState(false);
  const [signatureBoxes, setSignatureBoxes] = useState<any[]>([]);
  const [senderName, setSenderName] = useState('');

  useEffect(() => {
    loadClients();
    loadDocuments();
    loadSenderName();
  }, []);

  async function loadSenderName() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user?.id)
        .single();

      if (error) throw error;
      setSenderName(data?.full_name || '');
    } catch (err: any) {
      console.error('Error loading sender name:', err);
    }
  }

  async function loadClients() {
    try {
      const { data, error } = await supabase
        .rpc('get_agent_clients_with_email', { p_agent_id: user?.id });

      if (error) throw error;
      setClients(data || []);
    } catch (err: any) {
      console.error('Error loading clients:', err);
      setError('Failed to load clients. Please try again.');
    }
  }

  async function loadDocuments() {
    try {
      // Get documents owned by the agent
      const { data: ownedDocs, error: ownedError } = await supabase
        .from('documents')
        .select('id, file_name, storage_path, document_type')
        .or(`agent_id.eq.${user?.id},owner_id.eq.${user?.id}`)
        .order('uploaded_at', { ascending: false });

      if (ownedError) throw ownedError;

      // Get documents shared with the agent
      const { data: sharedDocs, error: sharedError } = await supabase
        .from('document_shares')
        .select('document_id, documents!inner(id, file_name, storage_path, document_type)')
        .eq('shared_with', user?.id)
        .order('shared_at', { ascending: false });

      if (sharedError) throw sharedError;

      // Combine and format documents
      const owned = (ownedDocs || []).map(doc => ({
        id: doc.id,
        title: doc.file_name,
        file_url: doc.storage_path,
        document_type: doc.document_type || 'other'
      }));

      const shared = (sharedDocs || []).map(share => {
        const doc = share.documents as any;
        return {
          id: doc.id,
          title: doc.file_name + ' (shared)',
          file_url: doc.storage_path,
          document_type: doc.document_type || 'other'
        };
      });

      // Remove duplicates (in case a document is both owned and shared)
      const allDocs = [...owned, ...shared];
      const uniqueDocs = allDocs.filter((doc, index, self) =>
        index === self.findIndex(d => d.id === doc.id)
      );

      setDocuments(uniqueDocs);
    } catch (err: any) {
      console.error('Error loading documents:', err);
      setError('Failed to load documents. Please try again.');
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDocument(true);
    setError('');

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('agent-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: docData, error: docError } = await supabase
        .from('documents')
        .insert({
          owner_id: user?.id,
          file_name: formData.document_title || file.name,
          storage_path: fileName,
          file_type: file.type,
          file_size: file.size,
          document_type: formData.document_type,
          requires_signature: true
        })
        .select()
        .single();

      if (docError) throw docError;

      setFormData({ ...formData, document_id: docData.id });
      await loadDocuments();
      setUploadMode(false);
      setSuccess('Document uploaded successfully!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploadingDocument(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (!formData.signer_id) {
        throw new Error('Please select a client');
      }

      if (!formData.document_id) {
        throw new Error('Please select or upload a document');
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + formData.expires_days);

      const { data, error: insertError } = await supabase
        .from('document_signatures')
        .insert({
          sender_id: user?.id,
          signer_id: formData.signer_id,
          document_id: formData.document_id,
          expires_at: expiresAt.toISOString(),
          notes: formData.notes || null,
          status: 'pending',
          signature_boxes: signatureBoxes.length > 0 ? signatureBoxes : null,
          sender_needs_to_sign: formData.sender_needs_to_sign
        })
        .select()
        .single();

      if (insertError) throw insertError;

      await supabase.functions.invoke('send-signature-request', {
        body: { signature_id: data.id }
      });

      setSuccess('Signature request sent successfully!');

      // Call onSuccess immediately to update parent component's stats
      onSuccess?.();

      // Close modal after showing success message
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="text-blue-600" size={20} />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Send Signature Request</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">{success}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Client *
            </label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <select
                required
                value={formData.signer_id}
                onChange={(e) => setFormData({ ...formData, signer_id: e.target.value })}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Choose a client...</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.full_name} ({client.user_type}) - {client.email}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Document *
            </label>

            {!uploadMode ? (
              <>
                <select
                  required={!uploadMode}
                  value={formData.document_id}
                  onChange={(e) => setFormData({ ...formData, document_id: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
                >
                  <option value="">Select an existing document...</option>
                  {documents.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.title} ({doc.document_type})
                    </option>
                  ))}
                </select>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setUploadMode(true)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2"
                  >
                    <Upload size={16} />
                    Or upload a new document
                  </button>
                  {formData.document_id && (
                    <button
                      type="button"
                      onClick={() => setShowFieldPlacer(true)}
                      className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center gap-2"
                    >
                      <MousePointer size={16} />
                      {signatureBoxes.length > 0
                        ? `${signatureBoxes.length} field${signatureBoxes.length > 1 ? 's' : ''} configured`
                        : 'Configure signature fields'}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Document Title</label>
                  <input
                    type="text"
                    value={formData.document_title}
                    onChange={(e) => setFormData({ ...formData, document_title: e.target.value })}
                    placeholder="e.g., Purchase Agreement"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">Document Type</label>
                  <select
                    value={formData.document_type}
                    onChange={(e) => setFormData({ ...formData, document_type: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="contract">Contract</option>
                    <option value="agreement">Agreement</option>
                    <option value="disclosure">Disclosure</option>
                    <option value="addendum">Addendum</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">Upload File</label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileUpload}
                    disabled={uploadingDocument}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {uploadingDocument && (
                    <p className="text-sm text-gray-500 mt-1">Uploading...</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setUploadMode(false)}
                  className="text-sm text-gray-600 hover:text-gray-700"
                >
                  Cancel upload and select existing
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Expiration
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <select
                value={formData.expires_days}
                onChange={(e) => setFormData({ ...formData, expires_days: parseInt(e.target.value) })}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
              </select>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.sender_needs_to_sign}
                onChange={(e) => setFormData({ ...formData, sender_needs_to_sign: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-900">I also need to sign this document</span>
                <p className="text-xs text-gray-500 mt-0.5">Both parties will need to sign before the document is fully executed</p>
              </div>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Add any additional notes or instructions for the signer..."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || uploadingDocument}
              className="flex-1 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send Signature Request'}
            </button>
          </div>
        </form>
      </div>

      {showFieldPlacer && formData.document_id && formData.signer_id && (
        <PDFFieldPlacer
          pdfUrl={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/agent-documents/${
            documents.find(d => d.id === formData.document_id)?.file_url
          }`}
          documentName={documents.find(d => d.id === formData.document_id)?.title || 'Document'}
          signerName={clients.find(c => c.id === formData.signer_id)?.full_name || 'Signer'}
          senderName={senderName}
          onComplete={(boxes) => {
            setSignatureBoxes(boxes);
            setShowFieldPlacer(false);
          }}
          onCancel={() => setShowFieldPlacer(false)}
        />
      )}
    </div>
  );
}
