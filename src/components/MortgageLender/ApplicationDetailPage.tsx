import { useState, useEffect } from 'react';
import { ArrowLeft, User, DollarSign, Home, Calendar, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from '../Navigation/Router';
import { ApplicationDocuments } from './ApplicationDocuments';
import { ApplicationNotes } from './ApplicationNotes';
import { ComplianceChecklist } from './ComplianceChecklist';

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

export function ApplicationDetailPage({ applicationId }: { applicationId: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [application, setApplication] = useState<LoanApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [updatingStatus, setUpdatingStatus] = useState(false);

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
    loadApplication();
  }, [applicationId]);

  const loadApplication = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('loan_applications')
        .select(`
          *,
          properties(address_line1, city, state, zip_code)
        `)
        .eq('id', applicationId)
        .eq('lender_id', user!.id)
        .single();

      if (error) throw error;

      // Fetch buyer profile separately
      const { data: buyerProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', data.buyer_id)
        .maybeSingle();

      const { data: buyerEmail } = await supabase.rpc('get_user_email', {
        user_id: data.buyer_id,
      });

      let propertyDisplay = null;
      if (data.properties) {
        propertyDisplay = `${data.properties.address_line1}, ${data.properties.city}, ${data.properties.state}`;
      } else if (data.property_type) {
        propertyDisplay = getPropertyTypeLabel(data.property_type);
      }

      const formatted = {
        ...data,
        buyer_name: buyerProfile?.full_name || 'Unknown',
        buyer_email: buyerEmail || '',
        property_address: propertyDisplay
      };

      setApplication(formatted);
    } catch (err) {
      console.error('Error loading application:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (newStatus: string) => {
    setUpdatingStatus(true);
    try {
      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString()
      };

      if (newStatus === 'approved') {
        updateData.approval_date = new Date().toISOString();
      }

      const { error } = await supabase
        .from('loan_applications')
        .update(updateData)
        .eq('id', applicationId)
        .eq('lender_id', user!.id);

      if (error) {
        console.error('Database error:', error);
        alert(`Failed to update status: ${error.message}`);
        throw error;
      }

      await loadApplication();
      alert('Status updated successfully!');
    } catch (err: any) {
      console.error('Error updating status:', err);
      alert(`Error: ${err.message || 'Failed to update status'}`);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
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
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading application...</p>
        </div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="text-center">
          <p className="text-gray-600">Application not found</p>
          <button
            onClick={() => navigate('/lender/applications')}
            className="mt-4 text-blue-600 hover:text-blue-700"
          >
            Back to Applications
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <button
            onClick={() => navigate('/lender/applications')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4"
          >
            <ArrowLeft size={20} />
            <span>Back to Applications</span>
          </button>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">{application.buyer_name}</h1>
              <p className="text-gray-600">{application.buyer_email}</p>
            </div>
            <div className="text-right">
              <span className={`inline-block px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(application.status)}`}>
                {application.status.replace('_', ' ')}
              </span>
              <p className="text-sm text-gray-500 mt-2">
                Applied {formatDate(application.created_at)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
              <h3 className="font-semibold text-gray-800 mb-4">Application Info</h3>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 text-gray-600 mb-1">
                    <DollarSign size={16} />
                    <span className="text-sm">Loan Amount</span>
                  </div>
                  <p className="font-semibold text-gray-800 text-lg">
                    {formatCurrency(application.loan_amount)}
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-gray-600 mb-1">
                    <FileText size={16} />
                    <span className="text-sm">Loan Type</span>
                  </div>
                  <p className="font-semibold text-gray-800 capitalize">
                    {application.loan_type}
                  </p>
                </div>

                {application.property_type && (
                  <div>
                    <div className="flex items-center gap-2 text-gray-600 mb-1">
                      <Home size={16} />
                      <span className="text-sm">Property Type</span>
                    </div>
                    <p className="font-semibold text-gray-800">
                      {getPropertyTypeLabel(application.property_type)}
                    </p>
                  </div>
                )}

                {application.property_address && (
                  <div>
                    <div className="flex items-center gap-2 text-gray-600 mb-1">
                      <Home size={16} />
                      <span className="text-sm">Property</span>
                    </div>
                    <p className="text-sm text-gray-800">{application.property_address}</p>
                  </div>
                )}

                {application.estimated_closing_date && (
                  <div>
                    <div className="flex items-center gap-2 text-gray-600 mb-1">
                      <Calendar size={16} />
                      <span className="text-sm">Est. Closing</span>
                    </div>
                    <p className="font-semibold text-gray-800">
                      {formatDate(application.estimated_closing_date)}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Update Status
                </label>
                <select
                  value={application.status}
                  onChange={(e) => updateStatus(e.target.value)}
                  disabled={updatingStatus}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="pending_review">Pending Review</option>
                  <option value="documents_requested">Documents Requested</option>
                  <option value="under_review">Under Review</option>
                  <option value="approved">Approved</option>
                  <option value="denied">Denied</option>
                </select>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-md">
              <div className="border-b border-gray-200">
                <div className="flex">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`px-6 py-4 font-medium border-b-2 transition ${
                      activeTab === 'overview'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => setActiveTab('documents')}
                    className={`px-6 py-4 font-medium border-b-2 transition ${
                      activeTab === 'documents'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Documents
                  </button>
                  <button
                    onClick={() => setActiveTab('compliance')}
                    className={`px-6 py-4 font-medium border-b-2 transition ${
                      activeTab === 'compliance'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Compliance
                  </button>
                  <button
                    onClick={() => setActiveTab('notes')}
                    className={`px-6 py-4 font-medium border-b-2 transition ${
                      activeTab === 'notes'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Notes
                  </button>
                </div>
              </div>

              <div className="p-6">
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">Application Details</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Application Type</span>
                          <p className="font-medium text-gray-800 capitalize mt-1">
                            {application.application_type.replace('_', ' ')}
                          </p>
                        </div>
                        {application.interest_rate && (
                          <div>
                            <span className="text-gray-600">Interest Rate</span>
                            <p className="font-medium text-gray-800 mt-1">
                              {application.interest_rate}%
                            </p>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-600">Submitted</span>
                          <p className="font-medium text-gray-800 mt-1">
                            {formatDate(application.created_at)}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-600">Last Updated</span>
                          <p className="font-medium text-gray-800 mt-1">
                            {formatDate(application.updated_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'documents' && (
                  <ApplicationDocuments applicationId={applicationId} />
                )}

                {activeTab === 'compliance' && (
                  <ComplianceChecklist applicationId={applicationId} />
                )}

                {activeTab === 'notes' && (
                  <ApplicationNotes applicationId={applicationId} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
