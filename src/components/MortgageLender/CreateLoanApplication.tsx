import { useState, useEffect } from 'react';
import { ArrowLeft, Send, DollarSign, Percent, Calendar, FileText, User, Upload, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from '../Navigation/Router';

type Buyer = {
  id: string;
  full_name: string;
  email: string;
};

type DocumentFile = {
  file: File;
  description: string;
  document_type: string;
};

export function CreateLoanApplication() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [selectedBuyerId, setSelectedBuyerId] = useState('');
  const [applicationType, setApplicationType] = useState<'full_application' | 'refinance'>('full_application');
  const [loanAmount, setLoanAmount] = useState('');
  const [loanType, setLoanType] = useState('conventional');
  const [propertyType, setPropertyType] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [downPaymentAmount, setDownPaymentAmount] = useState('');
  const [estimatedClosingDate, setEstimatedClosingDate] = useState('');
  const [notes, setNotes] = useState('');
  const [documents, setDocuments] = useState<DocumentFile[]>([]);

  useEffect(() => {
    loadBuyers();
  }, []);

  const loadBuyers = async () => {
    setLoading(true);
    try {
      const { data: preApprovals, error } = await supabase
        .from('pre_approval_requests')
        .select('buyer_id')
        .eq('lender_id', user!.id)
        .eq('status', 'approved');

      if (error) throw error;

      if (!preApprovals || preApprovals.length === 0) {
        setBuyers([]);
        return;
      }

      const uniqueBuyerIds = [...new Set(preApprovals.map(pa => pa.buyer_id))];

      const buyersData = await Promise.all(
        uniqueBuyerIds.map(async (buyerId) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', buyerId)
            .maybeSingle();

          const { data: email } = await supabase.rpc('get_user_email', {
            user_id: buyerId,
          });

          return {
            id: buyerId,
            full_name: profile?.full_name || 'Unknown',
            email: email || 'Not provided',
          };
        })
      );

      setBuyers(buyersData.filter(b => b.id));
    } catch (error) {
      console.error('Error loading buyers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newDocuments: DocumentFile[] = [];
      Array.from(files).forEach((file) => {
        newDocuments.push({
          file,
          description: '',
          document_type: 'loan_application',
        });
      });
      setDocuments([...documents, ...newDocuments]);
    }
    e.target.value = '';
  };

  const removeDocument = (index: number) => {
    setDocuments(documents.filter((_, i) => i !== index));
  };

  const updateDocumentDescription = (index: number, description: string) => {
    const updated = [...documents];
    updated[index].description = description;
    setDocuments(updated);
  };

  const updateDocumentType = (index: number, type: string) => {
    const updated = [...documents];
    updated[index].document_type = type;
    setDocuments(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedBuyerId || !loanAmount || !loanType || !propertyType) {
      alert('Please fill in all required fields including Property Type');
      return;
    }

    setSubmitting(true);
    try {
      const { data: application, error: appError } = await supabase
        .from('loan_applications')
        .insert({
          lender_id: user!.id,
          buyer_id: selectedBuyerId,
          application_type: applicationType,
          status: 'pending_review',
          loan_amount: parseFloat(loanAmount),
          loan_type: loanType,
          property_type: propertyType || null,
          interest_rate: interestRate ? parseFloat(interestRate) : null,
          down_payment_amount: downPaymentAmount ? parseFloat(downPaymentAmount) : null,
          estimated_closing_date: estimatedClosingDate || null,
          notes,
        })
        .select()
        .single();

      if (appError) throw appError;

      if (documents.length > 0) {
        for (const doc of documents) {
          const fileExt = doc.file.name.split('.').pop();
          const fileName = `${application.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('application-documents')
            .upload(fileName, doc.file);

          if (uploadError) {
            console.error('Error uploading document:', uploadError);
            continue;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('application-documents')
            .getPublicUrl(fileName);

          await supabase.from('application_documents').insert({
            application_id: application.id,
            file_name: doc.file.name,
            file_type: doc.file.type,
            file_size: doc.file.size,
            storage_path: fileName,
            document_type: doc.document_type,
            description: doc.description,
            uploaded_by: user!.id,
          });
        }
      }

      alert('Loan application created and sent to buyer successfully!');
      navigate('/lender/applications');
    } catch (error) {
      console.error('Error creating loan application:', error);
      alert('Failed to create loan application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (value: string) => {
    if (!value) return '';
    const num = parseFloat(value);
    return isNaN(num) ? '' : num.toLocaleString('en-US');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/lender/applications')}
          className="flex items-center text-blue-600 hover:text-blue-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Applications
        </button>

        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Loan Application</h1>
            <p className="text-gray-600">
              Create a new loan application and send it to a buyer to complete and submit
            </p>
          </div>

          {buyers.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Approved Pre-Approvals</h3>
              <p className="text-gray-600 mb-6">
                You need to have approved pre-approval requests before you can create loan applications for buyers.
              </p>
              <button
                onClick={() => navigate('/lender/pre-approval-requests')}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                View Pre-Approvals
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <User className="w-4 h-4 inline mr-1" />
                  Select Buyer <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedBuyerId}
                  onChange={(e) => setSelectedBuyerId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Choose a buyer...</option>
                  {buyers.map((buyer) => (
                    <option key={buyer.id} value={buyer.id}>
                      {buyer.full_name} ({buyer.email})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-sm text-gray-500">
                  Only buyers with approved pre-approvals are shown
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Application Type <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setApplicationType('full_application')}
                    className={`p-4 border-2 rounded-lg transition ${
                      applicationType === 'full_application'
                        ? 'border-blue-600 bg-blue-50 text-blue-900'
                        : 'border-gray-300 hover:border-blue-300'
                    }`}
                  >
                    <FileText className="w-6 h-6 mx-auto mb-2" />
                    <p className="font-medium">Purchase</p>
                    <p className="text-xs text-gray-600 mt-1">Buying a new property</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setApplicationType('refinance')}
                    className={`p-4 border-2 rounded-lg transition ${
                      applicationType === 'refinance'
                        ? 'border-blue-600 bg-blue-50 text-blue-900'
                        : 'border-gray-300 hover:border-blue-300'
                    }`}
                  >
                    <FileText className="w-6 h-6 mx-auto mb-2" />
                    <p className="font-medium">Refinance</p>
                    <p className="text-xs text-gray-600 mt-1">Refinancing existing loan</p>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <DollarSign className="w-4 h-4 inline mr-1" />
                    Loan Amount <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={loanAmount}
                    onChange={(e) => setLoanAmount(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="350000"
                    required
                  />
                  {loanAmount && (
                    <p className="mt-1 text-sm text-gray-500">
                      {formatCurrency(loanAmount)} USD
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Loan Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={loanType}
                    onChange={(e) => setLoanType(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="conventional">Conventional</option>
                    <option value="fha">FHA</option>
                    <option value="va">VA</option>
                    <option value="usda">USDA</option>
                    <option value="jumbo">Jumbo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Property Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select property type</option>
                    <option value="single_family">Single Family Home</option>
                    <option value="condo">Condo</option>
                    <option value="townhouse">Townhouse</option>
                    <option value="multi_family">Multi-Family</option>
                    <option value="manufactured">Manufactured/Mobile Home</option>
                    <option value="land">Land</option>
                    <option value="commercial">Commercial</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Percent className="w-4 h-4 inline mr-1" />
                    Interest Rate (APR)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="6.5"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Optional - can be finalized later
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <DollarSign className="w-4 h-4 inline mr-1" />
                    Down Payment Amount
                  </label>
                  <input
                    type="number"
                    value={downPaymentAmount}
                    onChange={(e) => setDownPaymentAmount(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="70000"
                  />
                  {downPaymentAmount && loanAmount && (
                    <p className="mt-1 text-sm text-gray-500">
                      {((parseFloat(downPaymentAmount) / parseFloat(loanAmount)) * 100).toFixed(1)}% down
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Estimated Closing Date
                  </label>
                  <input
                    type="date"
                    value={estimatedClosingDate}
                    onChange={(e) => setEstimatedClosingDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes for Buyer
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Add any instructions or information for the buyer to complete this application..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Upload className="w-4 h-4 inline mr-1" />
                  Upload Documents
                </label>
                <p className="text-sm text-gray-500 mb-3">
                  Upload loan agreements, disclosure forms, or other required documents for the buyer
                </p>

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                  <input
                    type="file"
                    id="document-upload"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  />
                  <label
                    htmlFor="document-upload"
                    className="cursor-pointer flex flex-col items-center"
                  >
                    <Upload className="w-12 h-12 text-gray-400 mb-2" />
                    <span className="text-blue-600 font-medium">Click to upload documents</span>
                    <span className="text-sm text-gray-500 mt-1">
                      PDF, DOC, DOCX, JPG, PNG (Max 10MB each)
                    </span>
                  </label>
                </div>

                {documents.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <p className="text-sm font-medium text-gray-700">
                      Uploaded Documents ({documents.length})
                    </p>
                    {documents.map((doc, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-blue-600" />
                            <div>
                              <p className="font-medium text-gray-900">{doc.file.name}</p>
                              <p className="text-xs text-gray-500">
                                {(doc.file.size / 1024).toFixed(2)} KB
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeDocument(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Document Type
                            </label>
                            <select
                              value={doc.document_type}
                              onChange={(e) => updateDocumentType(index, e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="loan_application">Loan Application</option>
                              <option value="loan_agreement">Loan Agreement</option>
                              <option value="disclosure">Disclosure Form</option>
                              <option value="terms">Terms & Conditions</option>
                              <option value="fee_schedule">Fee Schedule</option>
                              <option value="checklist">Document Checklist</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Description (Optional)
                            </label>
                            <input
                              type="text"
                              value={doc.description}
                              onChange={(e) => updateDocumentDescription(index, e.target.value)}
                              placeholder="Brief description"
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">What happens next?</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• The buyer will be notified about this new loan application</li>
                  <li>• They can view and complete any required information</li>
                  <li>• You'll be able to track the application status in your dashboard</li>
                  <li>• You can update the application details and status as needed</li>
                </ul>
              </div>

              <div className="border-t pt-6">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Creating Application...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5 mr-2" />
                      Create and Send to Buyer
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
