import { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Clock, CheckCircle, Users, Calendar, ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from '../Navigation/Router';

type AnalyticsData = {
  totalApplications: number;
  approvedLoans: number;
  deniedLoans: number;
  pendingLoans: number;
  totalVolume: number;
  avgLoanAmount: number;
  conversionRate: number;
  avgProcessingDays: number;
  monthlyApplications: { month: string; count: number }[];
  loanTypeDistribution: { type: string; count: number }[];
};

export function LenderAnalytics() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('all');

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('loan_applications')
        .select('*')
        .eq('lender_id', user!.id);

      if (timeRange !== 'all') {
        const date = new Date();
        if (timeRange === '30days') {
          date.setDate(date.getDate() - 30);
        } else if (timeRange === '90days') {
          date.setDate(date.getDate() - 90);
        } else if (timeRange === '1year') {
          date.setFullYear(date.getFullYear() - 1);
        }
        query = query.gte('created_at', date.toISOString());
      }

      const { data: applications, error } = await query;

      if (error) throw error;

      const approved = applications.filter(a => a.status === 'approved');
      const denied = applications.filter(a => a.status === 'denied');
      const pending = applications.filter(a => !['approved', 'denied', 'withdrawn'].includes(a.status));

      const totalVolume = approved.reduce((sum, app) => sum + Number(app.loan_amount), 0);
      const avgAmount = approved.length > 0 ? totalVolume / approved.length : 0;

      const conversionRate = applications.length > 0
        ? (approved.length / applications.length) * 100
        : 0;

      const processingTimes = approved
        .map(app => {
          const created = new Date(app.created_at);
          const updated = new Date(app.updated_at);
          return Math.floor((updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        });
      const avgProcessingDays = processingTimes.length > 0
        ? processingTimes.reduce((sum, days) => sum + days, 0) / processingTimes.length
        : 0;

      const monthlyData = new Map<string, number>();
      applications.forEach(app => {
        const month = new Date(app.created_at).toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric'
        });
        monthlyData.set(month, (monthlyData.get(month) || 0) + 1);
      });

      const loanTypeData = new Map<string, number>();
      applications.forEach(app => {
        loanTypeData.set(app.loan_type, (loanTypeData.get(app.loan_type) || 0) + 1);
      });

      setAnalytics({
        totalApplications: applications.length,
        approvedLoans: approved.length,
        deniedLoans: denied.length,
        pendingLoans: pending.length,
        totalVolume,
        avgLoanAmount: avgAmount,
        conversionRate,
        avgProcessingDays,
        monthlyApplications: Array.from(monthlyData.entries()).map(([month, count]) => ({
          month,
          count
        })),
        loanTypeDistribution: Array.from(loanTypeData.entries()).map(([type, count]) => ({
          type,
          count
        }))
      });
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Loading analytics...</p>
      </div>
    );
  }

  if (!analytics) return null;

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/lender/dashboard')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4 transition"
      >
        <ArrowLeft size={20} />
        <span>Back to Dashboard</span>
      </button>

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Performance Analytics</h2>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Time</option>
          <option value="30days">Last 30 Days</option>
          <option value="90days">Last 90 Days</option>
          <option value="1year">Last Year</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-600">
          <div className="flex items-center justify-between mb-3">
            <Users className="text-blue-600" size={32} />
            <span className="text-3xl font-bold text-gray-800">{analytics.totalApplications}</span>
          </div>
          <p className="text-gray-600 font-medium">Total Applications</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-600">
          <div className="flex items-center justify-between mb-3">
            <CheckCircle className="text-green-600" size={32} />
            <span className="text-3xl font-bold text-gray-800">{analytics.approvedLoans}</span>
          </div>
          <p className="text-gray-600 font-medium">Approved Loans</p>
          <p className="text-sm text-green-600 mt-1">
            {analytics.conversionRate.toFixed(1)}% conversion rate
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-600">
          <div className="flex items-center justify-between mb-3">
            <DollarSign className="text-purple-600" size={32} />
            <span className="text-2xl font-bold text-gray-800">
              {formatCurrency(analytics.totalVolume)}
            </span>
          </div>
          <p className="text-gray-600 font-medium">Total Volume</p>
          <p className="text-sm text-gray-500 mt-1">
            Avg: {formatCurrency(analytics.avgLoanAmount)}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-orange-600">
          <div className="flex items-center justify-between mb-3">
            <Clock className="text-orange-600" size={32} />
            <span className="text-3xl font-bold text-gray-800">
              {Math.round(analytics.avgProcessingDays)}
            </span>
          </div>
          <p className="text-gray-600 font-medium">Avg Processing Days</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Application Trend</h3>
          <div className="space-y-3">
            {analytics.monthlyApplications.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No data available</p>
            ) : (
              analytics.monthlyApplications.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{item.month}</span>
                  <div className="flex items-center gap-3 flex-1 mx-4">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{
                          width: `${(item.count / Math.max(...analytics.monthlyApplications.map(m => m.count))) * 100}%`
                        }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-800 w-8 text-right">
                      {item.count}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Loan Type Distribution</h3>
          <div className="space-y-3">
            {analytics.loanTypeDistribution.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No data available</p>
            ) : (
              analytics.loanTypeDistribution.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 capitalize">{item.type}</span>
                  <div className="flex items-center gap-3 flex-1 mx-4">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full"
                        style={{
                          width: `${(item.count / analytics.totalApplications) * 100}%`
                        }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-800 w-12 text-right">
                      {((item.count / analytics.totalApplications) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Pipeline Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-100 rounded-full mb-3">
              <Clock size={36} className="text-yellow-600" />
            </div>
            <p className="text-3xl font-bold text-gray-800">{analytics.pendingLoans}</p>
            <p className="text-gray-600">In Progress</p>
          </div>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-3">
              <CheckCircle size={36} className="text-green-600" />
            </div>
            <p className="text-3xl font-bold text-gray-800">{analytics.approvedLoans}</p>
            <p className="text-gray-600">Approved</p>
          </div>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-3">
              <TrendingUp size={36} className="text-red-600" />
            </div>
            <p className="text-3xl font-bold text-gray-800">{analytics.deniedLoans}</p>
            <p className="text-gray-600">Denied</p>
          </div>
        </div>
      </div>
    </div>
  );
}
