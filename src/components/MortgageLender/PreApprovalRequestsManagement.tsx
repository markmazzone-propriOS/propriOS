import { useState, useEffect } from 'react';
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Send,
  Copy,
  Check,
  ArrowLeft,
  Filter,
  Search,
  Download,
  Trash2,
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
  buyer_name?: string;
  buyer_email?: string;
  document_count?: number;
};

export function PreApprovalRequestsManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<PreApprovalRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<PreApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<PreApprovalRequest | null>(null);

  useEffect(() => {
    loadRequests();
  }, []);

  useEffect(() => {
    filterRequests();
  }, [requests, searchQuery, statusFilter]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pre_approval_requests')
        .select('*')
        .eq('lender_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedRequests = await Promise.all(
        (data || []).map(async (req: any) => {
          let buyerName = 'Anonymous Buyer';
          let emailData = 'Not provided';

          if (req.buyer_id) {
            try {
              // Fetch buyer profile info
              const { data: profile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', req.buyer_id)
                .maybeSingle();

              if (profile?.full_name) {
                buyerName = profile.full_name;
              }

              // Fetch buyer email
              const { data: email } = await supabase.rpc('get_user_email', {
                user_id: req.buyer_id,
              });
              emailData = email || 'Not provided';
            } catch (err) {
              console.error('Error fetching buyer info:', req.buyer_id, err);
            }
          }

          const { count } = await supabase
            .from('pre_approval_documents')
            .select('*', { count: 'exact', head: true })
            .eq('pre_approval_request_id', req.id);

          return {
            ...req,
            buyer_name: buyerName,
            buyer_email: emailData,
            document_count: count || 0,
          };
        })
      );

      setRequests(formattedRequests);
    } catch (error) {
      console.error('Error loading requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterRequests = () => {
    let filtered = requests;

    if (statusFilter !== 'all') {
      filtered = filtered.filter((req) => req.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (req) =>
          req.buyer_name?.toLowerCase().includes(query) ||
          req.buyer_email?.toLowerCase().includes(query)
      );
    }

    setFilteredRequests(filtered);
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
        return <CheckCircle size={16} className="text-green-600" />;
      case 'denied':
        return <XCircle size={16} className="text-red-600" />;
      case 'in_review':
        return <Clock size={16} className="text-blue-600" />;
      case 'submitted':
        return <FileText size={16} className="text-yellow-600" />;
      default:
        return <FileText size={16} className="text-gray-600" />;
    }
  };

  const copyShareableLink = async (token: string) => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/pre-approval-form?token=${token}`;

    try {
      await navigator.clipboard.writeText(link);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const generateNewLink = async () => {
    try {
      const baseUrl = window.location.origin;
      const link = `${baseUrl}/#/pre-approval-form?lenderId=${user!.id}`;

      await navigator.clipboard.writeText(link);
      setCopiedToken('new-link');
      setTimeout(() => setCopiedToken(null), 3000);

      alert('Shareable link copied to clipboard! Send this link to buyers so they can fill out a pre-approval request form.');
    } catch (err: any) {
      console.error('Error generating link:', err);
      alert('Failed to copy link to clipboard. Please try again.');
    }
  };

  const updateRequestStatus = async (requestId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('pre_approval_requests')
        .update({ status: newStatus })
        .eq('id', requestId);

      if (error) throw error;

      setRequests(
        requests.map((req) =>
          req.id === requestId ? { ...req, status: newStatus } : req
        )
      );

      if (selectedRequest?.id === requestId) {
        setSelectedRequest({ ...selectedRequest, status: newStatus });
      }
    } catch (err: any) {
      console.error('Error updating status:', err);
    }
  };

  const deleteRequest = async (requestId: string) => {
    if (!confirm('Are you sure you want to delete this pre-approval request? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('pre_approval_requests')
        .delete()
        .eq('id', requestId);

      if (error) throw error;

      setRequests(requests.filter((req) => req.id !== requestId));

      if (selectedRequest?.id === requestId) {
        setSelectedRequest(null);
      }
    } catch (err: any) {
      console.error('Error deleting request:', err);
      alert('Failed to delete pre-approval request. Please try again.');
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
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading requests...</p>
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
                onClick={() => navigate('/lender/dashboard')}
                className="text-gray-600 hover:text-gray-800 transition"
              >
                <ArrowLeft size={24} />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Pre-Approval Requests</h1>
                <p className="text-gray-600 mt-1">Manage and review pre-approval applications</p>
              </div>
            </div>

            <button
              onClick={generateNewLink}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition font-medium"
            >
              {copiedToken === 'new-link' ? (
                <>
                  <Check size={20} />
                  Link Copied!
                </>
              ) : (
                <>
                  <Send size={20} />
                  Generate Shareable Link
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-12">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={20}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by buyer name or email..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter size={20} className="text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="submitted">Submitted</option>
                <option value="in_review">In Review</option>
                <option value="approved">Approved</option>
                <option value="denied">Denied</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {filteredRequests.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <FileText size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600">No pre-approval requests found</p>
              <p className="text-sm text-gray-500 mt-2">
                Generate a shareable link to send to potential buyers
              </p>
            </div>
          ) : (
            filteredRequests.map((request) => (
              <div
                key={request.id}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-gray-800">
                        {request.buyer_name}
                      </h3>
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          request.status
                        )}`}
                      >
                        {getStatusIcon(request.status)}
                        {request.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 mb-4">{request.buyer_email}</p>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-gray-500">Requested Amount</p>
                        <p className="font-semibold text-gray-800">
                          {formatCurrency(request.requested_amount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Annual Income</p>
                        <p className="font-semibold text-gray-800">
                          {formatCurrency(request.annual_income)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Credit Score</p>
                        <p className="font-semibold text-gray-800">
                          {request.credit_score || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Documents</p>
                        <p className="font-semibold text-gray-800">
                          {request.document_count} uploaded
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock size={16} />
                      <span>Submitted {formatDate(request.created_at)}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 ml-4">
                    <button
                      onClick={() => navigate(`/lender/pre-approval/${request.id}`)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition text-sm font-medium"
                    >
                      <Eye size={16} />
                      View Details
                    </button>

                    <button
                      onClick={() => copyShareableLink(request.shareable_token)}
                      className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition text-sm font-medium"
                    >
                      {copiedToken === request.shareable_token ? (
                        <>
                          <Check size={16} />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy size={16} />
                          Copy Link
                        </>
                      )}
                    </button>

                    {request.status === 'submitted' && (
                      <button
                        onClick={() => updateRequestStatus(request.id, 'in_review')}
                        className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-md hover:bg-yellow-200 transition text-sm font-medium"
                      >
                        Mark In Review
                      </button>
                    )}

                    {request.status === 'in_review' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateRequestStatus(request.id, 'approved')}
                          className="flex-1 px-3 py-2 bg-green-100 text-green-800 rounded-md hover:bg-green-200 transition text-sm font-medium"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => updateRequestStatus(request.id, 'denied')}
                          className="flex-1 px-3 py-2 bg-red-100 text-red-800 rounded-md hover:bg-red-200 transition text-sm font-medium"
                        >
                          Deny
                        </button>
                      </div>
                    )}

                    <button
                      onClick={() => deleteRequest(request.id)}
                      className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-700 rounded-md hover:bg-red-50 transition text-sm font-medium"
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
