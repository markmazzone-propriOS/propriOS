import { useState, useEffect } from 'react';
import {
  Building2,
  TrendingUp,
  User,
  Star,
  Pencil,
  FileText,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Users,
  Calendar,
  ChevronRight,
  Calculator,
  Video,
  BarChart3
} from 'lucide-react';
import { supabase, MortgageLenderProfile } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from '../Navigation/Router';

type LoanApplication = {
  id: string;
  buyer_id: string;
  property_id: string | null;
  application_type: string;
  status: string;
  loan_amount: number;
  loan_type: string;
  interest_rate: number | null;
  estimated_closing_date: string | null;
  created_at: string;
  buyer_name?: string;
  property_address?: string;
};

type PreApprovalRequest = {
  id: string;
  buyer_id: string;
  requested_amount: number;
  annual_income: number;
  credit_score: number | null;
  status: string;
  created_at: string;
  buyer_name?: string;
};

type DashboardStats = {
  totalApplications: number;
  pendingReview: number;
  approved: number;
  inReview: number;
  totalVolume: number;
  avgLoanAmount: number;
  preApprovalRequests: number;
};

export function LenderDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [lenderProfile, setLenderProfile] = useState<MortgageLenderProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [preApprovalRequests, setPreApprovalRequests] = useState<PreApprovalRequest[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalApplications: 0,
    pendingReview: 0,
    approved: 0,
    inReview: 0,
    totalVolume: 0,
    avgLoanAmount: 0,
    preApprovalRequests: 0,
  });

  useEffect(() => {
    if (user && profile?.user_type === 'mortgage_lender') {
      loadDashboardData();
    }
  }, [user, profile]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadLenderProfile(),
        loadLoanApplications(),
        loadPreApprovalRequests(),
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLenderProfile = async () => {
    const { data, error } = await supabase
      .from('mortgage_lender_profiles')
      .select('*')
      .eq('id', user!.id)
      .maybeSingle();

    if (error) {
      console.error('Error loading lender profile:', error);
      return;
    }

    if (!data) {
      navigate('/lender/setup');
      return;
    }

    setLenderProfile(data);
  };


  const loadLoanApplications = async () => {
    console.log('🔍 Loading loan applications for lender:', user?.id);
    const { data, error } = await supabase
      .from('loan_applications')
      .select(`
        *,
        properties(address_line1, city, state, zip_code)
      `)
      .eq('lender_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Error loading applications:', error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      return;
    }

    console.log('✅ Raw loan applications data:', data);
    console.log('📊 Number of applications found:', data?.length || 0);

    const formattedApps = await Promise.all(
      data.map(async (app: any) => {
        const { data: buyerProfile, error: profileError } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', app.buyer_id)
          .single();

        if (profileError) {
          console.error('❌ Error loading buyer profile for:', app.buyer_id, profileError);
        }

        return {
          ...app,
          buyer_name: buyerProfile?.full_name || 'Unknown',
          property_address: app.properties
            ? `${app.properties.address_line1}, ${app.properties.city}, ${app.properties.state}`
            : null,
        };
      })
    );

    console.log('✅ Formatted applications:', formattedApps);
    setApplications(formattedApps);

    const totalVolume = data.reduce((sum, app) => sum + Number(app.loan_amount), 0);
    const avgAmount = data.length > 0 ? totalVolume / data.length : 0;

    setStats((prev) => ({
      ...prev,
      totalApplications: data.length,
      pendingReview: data.filter((a) => a.status === 'pending_review').length,
      approved: data.filter((a) => a.status === 'approved').length,
      inReview: data.filter((a) => a.status === 'under_review').length,
      totalVolume,
      avgLoanAmount: avgAmount,
    }));
  };

  const loadPreApprovalRequests = async () => {
    const { data, error } = await supabase
      .from('pre_approval_requests')
      .select(`
        *,
        buyer:profiles!buyer_id(full_name)
      `)
      .eq('lender_id', user!.id)
      .eq('status', 'submitted')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Error loading pre-approval requests:', error);
      return;
    }

    const formatted = data.map((req: any) => ({
      ...req,
      buyer_name: req.buyer?.full_name || 'Unknown',
    }));

    setPreApprovalRequests(formatted);
    setStats((prev) => ({
      ...prev,
      preApprovalRequests: data.length,
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'denied':
        return 'bg-red-100 text-red-800';
      case 'under_review':
      case 'in_review':
        return 'bg-blue-100 text-blue-800';
      case 'pending_review':
      case 'submitted':
        return 'bg-yellow-100 text-yellow-800';
      case 'documents_requested':
        return 'bg-orange-100 text-orange-800';
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
      case 'under_review':
      case 'in_review':
        return <Clock size={16} className="text-blue-600" />;
      case 'pending_review':
      case 'submitted':
        return <AlertCircle size={16} className="text-yellow-600" />;
      default:
        return <FileText size={16} className="text-gray-600" />;
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
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!lenderProfile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b mb-8">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-800 mb-2">Lender Dashboard</h1>
              <p className="text-gray-600">Welcome back, {profile?.full_name}</p>
            </div>

            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg shadow-md p-6 text-white relative min-w-[320px]">
              <button
                onClick={() => navigate('/lender/setup')}
                className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-lg transition"
                title="Edit Profile"
              >
                <Pencil size={18} />
              </button>
              <div className="flex items-center gap-3 mb-4">
                {lenderProfile.logo_url ? (
                  <img
                    src={lenderProfile.logo_url}
                    alt={lenderProfile.company_name}
                    className="w-16 h-16 rounded-lg object-contain bg-white p-2"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-white/20 flex items-center justify-center">
                    <Building2 size={28} />
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-lg">{lenderProfile.company_name}</h3>
                  <p className="text-sm text-blue-100">NMLS #{lenderProfile.nmls_number}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-blue-100 text-xs mb-1">Rating</p>
                  <div className="flex items-center gap-1">
                    <Star size={16} className="fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold">{lenderProfile.average_rating.toFixed(1)}</span>
                  </div>
                </div>
                <div>
                  <p className="text-blue-100 text-xs mb-1">Loans Closed</p>
                  <p className="font-semibold">{lenderProfile.total_loans_closed}</p>
                </div>
              </div>
              {lenderProfile.is_featured && (
                <div className="bg-white/20 rounded px-3 py-2 text-center">
                  <p className="text-sm font-medium">Featured Lender</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-600">
            <div className="flex items-center justify-between mb-3">
              <FileText className="text-blue-600" size={28} />
              <span className="text-3xl font-bold text-gray-800">
                {stats.totalApplications}
              </span>
            </div>
            <p className="text-gray-600 font-medium">Total Applications</p>
            <p className="text-sm text-gray-500 mt-1">All time</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-yellow-600">
            <div className="flex items-center justify-between mb-3">
              <Clock className="text-yellow-600" size={28} />
              <span className="text-3xl font-bold text-gray-800">
                {stats.pendingReview}
              </span>
            </div>
            <p className="text-gray-600 font-medium">Pending Review</p>
            <p className="text-sm text-gray-500 mt-1">Needs attention</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-600">
            <div className="flex items-center justify-between mb-3">
              <CheckCircle className="text-green-600" size={28} />
              <span className="text-3xl font-bold text-gray-800">
                {stats.approved}
              </span>
            </div>
            <p className="text-gray-600 font-medium">Approved Loans</p>
            <p className="text-sm text-gray-500 mt-1">Successful closings</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-600">
            <div className="flex items-center justify-between mb-3">
              <DollarSign className="text-purple-600" size={28} />
              <span className="text-2xl font-bold text-gray-800">
                {formatCurrency(stats.totalVolume)}
              </span>
            </div>
            <p className="text-gray-600 font-medium">Total Volume</p>
            <p className="text-sm text-gray-500 mt-1">Avg: {formatCurrency(stats.avgLoanAmount)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">Recent Applications</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate('/lender/applications/new')}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2"
                >
                  <FileText size={16} />
                  Create New
                </button>
                <button
                  onClick={() => navigate('/lender/applications')}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                >
                  View All
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {applications.length === 0 ? (
              <div className="text-center py-12">
                <FileText size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 mb-2">No loan applications yet</p>
                <p className="text-sm text-gray-500 mb-4">Create applications for your buyers to complete</p>
                <button
                  onClick={() => navigate('/lender/applications/new')}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
                >
                  <FileText size={16} />
                  Create New Application
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {applications.map((app) => (
                  <div
                    key={app.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-blue-600 transition cursor-pointer"
                    onClick={() => navigate(`/lender/applications/${app.id}`)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <User size={16} className="text-gray-400" />
                          <span className="font-semibold text-gray-800">{app.buyer_name}</span>
                        </div>
                        {app.property_address && (
                          <p className="text-sm text-gray-600 mb-2">{app.property_address}</p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>{formatCurrency(app.loan_amount)}</span>
                          <span className="text-gray-400">•</span>
                          <span className="capitalize">{app.loan_type.replace('_', ' ')}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(app.status)} mb-2`}>
                          {getStatusIcon(app.status)}
                          {app.status.replace('_', ' ')}
                        </div>
                        <p className="text-xs text-gray-500">{formatDate(app.created_at)}</p>
                      </div>
                    </div>
                    {app.estimated_closing_date && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded">
                        <Calendar size={14} />
                        <span>Est. Closing: {formatDate(app.estimated_closing_date)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-gray-800">Pre-Approval Requests</h2>
                {preApprovalRequests.length > 0 && (
                  <span className="bg-red-100 text-red-800 text-xs font-bold px-2 py-1 rounded-full">
                    {stats.preApprovalRequests}
                  </span>
                )}
              </div>
              <button
                onClick={() => navigate('/lender/pre-approval-requests')}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition font-medium"
              >
                Manage All
                <ChevronRight size={16} />
              </button>
            </div>

            {preApprovalRequests.length === 0 ? (
              <div className="text-center py-8">
                <Users size={40} className="mx-auto text-gray-400 mb-3" />
                <p className="text-sm text-gray-600 mb-4">No pending requests</p>
                <button
                  onClick={() => navigate('/lender/pre-approval-requests')}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Generate shareable form link
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {preApprovalRequests.map((req) => (
                  <div
                    key={req.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-blue-600 transition cursor-pointer"
                    onClick={() => navigate(`/lender/pre-approval-requests`)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="font-medium text-gray-800">{req.buyer_name}</span>
                      <span className="text-xs text-gray-500">{formatDate(req.created_at)}</span>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p className="font-semibold text-gray-800">{formatCurrency(req.requested_amount)}</p>
                      <p>Income: {formatCurrency(req.annual_income)}</p>
                      {req.credit_score && <p>Credit Score: {req.credit_score}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => navigate('/lender/analytics')}
              className="group bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 rounded-lg p-6 text-left transition-all duration-200 transform hover:scale-105 hover:shadow-lg"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 bg-blue-600 rounded-lg group-hover:bg-blue-700 transition-colors">
                  <BarChart3 className="text-white" size={24} />
                </div>
              </div>
              <h3 className="font-bold text-gray-800 text-lg mb-2">Analytics</h3>
              <p className="text-sm text-gray-600">View performance metrics and insights</p>
            </button>

            <button
              onClick={() => navigate('/lender/calculator')}
              className="group bg-gradient-to-br from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 rounded-lg p-6 text-left transition-all duration-200 transform hover:scale-105 hover:shadow-lg"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 bg-green-600 rounded-lg group-hover:bg-green-700 transition-colors">
                  <Calculator className="text-white" size={24} />
                </div>
              </div>
              <h3 className="font-bold text-gray-800 text-lg mb-2">Mortgage Calculator</h3>
              <p className="text-sm text-gray-600">Calculate payments and affordability</p>
            </button>

            <button
              onClick={() => navigate('/lender/consultations')}
              className="group bg-gradient-to-br from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 rounded-lg p-6 text-left transition-all duration-200 transform hover:scale-105 hover:shadow-lg"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 bg-purple-600 rounded-lg group-hover:bg-purple-700 transition-colors">
                  <Video className="text-white" size={24} />
                </div>
              </div>
              <h3 className="font-bold text-gray-800 text-lg mb-2">Consultations</h3>
              <p className="text-sm text-gray-600">Schedule and manage client meetings</p>
            </button>

            <button
              onClick={() => navigate('/lender/team')}
              className="group bg-gradient-to-br from-orange-50 to-orange-100 hover:from-orange-100 hover:to-orange-200 rounded-lg p-6 text-left transition-all duration-200 transform hover:scale-105 hover:shadow-lg"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 bg-orange-600 rounded-lg group-hover:bg-orange-700 transition-colors">
                  <Users className="text-white" size={24} />
                </div>
              </div>
              <h3 className="font-bold text-gray-800 text-lg mb-2">Team Management</h3>
              <p className="text-sm text-gray-600">Manage team members and roles</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
