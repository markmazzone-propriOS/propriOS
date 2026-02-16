import { useState, useEffect } from 'react';
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  ArrowLeft,
  AlertCircle,
  DollarSign,
  Calendar,
  User,
  TrendingUp,
  Home,
  Briefcase,
  CreditCard,
  Download,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { jsPDF } from 'jspdf';
import { useNavigate } from '../Navigation/Router';

type PreApprovalRequest = {
  id: string;
  buyer_id: string | null;
  lender_id: string | null;
  requested_amount: number;
  annual_income: number;
  credit_score: number | null;
  actual_credit_score: number | null;
  down_payment_percentage: number;
  employment_status: string;
  property_type: string;
  status: string;
  lender_notes: string | null;
  approved_amount: number | null;
  approval_date: string | null;
  additional_notes: string | null;
  created_at: string;
  updated_at: string;
  lender_name?: string;
  lender_email?: string;
  lender_company?: string;
  document_count?: number;
  loan_type: string;
  final_loan_amount?: number | null;
  loan_terms?: any;
  loan_documents_complete?: boolean;
  loan_approval_date?: string | null;
};

type PreApprovalDocument = {
  id: string;
  section: string;
  document_name: string;
  file_url: string;
  uploaded_at: string;
};

export function BuyerPreApprovalRequests() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<PreApprovalRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<PreApprovalRequest | null>(null);
  const [documents, setDocuments] = useState<PreApprovalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [documentsLoading, setDocumentsLoading] = useState(false);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pre_approval_requests')
        .select('*')
        .eq('buyer_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedRequests = await Promise.all(
        (data || []).map(async (req: any) => {
          let lenderName = 'Not assigned';
          let lenderEmail = '';
          let lenderCompany = '';

          if (req.lender_id) {
            try {
              // Fetch lender company name from mortgage_lender_profiles
              const { data: lenderProfile, error: profileError } = await supabase
                .from('mortgage_lender_profiles')
                .select('company_name, email')
                .eq('id', req.lender_id)
                .maybeSingle();

              if (profileError) {
                console.error('Error fetching lender profile:', profileError);
              }

              if (lenderProfile) {
                lenderCompany = lenderProfile.company_name || '';
                lenderEmail = lenderProfile.email || '';
              }

              // Fetch lender personal name from profiles
              const { data: profile, error: nameError } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', req.lender_id)
                .maybeSingle();

              if (nameError) {
                console.error('Error fetching lender name:', nameError);
              }

              if (profile?.full_name) {
                lenderName = profile.full_name;
              }

              // Get email if not already set
              if (!lenderEmail) {
                const { data: email } = await supabase.rpc('get_user_email', {
                  user_id: req.lender_id,
                });
                lenderEmail = email || '';
              }
            } catch (err) {
              console.error('Error fetching lender info:', err);
            }
          }

          const { count } = await supabase
            .from('pre_approval_documents')
            .select('*', { count: 'exact', head: true })
            .eq('pre_approval_request_id', req.id);

          return {
            ...req,
            lender_name: lenderName,
            lender_email: lenderEmail,
            lender_company: lenderCompany,
            document_count: count || 0,
          };
        })
      );

      setRequests(formattedRequests);
    } catch (error) {
      console.error('Error loading pre-approval requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDocuments = async (requestId: string) => {
    setDocumentsLoading(true);
    try {
      const { data, error } = await supabase
        .from('pre_approval_documents')
        .select('*')
        .eq('pre_approval_request_id', requestId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setDocumentsLoading(false);
    }
  };

  const handleViewDetails = (request: PreApprovalRequest) => {
    setSelectedRequest(request);
    loadDocuments(request.id);
  };

  const getRequestTypeLabel = (loanType: string) => {
    return loanType === 'loan_approval' ? 'Final Loan Approval' : 'Pre-Approval';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'submitted':
        return <Clock className="w-5 h-5 text-blue-500" />;
      case 'in_review':
        return <Eye className="w-5 h-5 text-yellow-500" />;
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'denied':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted':
        return 'bg-blue-100 text-blue-800';
      case 'in_review':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'denied':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
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

  const getPropertyTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      single_family: 'Single Family',
      condo: 'Condo',
      townhouse: 'Townhouse',
      multi_family: 'Multi-Family',
    };
    return labels[type] || type;
  };

  const getEmploymentStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      full_time: 'Full-Time',
      part_time: 'Part-Time',
      self_employed: 'Self-Employed',
      retired: 'Retired',
      other: 'Other',
    };
    return labels[status] || status;
  };

  const generatePreApprovalLetter = async (request: PreApprovalRequest) => {
    // Fetch buyer's name
    let buyerName = 'Valued Client';
    try {
      const { data: buyerProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', request.buyer_id)
        .maybeSingle();

      if (buyerProfile?.full_name) {
        buyerName = buyerProfile.full_name;
      }
    } catch (err) {
      console.error('Error fetching buyer name:', err);
    }

    // CRITICAL: Fetch lender company name directly from database to ensure accuracy
    let lenderCompanyName = 'Mortgage Lender';
    let lenderEmail = '';

    if (request.lender_id) {
      try {
        const { data: lenderProfile } = await supabase
          .from('mortgage_lender_profiles')
          .select('company_name, email')
          .eq('id', request.lender_id)
          .maybeSingle();

        if (lenderProfile?.company_name) {
          lenderCompanyName = lenderProfile.company_name;
        }
        if (lenderProfile?.email) {
          lenderEmail = lenderProfile.email;
        }
      } catch (err) {
        console.error('Error fetching lender company info:', err);
        // Fallback to request data if available
        if (request.lender_company) {
          lenderCompanyName = request.lender_company;
        }
        if (request.lender_email) {
          lenderEmail = request.lender_email;
        }
      }
    } else if (request.lender_company) {
      // Use data from request if no lender_id
      lenderCompanyName = request.lender_company;
      if (request.lender_email) {
        lenderEmail = request.lender_email;
      }
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;

    // Brand colors
    const primaryBlue = '#2563EB';
    const darkGray = '#1F2937';
    const lightGray = '#6B7280';

    // Header with lender branding
    doc.setFillColor(37, 99, 235); // Primary blue
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text(lenderCompanyName, margin, 27);

    // Subheading
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Mortgage Pre-Approval', margin, 35);

    // Letter title
    doc.setTextColor(31, 41, 55); // Dark gray
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Pre-Approval Letter', margin, 60);

    // Date
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128); // Light gray
    const approvalDate = request.approval_date
      ? formatDate(request.approval_date)
      : formatDate(request.updated_at);
    doc.text(`Date: ${approvalDate}`, pageWidth - margin, 60, { align: 'right' });

    // Congratulations message
    doc.setFontSize(11);
    doc.setTextColor(31, 41, 55);
    doc.setFont('helvetica', 'normal');
    let yPosition = 80;

    const congratsText = `Dear ${buyerName},\n\nCongratulations! We are pleased to inform you that your mortgage pre-approval request has been approved. This letter serves as confirmation that you have been pre-approved for a mortgage loan.`;

    const splitCongrats = doc.splitTextToSize(congratsText, contentWidth);
    doc.text(splitCongrats, margin, yPosition);
    yPosition += splitCongrats.length * 5 + 15;

    // Pre-Approval Details box
    doc.setFillColor(239, 246, 255); // Light blue background
    doc.roundedRect(margin, yPosition, contentWidth, 70, 3, 3, 'F');

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235);
    doc.text('Pre-Approval Details', margin + 10, yPosition + 12);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(31, 41, 55);

    let detailY = yPosition + 25;
    const lineHeight = 10;

    // Approved Amount (prominent)
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Approved Loan Amount:', margin + 10, detailY);
    doc.setTextColor(34, 197, 94); // Green
    doc.setFontSize(16);
    doc.text(formatCurrency(request.approved_amount!), margin + 70, detailY);

    detailY += lineHeight + 5;

    // Credit Score
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(31, 41, 55);
    doc.text('Credit Score:', margin + 10, detailY);
    doc.setFont('helvetica', 'normal');
    const creditScore = request.actual_credit_score || request.credit_score || 'N/A';
    doc.text(String(creditScore), margin + 70, detailY);

    detailY += lineHeight;

    // Property Type
    doc.setFont('helvetica', 'bold');
    doc.text('Property Type:', margin + 10, detailY);
    doc.setFont('helvetica', 'normal');
    doc.text(getPropertyTypeLabel(request.property_type), margin + 70, detailY);

    detailY += lineHeight;

    // Down Payment
    doc.setFont('helvetica', 'bold');
    doc.text('Down Payment:', margin + 10, detailY);
    doc.setFont('helvetica', 'normal');
    doc.text(`${request.down_payment_percentage}%`, margin + 70, detailY);

    yPosition += 75;

    // Lender information - Always show if we have company name
    if (lenderCompanyName && lenderCompanyName !== 'Mortgage Lender') {
      yPosition += 10;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(31, 41, 55);
      doc.text('Approved By', margin, yPosition);

      yPosition += 8;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');

      // Show company name (not personal name)
      doc.text(lenderCompanyName, margin, yPosition);
      yPosition += 6;

      // Show company email if available
      if (lenderEmail) {
        doc.setTextColor(107, 114, 128);
        doc.text(lenderEmail, margin, yPosition);
        yPosition += 6;
      }

      yPosition += 4;
    }

    // Important notes
    yPosition += 10;
    doc.setFontSize(11);
    doc.setTextColor(31, 41, 55);
    doc.setFont('helvetica', 'normal');

    const importantText = `\nThis pre-approval letter is valid for 90 days from the date of issue and is subject to verification of all information provided. This letter does not constitute a commitment to lend and final approval is subject to satisfactory appraisal, title review, and underwriting approval.\n\nPlease keep this letter with you when viewing properties and present it to sellers or their agents to demonstrate your financing capability.\n\nWe wish you the best of luck in finding your dream home!`;

    const splitImportant = doc.splitTextToSize(importantText, contentWidth);
    doc.text(splitImportant, margin, yPosition);
    yPosition += splitImportant.length * 5 + 15;

    // Footer
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.setFont('helvetica', 'italic');
    const footerY = pageHeight - 15;
    const footerText = `This is an official pre-approval letter issued by ${lenderCompanyName}`;
    doc.text(footerText, pageWidth / 2, footerY, {
      align: 'center',
    });

    // Save the PDF
    doc.save(`Pre-Approval-Letter-${approvalDate.replace(/\s/g, '-')}.pdf`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading your pre-approval requests...</p>
          </div>
        </div>
      </div>
    );
  }

  if (selectedRequest) {
    return (
      <div className="min-h-screen bg-gray-100 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => setSelectedRequest(null)}
            className="flex items-center text-blue-600 hover:text-blue-700 mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to All Requests
          </button>

          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-2xl font-bold text-gray-900">{getRequestTypeLabel(selectedRequest.loan_type)}</h2>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    selectedRequest.loan_type === 'loan_approval'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {getRequestTypeLabel(selectedRequest.loan_type)}
                  </span>
                </div>
                <p className="text-gray-600">
                  Submitted on {formatDate(selectedRequest.created_at)}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                {getStatusIcon(selectedRequest.status)}
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedRequest.status)}`}>
                  {selectedRequest.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-4">
                <div className="flex items-start">
                  <DollarSign className="w-5 h-5 text-gray-400 mr-3 mt-1" />
                  <div>
                    <p className="text-sm text-gray-600">Requested Amount</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {formatCurrency(selectedRequest.requested_amount)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <TrendingUp className="w-5 h-5 text-gray-400 mr-3 mt-1" />
                  <div>
                    <p className="text-sm text-gray-600">Annual Income</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {formatCurrency(selectedRequest.annual_income)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <CreditCard className="w-5 h-5 text-gray-400 mr-3 mt-1" />
                  <div>
                    <p className="text-sm text-gray-600">Credit Score</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {selectedRequest.credit_score || 'Not provided'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start">
                  <Home className="w-5 h-5 text-gray-400 mr-3 mt-1" />
                  <div>
                    <p className="text-sm text-gray-600">Property Type</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {getPropertyTypeLabel(selectedRequest.property_type)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <Briefcase className="w-5 h-5 text-gray-400 mr-3 mt-1" />
                  <div>
                    <p className="text-sm text-gray-600">Employment Status</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {getEmploymentStatusLabel(selectedRequest.employment_status)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <DollarSign className="w-5 h-5 text-gray-400 mr-3 mt-1" />
                  <div>
                    <p className="text-sm text-gray-600">Down Payment</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {selectedRequest.down_payment_percentage}%
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {selectedRequest.lender_id && (
              <div className="border-t pt-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Assigned Lender</h3>
                <div className="flex items-start">
                  <User className="w-5 h-5 text-gray-400 mr-3 mt-1" />
                  <div>
                    <p className="font-medium text-gray-900">{selectedRequest.lender_name}</p>
                    {selectedRequest.lender_company && (
                      <p className="text-sm text-gray-600">{selectedRequest.lender_company}</p>
                    )}
                    {selectedRequest.lender_email && (
                      <p className="text-sm text-gray-600">{selectedRequest.lender_email}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {selectedRequest.status === 'approved' && selectedRequest.approved_amount && (
              <div className="border-t pt-6 mb-6 bg-green-50 p-4 rounded-lg">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-semibold text-green-900">Approval Details</h3>
                  {selectedRequest.loan_type === 'pre_approval' && (
                    <button
                      onClick={() => generatePreApprovalLetter(selectedRequest)}
                      className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Pre-Approval Letter</span>
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-green-800">
                      {selectedRequest.loan_type === 'loan_approval' ? 'Final Loan Amount:' : 'Approved Amount:'}
                    </span>
                    <span className="text-lg font-bold text-green-900">
                      {formatCurrency(selectedRequest.loan_type === 'loan_approval' && selectedRequest.final_loan_amount
                        ? selectedRequest.final_loan_amount
                        : selectedRequest.approved_amount)}
                    </span>
                  </div>
                  {selectedRequest.approval_date && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-green-800">Approval Date:</span>
                      <span className="text-sm font-medium text-green-900">
                        {formatDate(selectedRequest.approval_date)}
                      </span>
                    </div>
                  )}
                  {selectedRequest.loan_type === 'loan_approval' && selectedRequest.loan_approval_date && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-green-800">Final Loan Approval Date:</span>
                      <span className="text-sm font-medium text-green-900">
                        {formatDate(selectedRequest.loan_approval_date)}
                      </span>
                    </div>
                  )}
                  {selectedRequest.loan_type === 'loan_approval' && selectedRequest.loan_terms && (
                    <>
                      {selectedRequest.loan_terms.interest_rate && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-green-800">Interest Rate:</span>
                          <span className="text-sm font-medium text-green-900">
                            {selectedRequest.loan_terms.interest_rate}%
                          </span>
                        </div>
                      )}
                      {selectedRequest.loan_terms.loan_term_years && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-green-800">Loan Term:</span>
                          <span className="text-sm font-medium text-green-900">
                            {selectedRequest.loan_terms.loan_term_years} years
                          </span>
                        </div>
                      )}
                      {selectedRequest.loan_terms.monthly_payment && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-green-800">Estimated Monthly Payment:</span>
                          <span className="text-sm font-medium text-green-900">
                            {formatCurrency(selectedRequest.loan_terms.monthly_payment)}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                  {selectedRequest.loan_type === 'loan_approval' && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-green-200">
                      <span className="text-sm text-green-800">All Documents Complete:</span>
                      <span className={`text-sm font-medium ${selectedRequest.loan_documents_complete ? 'text-green-900' : 'text-yellow-800'}`}>
                        {selectedRequest.loan_documents_complete ? 'Yes ✓' : 'Pending'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedRequest.lender_notes && (
              <div className="border-t pt-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Lender Notes</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedRequest.lender_notes}</p>
                </div>
              </div>
            )}

            {selectedRequest.additional_notes && (
              <div className="border-t pt-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Additional Notes</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedRequest.additional_notes}</p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              Uploaded Documents ({documents.length})
            </h3>

            {documentsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>No documents uploaded yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {['personal_identification', 'income_employment', 'assets_savings', 'debts_liabilities'].map(
                  (section) => {
                    const sectionDocs = documents.filter((doc) => doc.section === section);
                    if (sectionDocs.length === 0) return null;

                    return (
                      <div key={section} className="border-l-4 border-blue-500 pl-4">
                        <h4 className="font-medium text-gray-900 mb-2">{getSectionLabel(section)}</h4>
                        <div className="space-y-2">
                          {sectionDocs.map((doc) => (
                            <div
                              key={doc.id}
                              className="flex items-center justify-between bg-gray-50 p-3 rounded"
                            >
                              <div className="flex items-center flex-1">
                                <FileText className="w-4 h-4 text-gray-400 mr-2" />
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{doc.document_name}</p>
                                  <p className="text-xs text-gray-500">
                                    Uploaded {formatDate(doc.uploaded_at)}
                                  </p>
                                </div>
                              </div>
                              <a
                                href={doc.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                              >
                                View
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Pre-Approvals & Loan Approvals</h1>
              <p className="text-gray-600 mt-1">Track pre-approvals and final loan approvals from your lender</p>
            </div>
            <button
              onClick={() => navigate('/pre-approval-form')}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              New Pre-Approval Request
            </button>
          </div>
        </div>

        {requests.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Requests or Approvals</h3>
            <p className="text-gray-600 mb-6">
              You haven't submitted any pre-approval requests yet, and your lender hasn't sent any final loan approvals. Get started by submitting your first pre-approval request.
            </p>
            <button
              onClick={() => navigate('/pre-approval-form')}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center"
            >
              <FileText className="w-5 h-5 mr-2" />
              Submit Pre-Approval Request
            </button>
          </div>
        ) : (
          <div className="grid gap-6">
            {requests.map((request) => (
              <div key={request.id} className={`bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow ${
                request.loan_type === 'loan_approval' ? 'border-l-4 border-purple-500' : 'border-l-4 border-blue-500'
              }`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        request.loan_type === 'loan_approval'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {getRequestTypeLabel(request.loan_type)}
                      </span>
                      {getStatusIcon(request.status)}
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(request.status)}`}>
                        {request.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {request.loan_type === 'loan_approval' ? 'Received on' : 'Submitted on'} {formatDate(request.created_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleViewDetails(request)}
                    className="bg-blue-50 text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors flex items-center"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Details
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">
                      {request.loan_type === 'loan_approval' ? 'Final Loan Amount' : 'Requested Amount'}
                    </p>
                    <p className="text-lg font-semibold text-gray-900">
                      {request.loan_type === 'loan_approval' && request.final_loan_amount
                        ? formatCurrency(request.final_loan_amount)
                        : formatCurrency(request.requested_amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Property Type</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {getPropertyTypeLabel(request.property_type)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Documents</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {request.document_count} uploaded
                      {request.loan_type === 'loan_approval' && request.loan_documents_complete && (
                        <span className="ml-2 text-green-600">✓</span>
                      )}
                    </p>
                  </div>
                </div>

                {request.lender_name && request.lender_name !== 'Not assigned' && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm text-gray-600">Assigned to:</p>
                    <p className="font-medium text-gray-900">{request.lender_name}</p>
                    {request.lender_company && (
                      <p className="text-sm text-gray-600">{request.lender_company}</p>
                    )}
                  </div>
                )}

                {request.status === 'approved' && request.approved_amount && (
                  <div className="mt-4 pt-4 border-t bg-green-50 -mx-6 -mb-6 px-6 py-4 rounded-b-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm text-green-800 font-medium">
                          {request.loan_type === 'loan_approval' ? 'Final Loan Amount' : 'Approved Amount'}
                        </p>
                        <p className="text-2xl font-bold text-green-900">
                          {formatCurrency(request.loan_type === 'loan_approval' && request.final_loan_amount
                            ? request.final_loan_amount
                            : request.approved_amount)}
                        </p>
                        {request.loan_type === 'loan_approval' && request.loan_terms?.interest_rate && (
                          <p className="text-sm text-green-800 mt-1">
                            {request.loan_terms.interest_rate}% APR • {request.loan_terms.loan_term_years || 30} years
                          </p>
                        )}
                      </div>
                      <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                    {request.loan_type === 'pre_approval' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          generatePreApprovalLetter(request);
                        }}
                        className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors w-full justify-center"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download Pre-Approval Letter</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
