import { useState, useEffect } from 'react';
import { FileText, Send, Check, X as XIcon, Clock, Calendar, User, Hash, Eye, History, AlertCircle, Plus, Download, PenTool, Trash2, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import SendSignatureRequest from './SendSignatureRequest';
import { PDFSignatureViewer } from '../Documents/PDFSignatureViewer';

interface SignatureRequest {
  id: string;
  status: 'pending' | 'partially_signed' | 'signed' | 'declined' | 'expired';
  sent_at: string;
  signed_at: string | null;
  signer_signed_at: string | null;
  sender_signed_at: string | null;
  declined_at: string | null;
  expires_at: string;
  notes: string | null;
  serial_number: string | null;
  decline_reason: string | null;
  ip_address: string | null;
  audit_log: any[];
  sender_needs_to_sign: boolean;
  signature_boxes: any[] | null;
  signed_document_url: string | null;
  document: {
    id: string;
    file_name: string;
    storage_path: string;
    document_type: string;
  };
  signer: {
    id: string;
    full_name: string;
    user_type: string;
  };
}

export default function SignaturesManagement() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [signatures, setSignatures] = useState<SignatureRequest[]>([]);
  const [filteredSignatures, setFilteredSignatures] = useState<SignatureRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showSendRequest, setShowSendRequest] = useState(false);
  const [selectedSignature, setSelectedSignature] = useState<SignatureRequest | null>(null);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [showPDFViewer, setShowPDFViewer] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSignatures();

    const channel = supabase
      .channel('signature-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'document_signatures',
          filter: `sender_id=eq.${user?.id}`
        },
        () => {
          loadSignatures(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    filterSignatures();
  }, [signatures, statusFilter, searchTerm]);

  async function loadSignatures(showLoading = true) {
    try {
      if (showLoading) setLoading(true);

      const { data, error } = await supabase
        .from('document_signatures')
        .select(`
          id,
          status,
          sent_at,
          signed_at,
          signer_signed_at,
          sender_signed_at,
          declined_at,
          expires_at,
          notes,
          serial_number,
          decline_reason,
          ip_address,
          audit_log,
          sender_needs_to_sign,
          signature_boxes,
          signed_document_url,
          document:documents(id, file_name, storage_path, document_type),
          signer:profiles!document_signatures_signer_id_fkey(id, full_name, user_type)
        `)
        .eq('sender_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setSignatures(data || []);
    } catch (err: any) {
      console.error('Error loading signatures:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  function filterSignatures() {
    let filtered = signatures;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(sig => sig.status === statusFilter);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(sig =>
        sig.document.file_name.toLowerCase().includes(term) ||
        sig.signer.full_name.toLowerCase().includes(term) ||
        (sig.serial_number && sig.serial_number.toLowerCase().includes(term))
      );
    }

    setFilteredSignatures(filtered);
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'signed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'partially_signed':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'declined':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'expired':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'signed':
        return <Check size={16} />;
      case 'partially_signed':
        return <Clock size={16} />;
      case 'pending':
        return <Clock size={16} />;
      case 'declined':
        return <XIcon size={16} />;
      case 'expired':
        return <AlertCircle size={16} />;
      default:
        return <Clock size={16} />;
    }
  }

  function isExpired(expiresAt: string) {
    return new Date(expiresAt) < new Date();
  }

  async function handleResendRequest(signature: SignatureRequest) {
    try {
      await supabase.functions.invoke('send-signature-request', {
        body: { signature_id: signature.id }
      });
      alert('Signature request resent successfully!');
    } catch (err: any) {
      alert('Failed to resend request: ' + err.message);
    }
  }

  async function handleDownloadDocument(signature: SignatureRequest) {
    // If document is signed and has a signed version, download that; otherwise download original
    const storagePath = (signature.status === 'signed' && signature.signed_document_url)
      ? signature.signed_document_url
      : signature.document.storage_path;

    const { data } = supabase.storage
      .from('agent-documents')
      .getPublicUrl(storagePath);
    window.open(data.publicUrl, '_blank');
  }

  async function handleDeleteSignature(signature: SignatureRequest) {
    const confirmMessage = signature.status === 'signed'
      ? 'Are you sure you want to delete this signed document? This action cannot be undone.'
      : 'Are you sure you want to delete this signature request?';

    if (!confirm(confirmMessage)) return;

    try {
      // Delete the signature request from database
      const { error: deleteError } = await supabase
        .from('document_signatures')
        .delete()
        .eq('id', signature.id);

      if (deleteError) throw deleteError;

      // Optionally delete the signed document file from storage if it exists
      if (signature.signed_document_url) {
        await supabase.storage
          .from('agent-documents')
          .remove([signature.signed_document_url]);
      }

      alert('Signature request deleted successfully');
      loadSignatures(false);
    } catch (err: any) {
      console.error('Error deleting signature request:', err);
      alert('Failed to delete signature request: ' + err.message);
    }
  }

  async function handleRegeneratePDF(signature: SignatureRequest) {
    if (!confirm('This will regenerate the signed PDF with the latest format. Continue?')) return;

    try {
      setLoading(true);

      // Delete old signed PDF from storage if it exists
      if (signature.signed_document_url) {
        await supabase.storage
          .from('agent-documents')
          .remove([signature.signed_document_url]);
      }

      // Clear the signed_document_url in database
      const { error: updateError } = await supabase
        .from('document_signatures')
        .update({ signed_document_url: null })
        .eq('id', signature.id);

      if (updateError) throw updateError;

      // Generate new signed PDF
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-signed-pdf`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({ signatureRequestId: signature.id })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to generate PDF: ${errorText}`);
      }

      alert('PDF regenerated successfully!');
      loadSignatures(false);
    } catch (err: any) {
      console.error('Error regenerating PDF:', err);
      alert('Failed to regenerate PDF: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignClick(signature: SignatureRequest) {
    setSelectedSignature(signature);
    setError('');

    try {
      const { data, error } = await supabase.storage
        .from('agent-documents')
        .download(signature.document.storage_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      setPdfUrl(url);
      setShowPDFViewer(true);
    } catch (err: any) {
      console.error('Error loading document:', err);
      setError('Failed to load document for signing: ' + err.message);
      alert('Failed to load document: ' + err.message);
    }
  }

  async function handleSign(signatureData: string, signatureType: 'drawn' | 'typed', signedPdfBlob?: Blob, signatureBoxes?: any[]) {
    if (!selectedSignature || !user) return;

    setSigning(true);
    setError('');

    try {
      // Update the signature boxes to mark sender's boxes as signed
      const updatedBoxes = selectedSignature.signature_boxes?.map((box: any) => {
        if (box.signer === 'sender') {
          return { ...box, signed: true };
        }
        return box;
      });

      const { error: updateError } = await supabase
        .from('document_signatures')
        .update({
          sender_signature_data: signatureData,
          sender_signature_type: signatureType,
          sender_signed_at: new Date().toISOString(),
          signature_boxes: updatedBoxes
        })
        .eq('id', selectedSignature.id);

      if (updateError) throw updateError;

      // Try to generate signed PDF if both parties have now signed
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-signed-pdf`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({ signatureRequestId: selectedSignature.id })
          }
        );

        if (!response.ok) {
          console.error('Failed to generate signed PDF:', await response.text());
        }
      } catch (pdfErr) {
        console.error('Error calling generate-signed-pdf function:', pdfErr);
      }

      alert('Document signed successfully!');
      setShowPDFViewer(false);
      setSelectedSignature(null);
      setPdfUrl('');
      loadSignatures(false);
    } catch (err: any) {
      console.error('Error signing document:', err);
      setError(err.message);
      alert('Failed to sign document: ' + err.message);
    } finally {
      setSigning(false);
    }
  }

  const stats = {
    total: signatures.length,
    pending: signatures.filter(s => s.status === 'pending').length,
    signed: signatures.filter(s => s.status === 'signed').length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">E-Signature Management</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Track and manage document signature requests</p>
        </div>
        <button
          onClick={() => setShowSendRequest(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus size={20} />
          Send Signature Request
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <p className="text-sm font-medium text-red-800">Error</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
          <button
            onClick={() => setError('')}
            className="ml-auto text-red-600 hover:text-red-700"
          >
            <XIcon size={18} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="text-blue-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Requests</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-yellow-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock className="text-yellow-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-green-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Check className="text-green-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Signed</p>
              <p className="text-2xl font-bold text-gray-900">{stats.signed}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by document, client, or serial number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="partially_signed">Partially Signed</option>
              <option value="signed">Signed</option>
              <option value="declined">Declined</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {filteredSignatures.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="mx-auto text-gray-400 mb-3" size={48} />
              <p className="text-gray-600">No signature requests found</p>
              {statusFilter !== 'all' && (
                <button
                  onClick={() => setStatusFilter('all')}
                  className="text-blue-600 hover:text-blue-700 mt-2"
                >
                  Clear filter
                </button>
              )}
            </div>
          ) : (
            filteredSignatures.map((signature) => {
              const needsAgentSignature = signature.sender_needs_to_sign && !signature.sender_signed_at && signature.status !== 'declined' && !isExpired(signature.expires_at);

              return (
              <div key={signature.id} className={`p-4 transition ${needsAgentSignature ? 'bg-green-50 border-l-4 border-green-500' : 'hover:bg-gray-50'}`}>
                {needsAgentSignature && (
                  <div className="mb-3 p-2 bg-green-100 border border-green-300 rounded-lg flex items-center gap-2">
                    <AlertCircle className="text-green-700" size={16} />
                    <span className="text-sm font-medium text-green-800">Your signature is required</span>
                  </div>
                )}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">{signature.document.file_name}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border flex items-center gap-1 ${getStatusColor(signature.status)}`}>
                        {getStatusIcon(signature.status)}
                        {signature.status.charAt(0).toUpperCase() + signature.status.slice(1)}
                      </span>
                      {signature.status === 'pending' && isExpired(signature.expires_at) && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium border bg-red-100 text-red-800 border-red-200">
                          Expired
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <User size={16} />
                        <span>
                          {signature.signer.full_name} ({signature.signer.user_type})
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar size={16} />
                        <span>Sent: {new Date(signature.sent_at).toLocaleDateString()}</span>
                      </div>

                      {signature.serial_number && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Hash size={16} />
                          <span className="font-mono text-xs">{signature.serial_number}</span>
                        </div>
                      )}

                      {signature.sender_needs_to_sign && (
                        <>
                          <div className="flex items-center gap-2 text-gray-600">
                            <User size={16} />
                            <span>
                              Your signature: {signature.sender_signed_at ? (
                                <span className="text-green-600 font-medium">Signed</span>
                              ) : (
                                <span className="text-yellow-600 font-medium">Pending</span>
                              )}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-600">
                            <User size={16} />
                            <span>
                              Client signature: {signature.signer_signed_at ? (
                                <span className="text-green-600 font-medium">Signed</span>
                              ) : (
                                <span className="text-yellow-600 font-medium">Pending</span>
                              )}
                            </span>
                          </div>
                        </>
                      )}

                      {!signature.sender_needs_to_sign && signature.signer_signed_at && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Check size={16} />
                          <span>Signed: {new Date(signature.signer_signed_at).toLocaleDateString()}</span>
                        </div>
                      )}

                      {(signature.status === 'pending' || signature.status === 'partially_signed') && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Clock size={16} />
                          <span>Expires: {new Date(signature.expires_at).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>

                    {signature.decline_reason && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                        <strong>Decline Reason:</strong> {signature.decline_reason}
                      </div>
                    )}

                    {signature.notes && (
                      <div className="mt-2 text-sm text-gray-600">
                        <strong>Notes:</strong> {signature.notes}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    {signature.sender_needs_to_sign && !signature.sender_signed_at && signature.status !== 'declined' && !isExpired(signature.expires_at) && (
                      <button
                        onClick={() => handleSignClick(signature)}
                        className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium text-sm flex items-center gap-2"
                        title="Sign Document"
                      >
                        <PenTool size={16} />
                        Sign Now
                      </button>
                    )}

                    <button
                      onClick={() => handleDownloadDocument(signature)}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                      title="Download Document"
                    >
                      <Download size={18} />
                    </button>

                    {signature.status === 'pending' && !isExpired(signature.expires_at) && (
                      <button
                        onClick={() => handleResendRequest(signature)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="Resend Request"
                      >
                        <Send size={18} />
                      </button>
                    )}

                    {signature.audit_log && signature.audit_log.length > 0 && (
                      <button
                        onClick={() => {
                          setSelectedSignature(signature);
                          setShowAuditLog(true);
                        }}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                        title="View Audit Log"
                      >
                        <History size={18} />
                      </button>
                    )}

                    {signature.status === 'signed' && signature.signed_document_url && (
                      <button
                        onClick={() => handleRegeneratePDF(signature)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                        title="Regenerate PDF (updates to latest format)"
                      >
                        <RefreshCw size={18} />
                      </button>
                    )}

                    <button
                      onClick={() => setSelectedSignature(signature)}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                      title="View Details"
                    >
                      <Eye size={18} />
                    </button>

                    <button
                      onClick={() => handleDeleteSignature(signature)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Delete Signature Request"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            );
            })
          )}
        </div>
      </div>

      {showSendRequest && (
        <SendSignatureRequest
          onClose={() => setShowSendRequest(false)}
          onSuccess={() => {
            loadSignatures();
            setShowSendRequest(false);
          }}
        />
      )}

      {selectedSignature && showAuditLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <History className="text-blue-600" size={20} />
                <h2 className="text-xl font-semibold text-gray-900">Audit Trail</h2>
              </div>
              <button
                onClick={() => {
                  setShowAuditLog(false);
                  setSelectedSignature(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <XIcon size={24} />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">{selectedSignature.document.file_name}</h3>
                {selectedSignature.serial_number && (
                  <p className="text-sm text-gray-600">
                    <strong>Serial Number:</strong>{' '}
                    <span className="font-mono">{selectedSignature.serial_number}</span>
                  </p>
                )}
              </div>

              <div className="space-y-4">
                {selectedSignature.audit_log.map((entry: any, index: number) => (
                  <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-900">{entry.action}</span>
                      <span className="text-sm text-gray-500">
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{entry.details}</p>
                    {entry.ip_address && (
                      <p className="text-xs text-gray-500 mt-1">
                        IP: {entry.ip_address}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showPDFViewer && selectedSignature && pdfUrl && (
        <PDFSignatureViewer
          pdfUrl={pdfUrl}
          documentName={selectedSignature.document.file_name}
          signerName={user?.email || ''}
          predefinedBoxes={selectedSignature.signature_boxes?.filter((box: any) => box.signer === 'sender') || undefined}
          userRole="sender"
          onSign={handleSign}
          onCancel={() => {
            setShowPDFViewer(false);
            setSelectedSignature(null);
            setPdfUrl('');
          }}
        />
      )}
    </div>
  );
}
