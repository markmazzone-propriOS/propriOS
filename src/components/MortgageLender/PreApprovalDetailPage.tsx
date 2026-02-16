import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  User,
  DollarSign,
  Home,
  Calendar,
  FileText,
  Briefcase,
  CreditCard,
  Download,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from '../Navigation/Router';

type PreApprovalRequest = {
  id: string;
  buyer_id: string;
  lender_id: string | null;
  requested_amount: number;
  annual_income: number;
  credit_score: number | null;
  down_payment_percentage: number;
  employment_status: string;
  property_type: string;
  status: string;
  additional_notes: string | null;
  shareable_token: string;
  created_at: string;
  approved_amount: number | null;
  actual_credit_score: number | null;
  buyer_name?: string;
  buyer_email?: string;
};

type PreApprovalDocument = {
  id: string;
  section: string;
  document_name: string;
  file_url: string;
  uploaded_at: string;
};

export function PreApprovalDetailPage({ requestId }: { requestId: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [request, setRequest] = useState<PreApprovalRequest | null>(null);
  const [documents, setDocuments] = useState<PreApprovalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [approvedAmount, setApprovedAmount] = useState<string>('');
  const [actualCreditScore, setActualCreditScore] = useState<string>('');

  useEffect(() => {
    loadRequest();
    loadDocuments();
  }, [requestId]);

  const loadRequest = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pre_approval_requests')
        .select('*')
        .eq('id', requestId)
        .eq('lender_id', user!.id)
        .single();

      if (error) throw error;

      let buyerName = 'Anonymous Buyer';
      let emailData = 'Not provided';

      if (data.buyer_id) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', data.buyer_id)
            .maybeSingle();

          if (profile?.full_name) {
            buyerName = profile.full_name;
          }

          const { data: email } = await supabase.rpc('get_user_email', {
            user_id: data.buyer_id,
          });
          emailData = email || 'Not provided';
        } catch (err) {
          console.error('Error fetching buyer info:', err);
        }
      }

      const requestData = {
        ...data,
        buyer_name: buyerName,
        buyer_email: emailData,
      };

      setRequest(requestData);
      setApprovedAmount(requestData.approved_amount?.toString() || '');
      setActualCreditScore(requestData.actual_credit_score?.toString() || '');
    } catch (err) {
      console.error('Error loading request:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('pre_approval_documents')
        .select('*')
        .eq('pre_approval_request_id', requestId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (err) {
      console.error('Error loading documents:', err);
    }
  };

  const updateStatus = async (newStatus: string) => {
    setUpdatingStatus(true);
    try {
      const updateData: any = { status: newStatus };

      if (approvedAmount) {
        updateData.approved_amount = parseFloat(approvedAmount);
      }

      if (actualCreditScore) {
        updateData.actual_credit_score = parseInt(actualCreditScore);
      }

      const { error } = await supabase
        .from('pre_approval_requests')
        .update(updateData)
        .eq('id', requestId);

      if (error) throw error;

      if (request) {
        setRequest({
          ...request,
          status: newStatus,
          approved_amount: updateData.approved_amount || request.approved_amount,
          actual_credit_score: updateData.actual_credit_score || request.actual_credit_score,
        });
      }
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update status. Please try again.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const downloadDocument = async (doc: PreApprovalDocument) => {
    try {
      const filePath = doc.file_url.split('/pre-approval-documents/')[1];

      const { data, error } = await supabase.storage
        .from('pre-approval-documents')
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.document_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading document:', err);
      alert('Failed to download document. Please try again.');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getSectionLabel = (section: string) => {
    const labels: Record<string, string> = {
      personal_identification: 'Personal Identification',
      income_employment: 'Income & Employment',
      assets_savings: 'Assets & Savings',
      debts_liabilities: 'Debts & Liabilities',
    };
    return labels[section] || section;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'denied':
        return 'bg-red-100 text-red-800';
      case 'in_review':
        return 'bg-blue-100 text-blue-800';
      case 'submitted':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle size={20} className="text-green-600" />;
      case 'denied':
        return <XCircle size={20} className="text-red-600" />;
      case 'in_review':
        return <Clock size={20} className="text-blue-600" />;
      case 'submitted':
        return <FileText size={20} className="text-yellow-600" />;
      default:
        return <FileText size={20} className="text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading request details...</p>
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="text-center">
          <p className="text-gray-600">Pre-approval request not found.</p>
          <button
            onClick={() => navigate('/lender/pre-approval-requests')}
            className="mt-4 text-blue-600 hover:text-blue-700"
          >
            Back to Requests
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b mb-8">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/lender/pre-approval-requests')}
                className="text-gray-600 hover:text-gray-800 transition"
              >
                <ArrowLeft size={24} />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">
                  Pre-Approval Request Details
                </h1>
                <p className="text-gray-600 mt-1">
                  Submitted {formatDate(request.created_at)}
                </p>
              </div>
            </div>

            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-lg ${getStatusColor(
                request.status
              )}`}
            >
              {getStatusIcon(request.status)}
              <span className="font-semibold uppercase">
                {request.status.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6">
                Buyer Information
              </h2>
              <div className="grid grid-cols-2 gap-6">
                <div className="flex items-start gap-3">
                  <User className="text-gray-400 mt-1" size={20} />
                  <div>
                    <p className="text-sm text-gray-500">Full Name</p>
                    <p className="font-semibold text-gray-800">
                      {request.buyer_name}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <FileText className="text-gray-400 mt-1" size={20} />
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-semibold text-gray-800">
                      {request.buyer_email}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6">
                Financial Details
              </h2>
              <div className="grid grid-cols-2 gap-6">
                <div className="flex items-start gap-3">
                  <DollarSign className="text-gray-400 mt-1" size={20} />
                  <div>
                    <p className="text-sm text-gray-500">Requested Amount</p>
                    <p className="font-semibold text-gray-800">
                      {formatCurrency(request.requested_amount)}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Briefcase className="text-gray-400 mt-1" size={20} />
                  <div>
                    <p className="text-sm text-gray-500">Annual Income</p>
                    <p className="font-semibold text-gray-800">
                      {formatCurrency(request.annual_income)}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CreditCard className="text-gray-400 mt-1" size={20} />
                  <div>
                    <p className="text-sm text-gray-500">Credit Score</p>
                    <p className="font-semibold text-gray-800">
                      {request.credit_score || 'Not provided'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <DollarSign className="text-gray-400 mt-1" size={20} />
                  <div>
                    <p className="text-sm text-gray-500">Down Payment</p>
                    <p className="font-semibold text-gray-800">
                      {request.down_payment_percentage}%
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Briefcase className="text-gray-400 mt-1" size={20} />
                  <div>
                    <p className="text-sm text-gray-500">Employment Status</p>
                    <p className="font-semibold text-gray-800 capitalize">
                      {request.employment_status.replace('_', ' ')}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Home className="text-gray-400 mt-1" size={20} />
                  <div>
                    <p className="text-sm text-gray-500">Property Type</p>
                    <p className="font-semibold text-gray-800 capitalize">
                      {request.property_type.replace('_', ' ')}
                    </p>
                  </div>
                </div>
              </div>

              {(request.approved_amount || request.actual_credit_score) && (
                <div className="mt-6 pt-6 border-t">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Lender Review</h3>
                  <div className="grid grid-cols-2 gap-6">
                    {request.approved_amount && (
                      <div className="flex items-start gap-3">
                        <DollarSign className="text-green-500 mt-1" size={20} />
                        <div>
                          <p className="text-sm text-gray-500">Approved Amount</p>
                          <p className="font-semibold text-gray-800">
                            {formatCurrency(request.approved_amount)}
                          </p>
                        </div>
                      </div>
                    )}
                    {request.actual_credit_score && (
                      <div className="flex items-start gap-3">
                        <CreditCard className="text-blue-500 mt-1" size={20} />
                        <div>
                          <p className="text-sm text-gray-500">Actual Credit Score</p>
                          <p className="font-semibold text-gray-800">
                            {request.actual_credit_score}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {request.additional_notes && (
                <div className="mt-6 pt-6 border-t">
                  <p className="text-sm text-gray-500 mb-2">Additional Notes</p>
                  <p className="text-gray-800">{request.additional_notes}</p>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6">
                Supporting Documents ({documents.length})
              </h2>

              {documents.length === 0 ? (
                <div className="text-center py-8">
                  <FileText size={48} className="mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600">No documents uploaded yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <FileText size={24} className="text-blue-600" />
                        <div className="flex-1">
                          <p className="font-medium text-gray-800">
                            {doc.document_name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {getSectionLabel(doc.section)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => downloadDocument(doc)}
                        className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-md transition"
                      >
                        <Download size={16} />
                        Download
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                Update Status
              </h2>

              {request.status === 'in_review' && (
                <div className="space-y-4 mb-6 pb-6 border-b">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Amount Approved
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="number"
                        value={approvedAmount}
                        onChange={(e) => setApprovedAmount(e.target.value)}
                        placeholder="Enter approved amount"
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Actual Credit Score
                    </label>
                    <input
                      type="number"
                      value={actualCreditScore}
                      onChange={(e) => setActualCreditScore(e.target.value)}
                      placeholder="Enter verified credit score"
                      min="300"
                      max="850"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {request.status === 'submitted' && (
                  <button
                    onClick={() => updateStatus('in_review')}
                    disabled={updatingStatus}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition font-medium disabled:opacity-50"
                  >
                    <Clock size={20} />
                    Mark as In Review
                  </button>
                )}

                {request.status === 'in_review' && (
                  <>
                    <button
                      onClick={() => updateStatus('approved')}
                      disabled={updatingStatus}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition font-medium disabled:opacity-50"
                    >
                      <CheckCircle size={20} />
                      Approve Request
                    </button>
                    <button
                      onClick={() => updateStatus('denied')}
                      disabled={updatingStatus}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 transition font-medium disabled:opacity-50"
                    >
                      <XCircle size={20} />
                      Deny Request
                    </button>
                  </>
                )}

                {(request.status === 'approved' || request.status === 'denied') && (
                  <button
                    onClick={() => updateStatus('in_review')}
                    disabled={updatingStatus}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition font-medium disabled:opacity-50"
                  >
                    <Clock size={20} />
                    Move Back to Review
                  </button>
                )}
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-800 mb-2">Quick Stats</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Debt-to-Income Ratio</p>
                  <p className="text-xl font-bold text-blue-600">
                    {((request.requested_amount / request.annual_income) * 100).toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Down Payment Amount</p>
                  <p className="text-xl font-bold text-blue-600">
                    {formatCurrency((request.requested_amount * request.down_payment_percentage) / 100)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Documents Submitted</p>
                  <p className="text-xl font-bold text-blue-600">
                    {documents.length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
