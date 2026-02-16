import { useState, useEffect, useRef } from 'react';
import {
  Upload,
  FileText,
  Check,
  X,
  Loader,
  AlertCircle,
  ArrowLeft,
  Info,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useRouter } from '../Navigation/Router';

type DocumentSection = 'personal_identification' | 'income_employment' | 'assets_savings' | 'debts_liabilities';

type UploadedDocument = {
  id: string;
  section: DocumentSection;
  document_name: string;
  file_url: string;
  uploaded_at: string;
};

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
  created_at: string;
};

export function PreApprovalRequestForm() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { currentRoute } = useRouter();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [existingRequest, setExistingRequest] = useState<PreApprovalRequest | null>(null);
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [uploadingSection, setUploadingSection] = useState<DocumentSection | null>(null);
  const [fileInputKeys, setFileInputKeys] = useState<{ [key in DocumentSection]?: number }>({
    personal_identification: 0,
    income_employment: 0,
    assets_savings: 0,
    debts_liabilities: 0,
  });

  const fileInputRefs = useRef<{ [key in DocumentSection]?: HTMLInputElement }>({});

  const [formData, setFormData] = useState({
    requested_amount: '',
    annual_income: '',
    credit_score: '',
    down_payment_percentage: '',
    employment_status: '',
    property_type: '',
    additional_notes: '',
  });

  const lenderId = currentRoute.params?.lenderId || null;
  const token = currentRoute.params?.token || null;
  const returnUrl = currentRoute.params?.returnUrl || null;

  useEffect(() => {
    if (token) {
      loadExistingRequest();
    }
  }, [token]);

  const loadExistingRequest = async () => {
    if (!token) return;

    setLoading(true);
    try {
      const { data: request, error: requestError } = await supabase
        .from('pre_approval_requests')
        .select('*')
        .eq('shareable_token', token)
        .maybeSingle();

      if (requestError) throw requestError;

      if (request) {
        setExistingRequest(request);
        setRequestId(request.id);
        setFormData({
          requested_amount: request.requested_amount?.toString() || '',
          annual_income: request.annual_income?.toString() || '',
          credit_score: request.credit_score?.toString() || '',
          down_payment_percentage: request.down_payment_percentage?.toString() || '',
          employment_status: request.employment_status || '',
          property_type: request.property_type || '',
          additional_notes: request.additional_notes || '',
        });

        const { data: docs, error: docsError } = await supabase
          .from('pre_approval_documents')
          .select('*')
          .eq('pre_approval_request_id', request.id)
          .order('uploaded_at', { ascending: false });

        if (docsError) throw docsError;
        console.log('Loaded documents from database:', docs);
        setUploadedDocuments(docs || []);
      }
    } catch (err: any) {
      console.error('Error loading request:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (section: DocumentSection, files: FileList | null) => {
    if (!files || files.length === 0) return;

    let activeRequestId = requestId;
    if (!activeRequestId) {
      const newRequestId = await createInitialRequest();
      if (!newRequestId) return;
      activeRequestId = newRequestId;
    }

    setUploadingSection(section);
    setError('');

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        // Check file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`File ${file.name} exceeds 10MB limit`);
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${activeRequestId}/${section}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('pre-approval-documents')
          .upload(fileName, file);

        if (uploadError) {
          console.error('Storage upload error:', uploadError);
          throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);
        }

        const { data: { publicUrl } } = supabase.storage
          .from('pre-approval-documents')
          .getPublicUrl(fileName);

        // Get the current session to ensure we have the latest user data
        const { data: { session } } = await supabase.auth.getSession();
        const currentUserId = session?.user?.id || user?.id;

        const { data: doc, error: docError } = await supabase
          .from('pre_approval_documents')
          .insert({
            pre_approval_request_id: activeRequestId,
            section,
            document_name: file.name,
            file_url: publicUrl,
            uploaded_by: currentUserId || null,
          })
          .select()
          .single();

        if (docError) {
          console.error('Database insert error:', docError);
          throw new Error(`Failed to save ${file.name} record: ${docError.message}`);
        }

        console.log('Uploaded document:', doc);
        return doc;
      });

      const newDocs = await Promise.all(uploadPromises);
      console.log('New documents to add:', newDocs);
      setUploadedDocuments((prev) => {
        const updated = [...prev, ...newDocs];
        console.log('Updated documents list:', updated);
        return updated;
      });

      // Reset the file input by incrementing its key
      setFileInputKeys((prev) => ({
        ...prev,
        [section]: (prev[section] || 0) + 1,
      }));
    } catch (err: any) {
      console.error('Error uploading files:', err);
      setError(err.message || 'Failed to upload files. Please try again.');
    } finally {
      setUploadingSection(null);
    }
  };

  const createInitialRequest = async (): Promise<string | null> => {
    if (!lenderId) {
      setError('Invalid request link. Please contact the lender for a new link.');
      return null;
    }

    try {
      // Get the current session to ensure we have the latest user data
      const { data: { session } } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id || user?.id;

      console.log('Creating pre-approval request with:', {
        buyer_id: currentUserId,
        lender_id: lenderId,
        has_user: !!user,
        has_session: !!session,
      });

      const { data, error } = await supabase
        .from('pre_approval_requests')
        .insert({
          buyer_id: currentUserId || null,
          lender_id: lenderId,
          requested_amount: parseFloat(formData.requested_amount) || 0,
          annual_income: parseFloat(formData.annual_income) || 0,
          credit_score: formData.credit_score ? parseInt(formData.credit_score) : null,
          down_payment_percentage: parseInt(formData.down_payment_percentage) || 0,
          employment_status: formData.employment_status || 'employed',
          property_type: formData.property_type || 'single_family',
          status: 'submitted',
          additional_notes: formData.additional_notes,
        })
        .select()
        .single();

      if (error) throw error;

      console.log('Created pre-approval request:', data);
      setRequestId(data.id);
      setExistingRequest(data);
      return data.id;
    } catch (err: any) {
      console.error('Error creating request:', err);
      setError(`Failed to create request: ${err.message}`);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      // Get the current session to ensure we have the latest user data
      const { data: { session } } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id || user?.id;

      console.log('Submitting pre-approval request:', {
        has_user: !!user,
        has_session: !!session,
        user_id: currentUserId,
        existing_request_id: requestId,
      });

      let activeRequestId = requestId;
      if (!activeRequestId) {
        const newRequestId = await createInitialRequest();
        if (!newRequestId) {
          setSubmitting(false);
          return;
        }
        activeRequestId = newRequestId;
      }

      // If updating an existing request and we have a user ID, make sure it's set
      const updateData: any = {
        requested_amount: parseFloat(formData.requested_amount),
        annual_income: parseFloat(formData.annual_income),
        credit_score: formData.credit_score ? parseInt(formData.credit_score) : null,
        down_payment_percentage: parseInt(formData.down_payment_percentage),
        employment_status: formData.employment_status,
        property_type: formData.property_type,
        additional_notes: formData.additional_notes,
        status: 'submitted',
      };

      // If the request doesn't have a buyer_id yet but we have a user, set it
      if (currentUserId && existingRequest && !existingRequest.buyer_id) {
        updateData.buyer_id = currentUserId;
      }

      const { error: updateError } = await supabase
        .from('pre_approval_requests')
        .update(updateData)
        .eq('id', activeRequestId);

      if (updateError) throw updateError;

      console.log('Successfully submitted pre-approval request:', activeRequestId);

      setSuccess(true);
      setTimeout(() => {
        // If there's a return URL, go back there
        if (returnUrl) {
          navigate(returnUrl);
        } else if (user) {
          // If user is logged in, take them back to where they came from
          // This works for messages, lender profile, etc.
          navigate(-1);
        } else {
          // Anonymous users go to home page
          navigate('/');
        }
      }, 2000);
    } catch (err: any) {
      console.error('Error submitting request:', err);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const removeDocument = async (docId: string) => {
    try {
      const { error } = await supabase
        .from('pre_approval_documents')
        .delete()
        .eq('id', docId);

      if (error) throw error;

      setUploadedDocuments((prev) => prev.filter((doc) => doc.id !== docId));
    } catch (err: any) {
      console.error('Error removing document:', err);
      setError(`Failed to remove document: ${err.message}`);
    }
  };

  const getSectionDocuments = (section: DocumentSection) => {
    const filtered = uploadedDocuments.filter((doc) => doc.section === section);
    console.log(`Documents for section ${section}:`, filtered);
    return filtered;
  };

  const renderSection = (
    title: string,
    section: DocumentSection,
    requirements: string[]
  ) => {
    const docs = getSectionDocuments(section);
    const isUploading = uploadingSection === section;

    return (
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <h3 className="text-lg font-bold text-gray-800 mb-4">{title}</h3>

        <div className="space-y-3 mb-4">
          {requirements.map((req, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <div className="mt-1">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
              </div>
              <p className="text-sm text-gray-700">{req}</p>
            </div>
          ))}
        </div>

        <div className="border-t pt-4">
          <label className="block">
            <div className={`border-2 border-dashed rounded-lg p-6 text-center transition ${
              isUploading ? 'border-blue-400 bg-blue-50 cursor-wait' :
              'border-gray-300 hover:border-blue-500 cursor-pointer'
            }`}>
              <input
                key={fileInputKeys[section]}
                ref={(el) => {
                  if (el) fileInputRefs.current[section] = el;
                }}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={(e) => handleFileUpload(section, e.target.files)}
                disabled={isUploading}
                className="hidden"
              />
              {isUploading ? (
                <Loader className="mx-auto text-blue-600 animate-spin" size={32} />
              ) : (
                <Upload className="mx-auto text-gray-400" size={32} />
              )}
              <p className="mt-2 text-sm text-gray-600">
                {isUploading ? 'Uploading...' : 'Click to upload documents'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                PDF, JPG, PNG, DOC, DOCX (Max 10MB each)
              </p>
            </div>
          </label>

          {docs.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium text-gray-700">Uploaded Documents ({docs.length}):</p>
              {docs.map((doc) => {
                console.log('Rendering document:', doc.id, doc.document_name);
                return (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                  <div className="flex items-center gap-3">
                    <FileText size={20} className="text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">{doc.document_name}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(doc.uploaded_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeDocument(doc.id)}
                    className="text-red-600 hover:text-red-700 transition"
                    title="Remove document"
                  >
                    <X size={20} />
                  </button>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="text-center">
          <Loader className="inline-block animate-spin text-blue-600" size={48} />
          <p className="mt-4 text-gray-600">Loading form...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Request Submitted Successfully!</h2>
          <p className="text-gray-600">
            Your pre-approval request has been submitted. The lender will review your application and documents.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b mb-8">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="text-gray-600 hover:text-gray-800 transition"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Pre-Approval Request Form</h1>
              <p className="text-gray-600 mt-1">
                Complete this form to request mortgage pre-approval
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pb-12">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {!user && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <Info className="text-blue-600 flex-shrink-0" size={20} />
            <div>
              <p className="text-blue-800 font-medium mb-1">Optional: Create an Account</p>
              <p className="text-blue-700 text-sm">
                You can submit this form without signing in. However, if you'd like to track your request and receive updates,{' '}
                <button
                  onClick={() => navigate('/auth')}
                  className="underline font-medium hover:text-blue-900"
                >
                  create an account
                </button>.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-6">Basic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Requested Loan Amount *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    required
                    value={formData.requested_amount}
                    onChange={(e) => setFormData({ ...formData, requested_amount: e.target.value })}
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="300000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Annual Income *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    required
                    value={formData.annual_income}
                    onChange={(e) => setFormData({ ...formData, annual_income: e.target.value })}
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="75000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Credit Score (Optional)
                </label>
                <input
                  type="number"
                  value={formData.credit_score}
                  onChange={(e) => setFormData({ ...formData, credit_score: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="720"
                  min="300"
                  max="850"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Down Payment Percentage *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    value={formData.down_payment_percentage}
                    onChange={(e) => setFormData({ ...formData, down_payment_percentage: e.target.value })}
                    className="w-full pr-8 pl-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="20"
                    min="0"
                    max="100"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Employment Status *
                </label>
                <select
                  required
                  value={formData.employment_status}
                  onChange={(e) => setFormData({ ...formData, employment_status: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select status</option>
                  <option value="employed">Employed</option>
                  <option value="self_employed">Self-Employed</option>
                  <option value="retired">Retired</option>
                  <option value="unemployed">Unemployed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Property Type *
                </label>
                <select
                  required
                  value={formData.property_type}
                  onChange={(e) => setFormData({ ...formData, property_type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select type</option>
                  <option value="single_family">Single Family Home</option>
                  <option value="condo">Condominium</option>
                  <option value="townhouse">Townhouse</option>
                  <option value="multi_family">Multi-Family</option>
                </select>
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Notes (Optional)
              </label>
              <textarea
                value={formData.additional_notes}
                onChange={(e) => setFormData({ ...formData, additional_notes: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Any additional information you'd like to share..."
              />
            </div>
          </div>

          <div className="space-y-6">
            {renderSection(
              'Section 1: Personal Identification',
              'personal_identification',
              [
                'Government-issued photo ID (driver\'s license or passport)',
                'Social Security Card or Individual Taxpayer Identification Number (ITIN)',
              ]
            )}

            {renderSection(
              'Section 2: Income and Employment',
              'income_employment',
              [
                'Pay stubs from the most recent 30 days (or 60 days if paid monthly)',
                'W-2 forms from the past two years',
                'Federal tax returns from the past two years',
                'Contact information for your employers from the past two years for verification',
                'Proof of other income sources (e.g., bonuses, child support/alimony, disability, or pension payments)',
              ]
            )}

            {renderSection(
              'Section 3: Assets and Savings',
              'assets_savings',
              [
                'Bank statements (checking and savings accounts) for the past two to three months',
                'Statements for retirement accounts (401(k)s, IRAs, etc.) and investment accounts for the past two to three months',
                'Gift letters, if any part of your down payment is a monetary gift from a family member or friend',
              ]
            )}

            {renderSection(
              'Section 4: Debts and Liabilities',
              'debts_liabilities',
              [
                'A list of all outstanding debts, including account numbers, loan balances, and minimum monthly payments for:',
                '  • Credit cards',
                '  • Student loans',
                '  • Auto loans',
                '  • Personal loans',
                '  • Any existing mortgages or tax liens',
              ]
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <Info className="text-blue-600 flex-shrink-0" size={24} />
              <div>
                <h3 className="font-bold text-blue-900 mb-3">Special Circumstances</h3>
                <div className="space-y-3 text-sm text-blue-800">
                  <div>
                    <p className="font-semibold">1. Self-Employed Applicants:</p>
                    <p>
                      You will need additional documents, such as year-to-date profit and loss (P&L) statements,
                      a balance sheet, business tax returns from the past two years, and a copy of your business license.
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold">2. Rental History:</p>
                    <p>
                      For first-time homebuyers, providing proof of consistent, on-time rent payments for the past
                      12 months (e.g., canceled checks or bank statements) may be helpful or required.
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold">3. VA Loans:</p>
                    <p>
                      If you are applying for a VA loan, you will need a Certificate of Eligibility (COE) from
                      the U.S. Department of Veterans Affairs.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-8 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit Pre-Approval Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
