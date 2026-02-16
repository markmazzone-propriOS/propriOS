import { useState, useEffect } from 'react';
import {
  FileText,
  Filter,
  Search,
  User,
  DollarSign,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  ChevronDown,
  Eye,
  MessageSquare,
  ArrowLeft,
  Plus
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
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
  property_type?: string | null;
  interest_rate: number | null;
  estimated_closing_date: string | null;
  created_at: string;
  updated_at: string;
  buyer_name?: string;
  buyer_email?: string;
  property_address?: string;
};

export function ApplicationsManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [filteredApplications, setFilteredApplications] = useState<LoanApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const getPropertyTypeLabel = (propertyType: string | null | undefined): string => {
    if (!propertyType) return '';
    const labels: { [key: string]: string } = {
      'single_family': 'Single Family Home',
      'condo': 'Condo',
      'townhouse': 'Townhouse',
      'multi_family': 'Multi-Family',
      'manufactured': 'Manufactured/Mobile Home',
      'land': 'Land',
      'commercial': 'Commercial'
    };
    return labels[propertyType] || propertyType.replace(/_/g, ' ');
  };

  useEffect(() => {
    loadApplications();
  }, [user]);

  useEffect(() => {
    filterApplications();
  }, [applications, searchQuery, statusFilter, typeFilter]);

  const loadApplications = async () => {
    setLoading(true);
    try {
      console.log('🔍 [ApplicationsManagement] Loading applications for lender:', user?.id);
      const { data, error } = await supabase
        .from('loan_applications')
        .select(`
          *,
          properties(address_line1, city, state, zip_code)
        `)
        .eq('lender_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log('✅ [ApplicationsManagement] Raw data:', data);
      console.log('📊 [ApplicationsManagement] Number of applications:', data?.length || 0);

      const formattedApps = await Promise.all(
        (data || []).map(async (app: any) => {
          const [buyerProfile, buyerEmail] = await Promise.all([
            supabase.from('profiles').select('full_name').eq('id', app.buyer_id).single(),
            supabase.rpc('get_user_email', { user_id: app.buyer_id }),
          ]);

          let propertyDisplay = null;
          if (app.properties) {
            propertyDisplay = `${app.properties.address_line1}, ${app.properties.city}, ${app.properties.state}`;
          } else if (app.property_type) {
            propertyDisplay = getPropertyTypeLabel(app.property_type);
          }

          return {
            ...app,
            buyer_name: buyerProfile.data?.full_name || 'Unknown',
            buyer_email: buyerEmail.data || '',
            property_address: propertyDisplay,
          };
        })
      );

      console.log('✅ [ApplicationsManagement] Formatted applications:', formattedApps);
      setApplications(formattedApps);
    } catch (error) {
      console.error('❌ [ApplicationsManagement] Error loading applications:', error);
      console.error('❌ [ApplicationsManagement] Error details:', JSON.stringify(error, null, 2));
    } finally {
      setLoading(false);
    }
  };

  const filterApplications = () => {
    let filtered = [...applications];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (app) =>
          app.buyer_name?.toLowerCase().includes(query) ||
          app.buyer_email?.toLowerCase().includes(query) ||
          app.property_address?.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((app) => app.status === statusFilter);
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter((app) => app.loan_type === typeFilter);
    }

    setFilteredApplications(filtered);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'denied':
        return 'bg-red-100 text-red-800';
      case 'under_review':
        return 'bg-blue-100 text-blue-800';
      case 'pending_review':
        return 'bg-yellow-100 text-yellow-800';
      case 'documents_requested':
        return 'bg-orange-100 text-orange-800';
      case 'withdrawn':
        return 'bg-gray-100 text-gray-800';
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
        return <Clock size={16} className="text-blue-600" />;
      case 'pending_review':
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

  const handleContactBuyer = async (buyerId: string) => {
    const { data: existingConversation } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', user!.id)
      .limit(1)
      .maybeSingle();

    if (existingConversation) {
      navigate(`/messages?conversation=${existingConversation.conversation_id}`);
    } else {
      navigate(`/messages/new?recipient=${buyerId}`);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading applications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b mb-8">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <button
            onClick={() => navigate('/lender/dashboard')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4 transition"
          >
            <ArrowLeft size={20} />
            <span>Back to Dashboard</span>
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Loan Applications</h1>
              <p className="text-gray-600 mt-2">Manage and track all loan applications</p>
            </div>
            <button
              onClick={() => navigate('/lender/applications/new')}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-md"
            >
              <Plus size={20} />
              <span className="font-medium">Create New Application</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-12">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search by name, email, or property..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 appearance-none"
              >
                <option value="all">All Statuses</option>
                <option value="pending_review">Pending Review</option>
                <option value="documents_requested">Documents Requested</option>
                <option value="under_review">Under Review</option>
                <option value="approved">Approved</option>
                <option value="denied">Denied</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
            </div>

            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 appearance-none"
              >
                <option value="all">All Loan Types</option>
                <option value="conventional">Conventional</option>
                <option value="fha">FHA</option>
                <option value="va">VA</option>
                <option value="usda">USDA</option>
                <option value="jumbo">Jumbo</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
            <p>Showing {filteredApplications.length} of {applications.length} applications</p>
            {(searchQuery || statusFilter !== 'all' || typeFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setTypeFilter('all');
                }}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {filteredApplications.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <FileText size={64} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No applications found</h3>
            <p className="text-gray-600">
              {applications.length === 0
                ? 'You have no loan applications yet. Applications will appear here when buyers submit them.'
                : 'Try adjusting your filters to see more results.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredApplications.map((app) => (
              <div
                key={app.id}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <User size={20} className="text-gray-400" />
                      <h3 className="text-lg font-semibold text-gray-800">{app.buyer_name}</h3>
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(app.status)}`}>
                        {getStatusIcon(app.status)}
                        {app.status.replace('_', ' ')}
                      </span>
                    </div>
                    {app.property_address && (
                      <p className="text-sm text-gray-600 mb-2">{app.property_address}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/lender/applications/${app.id}`)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition"
                      title="View Details"
                    >
                      <Eye size={20} />
                    </button>
                    <button
                      onClick={() => handleContactBuyer(app.buyer_id)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition"
                      title="Contact Buyer"
                    >
                      <MessageSquare size={20} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Loan Amount</p>
                    <p className="font-semibold text-gray-800">{formatCurrency(app.loan_amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Loan Type</p>
                    <p className="font-medium text-gray-800 capitalize">{app.loan_type}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Application Type</p>
                    <p className="font-medium text-gray-800 capitalize">{app.application_type.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Submitted</p>
                    <p className="font-medium text-gray-800">{formatDate(app.created_at)}</p>
                  </div>
                </div>

                {app.estimated_closing_date && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-4 py-2 rounded">
                    <Calendar size={16} />
                    <span>Estimated Closing: {formatDate(app.estimated_closing_date)}</span>
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
