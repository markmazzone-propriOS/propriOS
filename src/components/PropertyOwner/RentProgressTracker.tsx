import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { DollarSign, CheckCircle, AlertCircle, Clock, TrendingUp, FileText } from 'lucide-react';
import { useNavigate } from '../Navigation/Router';

type RentalAgreement = {
  id: string;
  renter_id: string;
  monthly_rent: number;
  payment_due_day: number;
  renter?: {
    full_name: string;
  };
};

type RentPayment = {
  id: string;
  rental_agreement_id: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: 'pending' | 'paid' | 'late' | 'partial';
};

type RenterPaymentSummary = {
  renterId: string;
  renterName: string;
  agreementId: string;
  monthlyRent: number;
  payments: RentPayment[];
  totalPaid: number;
  totalDue: number;
  paidOnTime: number;
  latePayments: number;
  pendingPayments: number;
};

type RentProgressTrackerProps = {
  agreements: RentalAgreement[];
};

export function RentProgressTracker({ agreements }: RentProgressTrackerProps) {
  const navigate = useNavigate();
  const [paymentSummaries, setPaymentSummaries] = useState<RenterPaymentSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPaymentData();
  }, [agreements]);

  const loadPaymentData = async () => {
    if (agreements.length === 0) {
      setLoading(false);
      return;
    }

    try {
      const agreementIds = agreements.map(a => a.id);

      const { data: payments, error } = await supabase
        .from('rent_payments')
        .select('*')
        .in('rental_agreement_id', agreementIds)
        .order('due_date', { ascending: false });

      if (error) throw error;

      const summaries: RenterPaymentSummary[] = agreements.map(agreement => {
        const agreementPayments = (payments || []).filter(
          p => p.rental_agreement_id === agreement.id
        );

        const totalPaid = agreementPayments
          .filter(p => p.status === 'paid')
          .reduce((sum, p) => sum + Number(p.amount), 0);

        const totalDue = agreementPayments
          .reduce((sum, p) => sum + Number(p.amount), 0);

        const paidOnTime = agreementPayments.filter(
          p => p.status === 'paid' && p.paid_date && new Date(p.paid_date) <= new Date(p.due_date)
        ).length;

        const latePayments = agreementPayments.filter(p => p.status === 'late').length;
        const pendingPayments = agreementPayments.filter(p => p.status === 'pending').length;

        return {
          renterId: agreement.renter_id,
          renterName: agreement.renter?.full_name || 'Unknown',
          agreementId: agreement.id,
          monthlyRent: agreement.monthly_rent,
          payments: agreementPayments,
          totalPaid,
          totalDue,
          paidOnTime,
          latePayments,
          pendingPayments,
        };
      });

      setPaymentSummaries(summaries);
    } catch (error) {
      console.error('Error loading payment data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/2"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (paymentSummaries.length === 0) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <TrendingUp className="text-blue-600" size={24} />
          <h2 className="text-xl font-bold text-gray-900">Rent Progress Tracker</h2>
        </div>
        <div className="text-center py-12">
          <DollarSign className="mx-auto text-gray-400 mb-3" size={48} />
          <p className="text-gray-600">No payment data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <TrendingUp className="text-blue-600" size={24} />
          <h2 className="text-xl font-bold text-gray-900">Rent Progress Tracker</h2>
        </div>
        <button
          onClick={() => navigate('/property-owner/financial-reports')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold shadow-md hover:shadow-lg"
        >
          <FileText size={18} />
          Financial Reports
        </button>
      </div>

      <div className="space-y-6">
        {paymentSummaries.map((summary) => {
          const paymentRate = summary.totalDue > 0
            ? (summary.totalPaid / summary.totalDue) * 100
            : 0;
          const onTimeRate = summary.payments.length > 0
            ? (summary.paidOnTime / summary.payments.length) * 100
            : 0;

          return (
            <div
              key={summary.agreementId}
              className="border border-gray-200 rounded-lg p-5 hover:border-blue-300 transition"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg">
                    {summary.renterName}
                  </h3>
                  <p className="text-sm text-gray-600">
                    ${summary.monthlyRent.toLocaleString()}/month
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Payment Progress</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {paymentRate.toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-green-500 h-3 rounded-full transition-all"
                    style={{ width: `${Math.min(paymentRate, 100)}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  ${summary.totalPaid.toLocaleString()} of ${summary.totalDue.toLocaleString()} paid
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle size={16} className="text-green-600" />
                    <span className="text-xs text-green-700 font-medium">On Time</span>
                  </div>
                  <p className="text-lg font-bold text-green-700">{summary.paidOnTime}</p>
                  <p className="text-xs text-green-600">{onTimeRate.toFixed(0)}% rate</p>
                </div>

                <div className="bg-red-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle size={16} className="text-red-600" />
                    <span className="text-xs text-red-700 font-medium">Late</span>
                  </div>
                  <p className="text-lg font-bold text-red-700">{summary.latePayments}</p>
                  <p className="text-xs text-red-600">payments</p>
                </div>

                <div className="bg-yellow-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock size={16} className="text-yellow-600" />
                    <span className="text-xs text-yellow-700 font-medium">Pending</span>
                  </div>
                  <p className="text-lg font-bold text-yellow-700">{summary.pendingPayments}</p>
                  <p className="text-xs text-yellow-600">payments</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
