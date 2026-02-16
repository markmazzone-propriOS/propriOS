import { useState, useEffect } from 'react';
import { FileText, Clock, CheckCircle, AlertCircle, Download, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PDFSignatureViewer } from '../Documents/PDFSignatureViewer';

type SignatureRequest = {
  id: string;
  document_id: string;
  rental_application_id: string | null;
  sender_id: string;
  signer_id: string;
  status: string;
  sent_at: string;
  expires_at: string;
  signed_document_url: string | null;
  signature_boxes: any[] | null;
  sender_needs_to_sign: boolean;
  sender_signed_at: string | null;
  signer_signed_at: string | null;
  userRole?: 'sender' | 'signer';
  sender: {
    full_name: string;
  };
  signer: {
    full_name: string;
  };
  document: {
    id: string;
    file_name: string;
    storage_path: string;
  };
};

export function PendingSignatures() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<SignatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPDFViewer, setShowPDFViewer] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<SignatureRequest | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadSignatureRequests();

    const channel = supabase
      .channel('signature-requests-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'document_signatures'
        },
        () => {
          loadSignatureRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const loadSignatureRequests = async () => {
    if (!user) {
      console.log('No user found in PendingSignatures');
      return;
    }

    console.log('Loading signature requests for user:', user.id);

    try {
      // Get requests where user is the signer
      const { data: signerData, error: signerError } = await supabase
        .from('document_signatures')
        .select(`
          id,
          document_id,
          rental_application_id,
          sender_id,
          signer_id,
          status,
          sent_at,
          expires_at,
          signed_document_url,
          signature_boxes,
          sender_needs_to_sign,
          sender_signed_at,
          signer_signed_at,
          sender:profiles!document_signatures_sender_id_fkey(full_name),
          signer:profiles!document_signatures_signer_id_fkey(full_name),
          document:documents(id, file_name, storage_path)
        `)
        .eq('signer_id', user.id)
        .order('sent_at', { ascending: false });

      if (signerError) throw signerError;

      // Get requests where user is the sender AND needs to sign
      const { data: senderData, error: senderError } = await supabase
        .from('document_signatures')
        .select(`
          id,
          document_id,
          rental_application_id,
          sender_id,
          signer_id,
          status,
          sent_at,
          expires_at,
          signed_document_url,
          signature_boxes,
          sender_needs_to_sign,
          sender_signed_at,
          signer_signed_at,
          sender:profiles!document_signatures_sender_id_fkey(full_name),
          signer:profiles!document_signatures_signer_id_fkey(full_name),
          document:documents(id, file_name, storage_path)
        `)
        .eq('sender_id', user.id)
        .eq('sender_needs_to_sign', true)
        .order('sent_at', { ascending: false });

      if (senderError) throw senderError;

      console.log('Signer requests loaded:', signerData);
      console.log('Sender requests loaded:', senderData);

      // Mark which role the user is playing in each request
      const signerRequests = (signerData || []).map(req => ({
        ...req,
        userRole: 'signer' as const
      }));

      const senderRequests = (senderData || []).map(req => ({
        ...req,
        userRole: 'sender' as const
      }));

      // Combine and deduplicate (if user is both sender and signer on same document)
      const allRequests = [...signerRequests, ...senderRequests];
      const uniqueRequests = allRequests.filter((req, index, self) =>
        index === self.findIndex(r => r.id === req.id && r.userRole === req.userRole)
      );

      // Filter out any requests with missing document data
      const validRequests = uniqueRequests.filter(req => {
        if (!req.document) {
          console.warn('Signature request missing document data:', req.id);
          return false;
        }
        return true;
      });

      setRequests(validRequests);
    } catch (err: any) {
      console.error('Error loading signature requests:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDocument = async (storagePath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('agent-documents')
        .download(storagePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      window.open(url, '_blank');
    } catch (err: any) {
      console.error('Error viewing document:', err);
      setError('Failed to load document');
    }
  };

  const handleViewSignedDocument = async (request: SignatureRequest) => {
    if (!request.signed_document_url) {
      setError('Signed document not available');
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from('agent-documents')
        .download(request.signed_document_url);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      window.open(url, '_blank');
    } catch (err: any) {
      console.error('Error viewing signed document:', err);
      setError('Failed to load signed document');
    }
  };

  const handleDownloadSignedDocument = async (request: SignatureRequest) => {
    if (!request.signed_document_url) {
      setError('Signed document not available');
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from('agent-documents')
        .download(request.signed_document_url);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `signed_${request.document.file_name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Error downloading signed document:', err);
      setError('Failed to download signed document');
    }
  };

  const handleSignClick = async (request: SignatureRequest) => {
    console.log('PendingSignatures: Sign clicked for request:', request);
    console.log('Signature boxes from request:', request.signature_boxes);
    setSelectedRequest(request);
    setError('');
    setSuccess('');

    try {
      console.log('PendingSignatures: Downloading from storage path:', request.document.storage_path);
      const { data, error } = await supabase.storage
        .from('agent-documents')
        .download(request.document.storage_path);

      if (error) {
        console.error('PendingSignatures: Storage download error:', error);
        throw error;
      }

      console.log('PendingSignatures: Document downloaded, size:', data.size);
      const url = URL.createObjectURL(data);
      console.log('PendingSignatures: Object URL created:', url);
      setPdfUrl(url);
      setShowPDFViewer(true);
    } catch (err: any) {
      console.error('Error loading document:', err);
      setError('Failed to load document for signing: ' + err.message);
    }
  };

  const handleSign = async (signatureData: string, signatureType: 'drawn' | 'typed', signedPdfBlob?: Blob, signatureBoxes?: any[]) => {
    if (!selectedRequest || !user) return;

    setSigning(true);
    setError('');

    try {
      // Determine which fields to update based on user role
      const isSender = selectedRequest.userRole === 'sender';

      let updateFields;
      if (isSender) {
        // Update the signature boxes to mark sender's boxes as signed
        const updatedBoxes = selectedRequest.signature_boxes?.map((box: any) => {
          if (box.signer === 'sender') {
            return { ...box, signed: true };
          }
          return box;
        });

        updateFields = {
          sender_signature_data: signatureData,
          sender_signature_type: signatureType,
          sender_signed_at: new Date().toISOString(),
          signature_boxes: updatedBoxes
        };
      } else {
        updateFields = {
          signature_data: signatureData,
          signature_type: signatureType,
          signer_signed_at: new Date().toISOString(),
          ip_address: 'client-ip',
          signature_boxes: signatureBoxes || []
        };
      }

      const { error: updateError } = await supabase
        .from('document_signatures')
        .update(updateFields)
        .eq('id', selectedRequest.id);

      if (updateError) throw updateError;

      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-signed-pdf`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({ signatureRequestId: selectedRequest.id })
          }
        );

        if (!response.ok) {
          console.error('Failed to generate signed PDF:', await response.text());
        }
      } catch (pdfErr) {
        console.error('Error calling generate-signed-pdf function:', pdfErr);
      }

      setSuccess('Document signed successfully!');
      setShowPDFViewer(false);
      setSelectedRequest(null);
      setPdfUrl('');
      loadSignatureRequests();
    } catch (err: any) {
      console.error('Error signing document:', err);
      setError(err.message);
    } finally {
      setSigning(false);
    }
  };

  const handleDecline = async (requestId: string) => {
    if (!confirm('Are you sure you want to decline signing this document?')) return;

    try {
      const { error } = await supabase
        .from('document_signatures')
        .update({
          status: 'declined',
          declined_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) throw error;

      setSuccess('Document declined');
      loadSignatureRequests();
    } catch (err: any) {
      console.error('Error declining document:', err);
      setError(err.message);
    }
  };

  const getStatusBadge = (status: string, expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const isExpired = now > expiry;

    if (isExpired && status === 'pending') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
          <AlertCircle className="w-4 h-4" />
          Expired
        </span>
      );
    }

    const badges = {
      pending: (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
          <Clock className="w-4 h-4" />
          Pending
        </span>
      ),
      partially_signed: (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
          <Clock className="w-4 h-4" />
          Partially Signed
        </span>
      ),
      signed: (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
          <CheckCircle className="w-4 h-4" />
          Fully Signed
        </span>
      ),
      declined: (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
          <AlertCircle className="w-4 h-4" />
          Declined
        </span>
      )
    };

    return badges[status as keyof typeof badges] || badges.pending;
  };

  const getDaysRemaining = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-24 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // Filter pending requests to only show those where the user hasn't signed in their role yet
  const pendingRequests = requests.filter(r => {
    if (r.status === 'signed' || r.status === 'declined' || r.status === 'expired') return false;

    // If user is signer, check if they've signed
    if (r.userRole === 'signer' && r.signer_signed_at) return false;

    // If user is sender, check if they've signed
    if (r.userRole === 'sender' && r.sender_signed_at) return false;

    return true;
  });

  const completedRequests = requests.filter(r => {
    if (r.status === 'signed' || r.status === 'declined') return true;

    // Also show if user has signed in their role (even if partially signed)
    if (r.userRole === 'signer' && r.signer_signed_at) return true;
    if (r.userRole === 'sender' && r.sender_signed_at) return true;

    return false;
  });

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {success}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-3 mb-6">
          <FileText className="w-6 h-6 text-yellow-600" />
          <h2 className="text-2xl font-bold text-gray-900">Pending Signatures</h2>
          {pendingRequests.length > 0 && (
            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-semibold">
              {pendingRequests.length}
            </span>
          )}
        </div>

        {pendingRequests.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No pending signature requests</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingRequests.map(request => {
              const daysRemaining = getDaysRemaining(request.expires_at);
              const isUrgent = daysRemaining <= 3;

              return (
                <div
                  key={request.id}
                  className={`border rounded-lg p-5 transition-all ${
                    isUrgent
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-200 hover:border-green-300 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg text-gray-900">
                        {request.document.file_name}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {request.userRole === 'signer' ? (
                          <>From: {request.sender.full_name}</>
                        ) : (
                          <>Signing with: {request.signer.full_name}</>
                        )}
                      </p>
                      {request.sender_needs_to_sign && (
                        <p className="text-xs text-blue-600 font-medium mt-1">
                          Both parties must sign
                          {request.status === 'partially_signed' && ' (one party has signed)'}
                        </p>
                      )}
                    </div>
                    {getStatusBadge(request.status, request.expires_at)}
                  </div>

                  <div className="flex items-center gap-2 text-sm mb-4">
                    {isUrgent ? (
                      <div className="flex items-center gap-1 text-red-600 font-medium">
                        <AlertCircle className="w-4 h-4" />
                        Expires in {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}!
                      </div>
                    ) : (
                      <div className="text-gray-600">
                        Expires: {new Date(request.expires_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleViewDocument(request.document.storage_path)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      View Document
                    </button>
                    <button
                      onClick={() => handleSignClick(request)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      Sign Now
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {completedRequests.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Completed Signatures</h3>
          <div className="space-y-3">
            {completedRequests.map(request => (
              <div
                key={request.id}
                className="border border-gray-200 rounded-lg p-4 bg-gray-50"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">
                      {request.document.file_name}
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {request.userRole === 'signer' ? (
                        <>From: {request.sender.full_name}</>
                      ) : (
                        <>Signed with: {request.signer.full_name}</>
                      )}
                    </p>
                    {request.sender_needs_to_sign && (
                      <p className="text-xs text-gray-600 mt-1">
                        {request.status === 'signed'
                          ? 'Both parties have signed'
                          : 'Waiting for other party to sign'}
                      </p>
                    )}
                  </div>
                  {getStatusBadge(request.status, request.expires_at)}
                </div>
                {request.status === 'signed' && request.signed_document_url && (
                  <div className="flex gap-2 pt-3 border-t border-gray-200">
                    <button
                      onClick={() => handleViewSignedDocument(request)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      View Signed Document
                    </button>
                    <button
                      onClick={() => handleDownloadSignedDocument(request)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showPDFViewer && selectedRequest && pdfUrl && (
        <PDFSignatureViewer
          pdfUrl={pdfUrl}
          documentName={selectedRequest.document.file_name}
          signerName={user?.email || ''}
          predefinedBoxes={selectedRequest.signature_boxes || undefined}
          onSign={handleSign}
          onCancel={() => {
            setShowPDFViewer(false);
            setSelectedRequest(null);
            setPdfUrl('');
          }}
        />
      )}
    </div>
  );
}
