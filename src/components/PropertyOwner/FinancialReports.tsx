import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from '../Navigation/Router';
import {
  ArrowLeft,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  FileText,
  PieChart,
  BarChart3
} from 'lucide-react';

type RentalAgreement = {
  id: string;
  property_id: string;
  renter_id: string;
  monthly_rent: number;
  security_deposit: number;
  lease_start_date: string;
  lease_end_date: string;
  status: string;
  property?: {
    address_line1: string;
    city: string;
    state: string;
  };
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

type MonthlyReport = {
  month: string;
  totalIncome: number;
  totalExpected: number;
  collectionRate: number;
  onTimePayments: number;
  latePayments: number;
  pendingPayments: number;
};

export function FinancialReports() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [agreements, setAgreements] = useState<RentalAgreement[]>([]);
  const [payments, setPayments] = useState<RentPayment[]>([]);
  const [monthlyReports, setMonthlyReports] = useState<MonthlyReport[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedRenter, setSelectedRenter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFinancialData();
  }, [user, selectedYear, selectedRenter]);

  const loadFinancialData = async () => {
    if (!user) return;

    try {
      const { data: agreementsData, error: agreementsError } = await supabase
        .from('rental_agreements')
        .select(`
          *,
          property:properties(address_line1, city, state),
          renter:profiles!rental_agreements_renter_id_fkey(full_name)
        `)
        .eq('property_owner_id', user.id);

      if (agreementsError) throw agreementsError;
      setAgreements(agreementsData || []);

      let filteredAgreements = agreementsData || [];
      if (selectedRenter !== 'all') {
        filteredAgreements = filteredAgreements.filter(a => a.renter_id === selectedRenter);
      }

      const agreementIds = filteredAgreements.map(a => a.id);

      if (agreementIds.length > 0) {
        const { data: paymentsData, error: paymentsError } = await supabase
          .from('rent_payments')
          .select('*')
          .in('rental_agreement_id', agreementIds)
          .gte('due_date', `${selectedYear}-01-01`)
          .lte('due_date', `${selectedYear}-12-31`)
          .order('due_date', { ascending: true });

        if (paymentsError) throw paymentsError;
        setPayments(paymentsData || []);

        generateMonthlyReports(paymentsData || []);
      } else {
        setPayments([]);
        generateMonthlyReports([]);
      }
    } catch (error) {
      console.error('Error loading financial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateMonthlyReports = (paymentsData: RentPayment[]) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const reports: MonthlyReport[] = months.map((month, index) => {
      const monthPayments = paymentsData.filter(p => {
        const paymentDate = new Date(p.due_date);
        return paymentDate.getMonth() === index && paymentDate.getFullYear() === selectedYear;
      });

      const totalIncome = monthPayments
        .filter(p => p.status === 'paid')
        .reduce((sum, p) => sum + Number(p.amount), 0);

      const totalExpected = monthPayments.reduce((sum, p) => sum + Number(p.amount), 0);

      const collectionRate = totalExpected > 0 ? (totalIncome / totalExpected) * 100 : 0;

      const onTimePayments = monthPayments.filter(
        p => p.status === 'paid' && p.paid_date && new Date(p.paid_date) <= new Date(p.due_date)
      ).length;

      const latePayments = monthPayments.filter(p => p.status === 'late').length;
      const pendingPayments = monthPayments.filter(p => p.status === 'pending').length;

      return {
        month,
        totalIncome,
        totalExpected,
        collectionRate,
        onTimePayments,
        latePayments,
        pendingPayments,
      };
    });

    setMonthlyReports(reports);
  };

  const exportToCSV = () => {
    const selectedRenterName = selectedRenter === 'all'
      ? 'all-renters'
      : agreements.find(a => a.renter_id === selectedRenter)?.renter?.full_name?.replace(/\s+/g, '-').toLowerCase() || 'unknown';

    const headers = ['Month', 'Income Collected', 'Expected Income', 'Collection Rate %', 'On-Time Payments', 'Late Payments', 'Pending Payments'];
    const rows = monthlyReports.map(report => [
      report.month,
      report.totalIncome.toFixed(2),
      report.totalExpected.toFixed(2),
      report.collectionRate.toFixed(1),
      report.onTimePayments,
      report.latePayments,
      report.pendingPayments,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financial-report-${selectedRenterName}-${selectedYear}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const yearlyTotalIncome = monthlyReports.reduce((sum, r) => sum + r.totalIncome, 0);
  const yearlyExpectedIncome = monthlyReports.reduce((sum, r) => sum + r.totalExpected, 0);
  const yearlyCollectionRate = yearlyExpectedIncome > 0 ? (yearlyTotalIncome / yearlyExpectedIncome) * 100 : 0;
  const yearlyOnTimePayments = monthlyReports.reduce((sum, r) => sum + r.onTimePayments, 0);
  const yearlyLatePayments = monthlyReports.reduce((sum, r) => sum + r.latePayments, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading financial reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => navigate('/property-owner/dashboard')}
          className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition mb-6 group"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Back to Dashboard</span>
        </button>

        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl shadow-lg">
                <FileText className="text-white" size={32} />
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-blue-900 to-gray-900 bg-clip-text text-transparent">
                  Financial Reports
                </h1>
                <p className="text-gray-600 text-lg mt-1">
                  {selectedRenter === 'all'
                    ? 'Comprehensive rental income analysis'
                    : `Reports for ${agreements.find(a => a.renter_id === selectedRenter)?.renter?.full_name || 'Unknown Renter'}`
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedRenter}
                onChange={(e) => setSelectedRenter(e.target.value)}
                className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 font-semibold"
              >
                <option value="all">All Renters</option>
                {agreements
                  .filter((agreement, index, self) =>
                    index === self.findIndex(a => a.renter_id === agreement.renter_id)
                  )
                  .map((agreement) => (
                    <option key={agreement.renter_id} value={agreement.renter_id}>
                      {agreement.renter?.full_name || 'Unknown Renter'}
                    </option>
                  ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 font-semibold"
              >
                {[...Array(5)].map((_, i) => {
                  const year = new Date().getFullYear() - i;
                  return <option key={year} value={year}>{year}</option>;
                })}
              </select>
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold shadow-md hover:shadow-lg"
              >
                <Download size={20} />
                Export CSV
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-600">Total Income ({selectedYear})</h3>
              <DollarSign className="text-green-500" size={24} />
            </div>
            <p className="text-3xl font-bold text-gray-900">${yearlyTotalIncome.toLocaleString()}</p>
            <p className="text-sm text-gray-500 mt-1">Collected from rent payments</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-600">Expected Income</h3>
              <TrendingUp className="text-blue-500" size={24} />
            </div>
            <p className="text-3xl font-bold text-gray-900">${yearlyExpectedIncome.toLocaleString()}</p>
            <p className="text-sm text-gray-500 mt-1">Total scheduled payments</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-emerald-500">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-600">Collection Rate</h3>
              <PieChart className="text-emerald-500" size={24} />
            </div>
            <p className="text-3xl font-bold text-gray-900">{yearlyCollectionRate.toFixed(1)}%</p>
            <p className="text-sm text-gray-500 mt-1">Income vs expected</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-amber-500">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-600">Payment Status</h3>
              <BarChart3 className="text-amber-500" size={24} />
            </div>
            <div className="flex items-center gap-3">
              <div>
                <p className="text-xl font-bold text-green-600">{yearlyOnTimePayments}</p>
                <p className="text-xs text-gray-500">On-time</p>
              </div>
              <div className="w-px h-10 bg-gray-300"></div>
              <div>
                <p className="text-xl font-bold text-red-600">{yearlyLatePayments}</p>
                <p className="text-xs text-gray-500">Late</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6">
            <div className="flex items-center gap-3">
              <Calendar className="text-white" size={24} />
              <h2 className="text-2xl font-bold text-white">Monthly Breakdown - {selectedYear}</h2>
            </div>
          </div>
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Month</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Income Collected</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Expected Income</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Collection Rate</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">On-Time</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Late</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyReports.map((report, index) => (
                    <tr
                      key={report.month}
                      className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                        index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                      }`}
                    >
                      <td className="py-4 px-4 font-medium text-gray-900">{report.month}</td>
                      <td className="py-4 px-4 text-right">
                        <span className="text-green-600 font-semibold">
                          ${report.totalIncome.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right text-gray-700">
                        ${report.totalExpected.toLocaleString()}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {report.collectionRate >= 90 ? (
                            <TrendingUp className="text-green-500" size={16} />
                          ) : (
                            <TrendingDown className="text-red-500" size={16} />
                          )}
                          <span className={`font-semibold ${
                            report.collectionRate >= 90 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {report.collectionRate.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-700 font-semibold">
                          {report.onTimePayments}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-700 font-semibold">
                          {report.latePayments}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-yellow-100 text-yellow-700 font-semibold">
                          {report.pendingPayments}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Income Trend</h3>
            <div className="space-y-3">
              {monthlyReports.slice(0, 6).map((report) => (
                <div key={report.month} className="flex items-center gap-3">
                  <div className="w-20 text-sm font-medium text-gray-600">{report.month.slice(0, 3)}</div>
                  <div className="flex-1 bg-gray-200 rounded-full h-6 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full flex items-center justify-end pr-2"
                      style={{
                        width: `${report.totalExpected > 0 ? (report.totalIncome / report.totalExpected) * 100 : 0}%`,
                        minWidth: report.totalIncome > 0 ? '40px' : '0'
                      }}
                    >
                      {report.totalIncome > 0 && (
                        <span className="text-xs font-semibold text-white">
                          ${report.totalIncome.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Payment Performance</h3>
            <div className="space-y-4">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-green-700">On-Time Payments</span>
                  <span className="text-2xl font-bold text-green-700">{yearlyOnTimePayments}</span>
                </div>
                <div className="w-full bg-green-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{
                      width: `${((yearlyOnTimePayments / (yearlyOnTimePayments + yearlyLatePayments)) * 100) || 0}%`
                    }}
                  ></div>
                </div>
              </div>
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-red-700">Late Payments</span>
                  <span className="text-2xl font-bold text-red-700">{yearlyLatePayments}</span>
                </div>
                <div className="w-full bg-red-200 rounded-full h-2">
                  <div
                    className="bg-red-600 h-2 rounded-full"
                    style={{
                      width: `${((yearlyLatePayments / (yearlyOnTimePayments + yearlyLatePayments)) * 100) || 0}%`
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
