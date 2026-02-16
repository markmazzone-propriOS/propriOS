import { useState, useEffect } from 'react';
import { ArrowLeft, Send, DollarSign, Percent, Calendar, FileCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from '../Navigation/Router';

type Buyer = {
  id: string;
  full_name: string;
  email: string;
};

export function SendFinalLoanApproval() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [selectedBuyerId, setSelectedBuyerId] = useState('');
  const [finalLoanAmount, setFinalLoanAmount] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [loanTermYears, setLoanTermYears] = useState('30');
  const [monthlyPayment, setMonthlyPayment] = useState('');
  const [propertyType, setPropertyType] = useState('single_family');
  const [lenderNotes, setLenderNotes] = useState('');
  const [documentsComplete, setDocumentsComplete] = useState(false);

  useEffect(() => {
    loadBuyers();
  }, []);

  useEffect(() => {
    if (finalLoanAmount && interestRate && loanTermYears) {
      calculateMonthlyPayment();
    }
  }, [finalLoanAmount, interestRate, loanTermYears]);

  const loadBuyers = async () => {
    setLoading(true);
    try {
      const { data: preApprovals, error } = await supabase
        .from('pre_approval_requests')
        .select('buyer_id')
        .eq('lender_id', user!.id)
        .eq('loan_type', 'pre_approval')
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

  const calculateMonthlyPayment = () => {
    const principal = parseFloat(finalLoanAmount);
    const annualRate = parseFloat(interestRate);
    const years = parseFloat(loanTermYears);

    if (!principal || !annualRate || !years) return;

    const monthlyRate = annualRate / 100 / 12;
    const numPayments = years * 12;

    const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);

    setMonthlyPayment(payment.toFixed(2));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedBuyerId || !finalLoanAmount || !interestRate || !loanTermYears) {
      alert('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const loanTerms = {
        interest_rate: parseFloat(interestRate),
        loan_term_years: parseFloat(loanTermYears),
        monthly_payment: parseFloat(monthlyPayment),
      };

      const { error } = await supabase
        .from('pre_approval_requests')
        .insert({
          buyer_id: selectedBuyerId,
          lender_id: user!.id,
          loan_type: 'loan_approval',
          requested_amount: parseFloat(finalLoanAmount),
          final_loan_amount: parseFloat(finalLoanAmount),
          annual_income: 0,
          credit_score: null,
          down_payment_percentage: 20,
          employment_status: 'full_time',
          property_type: propertyType,
          status: 'approved',
          approved_amount: parseFloat(finalLoanAmount),
          approval_date: new Date().toISOString(),
          loan_approval_date: new Date().toISOString(),
          loan_terms: loanTerms,
          loan_documents_complete: documentsComplete,
          lender_notes,
        });

      if (error) throw error;

      alert('Final loan approval sent to buyer successfully!');
      navigate('/lender/pre-approvals');
    } catch (error) {
      console.error('Error sending loan approval:', error);
      alert('Failed to send loan approval. Please try again.');
    } finally {
      setSubmitting(false);
    }
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
          onClick={() => navigate('/lender/dashboard')}
          className="flex items-center text-blue-600 hover:text-blue-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </button>

        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Send Final Loan Approval</h1>
            <p className="text-gray-600">
              Send a final approved loan package to a buyer with complete loan terms and details
            </p>
          </div>

          {buyers.length === 0 ? (
            <div className="text-center py-12">
              <FileCheck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Approved Pre-Approvals</h3>
              <p className="text-gray-600 mb-6">
                You need to have approved pre-approval requests before you can send final loan approvals.
              </p>
              <button
                onClick={() => navigate('/lender/pre-approvals')}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                View Pre-Approvals
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <DollarSign className="w-4 h-4 inline mr-1" />
                    Final Loan Amount <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={finalLoanAmount}
                    onChange={(e) => setFinalLoanAmount(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="350000"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Percent className="w-4 h-4 inline mr-1" />
                    Interest Rate (APR) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="6.5"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Loan Term (Years) <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={loanTermYears}
                    onChange={(e) => setLoanTermYears(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="15">15 years</option>
                    <option value="20">20 years</option>
                    <option value="30">30 years</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estimated Monthly Payment
                  </label>
                  <input
                    type="text"
                    value={monthlyPayment ? `$${monthlyPayment}` : ''}
                    readOnly
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                    placeholder="Calculated automatically"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Property Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="single_family">Single Family</option>
                  <option value="condo">Condo</option>
                  <option value="townhouse">Townhouse</option>
                  <option value="multi_family">Multi-Family</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Lender Notes
                </label>
                <textarea
                  value={lenderNotes}
                  onChange={(e) => setLenderNotes(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Add any additional notes or instructions for the buyer..."
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="documentsComplete"
                  checked={documentsComplete}
                  onChange={(e) => setDocumentsComplete(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="documentsComplete" className="ml-2 text-sm text-gray-700">
                  All loan documents are complete and ready for closing
                </label>
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
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5 mr-2" />
                      Send Final Loan Approval to Buyer
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
