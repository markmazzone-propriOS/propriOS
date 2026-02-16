import { useState, useEffect } from 'react';
import { FileText, Plus, Eye, Calendar, DollarSign, Home, User, Mail, Phone, X, CheckCircle, Clock, Trash2, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

type RentalApplication = {
  id: string;
  renter_id: string;
  property_id: string;
  status: string;
  move_in_date: string | null;
  lease_term_months: number | null;
  monthly_income: number | null;
  employment_status: string | null;
  current_address: string | null;
  previous_landlord_name: string | null;
  previous_landlord_phone: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  has_pets: boolean;
  pet_details: string | null;
  additional_occupants: number;
  special_requests: string | null;
  created_at: string;
  renter: {
    full_name: string;
    phone_number: string | null;
  } | null;
  property: {
    address_line1: string;
    city: string;
    state: string;
    price: number;
  };
};

type Property = {
  id: string;
  address_line1: string;
  city: string;
  state: string;
  price: number;
};

export function RentalApplicationsCard() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<RentalApplication[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<RentalApplication | null>(null);

  // Form states for creating application
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [renterSearch, setRenterSearch] = useState('');
  const [availableRenters, setAvailableRenters] = useState<any[]>([]);
  const [selectedRenter, setSelectedRenter] = useState<any>(null);
  const [showRenterDropdown, setShowRenterDropdown] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    console.log('Loading data for user:', user.id);

    try {
      // Load applications
      const { data: appsData, error: appsError } = await supabase
        .from('rental_applications')
        .select(`
          *,
          renter:profiles!rental_applications_renter_id_fkey(full_name, phone_number),
          property:properties(address_line1, city, state, price)
        `)
        .eq('property_owner_id', user.id)
        .neq('status', 'disconnected')
        .order('created_at', { ascending: false })
        .limit(5);

      if (appsError) throw appsError;
      setApplications(appsData || []);

      // Load properties for dropdown
      const { data: propsData, error: propsError } = await supabase
        .from('properties')
        .select('id, address_line1, city, state, price, listing_type, listed_by')
        .eq('listing_type', 'rent')
        .eq('listed_by', user.id)
        .order('created_at', { ascending: false });

      console.log('Properties query result:', { data: propsData, error: propsError });

      if (propsError) {
        console.error('Error loading properties:', propsError);
        throw propsError;
      }

      console.log('Loaded properties count:', propsData?.length || 0);
      console.log('Properties:', propsData);
      setProperties(propsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchRenters = async (searchTerm: string) => {
    if (searchTerm.length < 2) {
      setAvailableRenters([]);
      setShowRenterDropdown(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone_number')
        .eq('user_type', 'renter')
        .or(`full_name.ilike.%${searchTerm}%,phone_number.ilike.%${searchTerm}%`)
        .limit(10);

      if (error) throw error;
      setAvailableRenters(data || []);
      setShowRenterDropdown(true);
    } catch (error) {
      console.error('Error searching renters:', error);
    }
  };

  const handleCreateApplication = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPropertyId || !selectedRenter) {
      alert('Please select a property and a renter');
      return;
    }

    setSubmitting(true);
    try {
      // Create rental application directly
      const { data: newApp, error: appError } = await supabase
        .from('rental_applications')
        .insert({
          property_owner_id: user!.id,
          property_id: selectedPropertyId,
          renter_id: selectedRenter.id,
          status: 'interested'
        })
        .select()
        .single();

      if (appError) throw appError;

      // Create a conversation with the renter
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          subject: `Rental Application - ${properties.find(p => p.id === selectedPropertyId)?.address_line1}`
        })
        .select()
        .single();

      if (convError) throw convError;

      // Add participants
      await supabase.from('conversation_participants').insert([
        { conversation_id: conversation.id, user_id: user!.id },
        { conversation_id: conversation.id, user_id: selectedRenter.id }
      ]);

      // Send initial message
      const property = properties.find(p => p.id === selectedPropertyId);
      await supabase.from('messages').insert({
        conversation_id: conversation.id,
        sender_id: user!.id,
        content: `Hello ${selectedRenter.full_name},\n\nI'd like to invite you to complete a rental application for the property at ${property?.address_line1}, ${property?.city}, ${property?.state}.\n\nMonthly rent: $${property?.price.toLocaleString()}\n\nPlease reply with your desired move-in date and preferred lease term (in months) to get started.\n\nThank you!`
      });

      alert('Rental application created and message sent to renter!');
      setShowCreateModal(false);
      resetForm();
      await loadData();
    } catch (error: any) {
      console.error('Error creating application:', error);
      alert(error.message || 'Failed to create application');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteApplication = async (applicationId: string) => {
    if (!confirm('Are you sure you want to delete this rental application? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('rental_applications')
        .delete()
        .eq('id', applicationId);

      if (error) throw error;

      alert('Application deleted successfully!');
      await loadData();
    } catch (error: any) {
      console.error('Error deleting application:', error);
      alert(error.message || 'Failed to delete application');
    }
  };

  const handleApproveApplication = async () => {
    if (!selectedApplication) return;

    if (!confirm('Are you sure you want to approve this application?')) {
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('rental_applications')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
        })
        .eq('id', selectedApplication.id);

      if (error) throw error;

      alert('Application approved successfully!');
      setShowDetailsModal(false);
      setSelectedApplication(null);
      await loadData();
    } catch (error: any) {
      console.error('Error approving application:', error);
      alert(error.message || 'Failed to approve application');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectApplication = async () => {
    if (!selectedApplication) return;

    const reason = prompt('Please provide a reason for rejection (optional):');
    if (reason === null) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('rental_applications')
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejection_reason: reason || null,
        })
        .eq('id', selectedApplication.id);

      if (error) throw error;

      alert('Application rejected.');
      setShowDetailsModal(false);
      setSelectedApplication(null);
      await loadData();
    } catch (error: any) {
      console.error('Error rejecting application:', error);
      alert(error.message || 'Failed to reject application');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedPropertyId('');
    setRenterSearch('');
    setSelectedRenter(null);
    setAvailableRenters([]);
    setShowRenterDropdown(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'interested': return 'bg-blue-100 text-blue-800';
      case 'applied': return 'bg-yellow-100 text-yellow-800';
      case 'background_check': return 'bg-purple-100 text-purple-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'lease_signed': return 'bg-indigo-100 text-indigo-800';
      case 'active': return 'bg-emerald-100 text-emerald-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
      case 'lease_signed':
      case 'active':
        return <CheckCircle size={16} className="text-green-600" />;
      default:
        return <Clock size={16} className="text-blue-600" />;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <FileText className="text-white" size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Rental Applications</h2>
                <p className="text-teal-100 text-sm">Track and manage applicants</p>
              </div>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white text-teal-700 rounded-xl hover:bg-teal-50 transition-all duration-200 font-semibold shadow-md"
            >
              <Plus size={20} />
              Create Application
            </button>
          </div>
        </div>

        <div className="p-6">
          {applications.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto text-gray-400 mb-4" size={48} />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Applications Yet</h3>
              <p className="text-gray-600 mb-4">
                Create rental applications for prospective tenants
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition font-semibold"
              >
                <Plus size={20} />
                Create First Application
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {applications.map((app) => (
                <div
                  key={app.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-teal-300 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <User size={16} className="text-gray-400" />
                      <span className="font-semibold text-gray-900">
                        {app.renter?.full_name || 'Pending Registration'}
                      </span>
                      {getStatusIcon(app.status)}
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(app.status)}`}>
                        {app.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Home size={14} className="text-gray-400" />
                        <span>{app.property.address_line1}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <DollarSign size={14} className="text-gray-400" />
                        <span>${app.property.price.toLocaleString()}/mo</span>
                      </div>
                      {app.move_in_date && (
                        <div className="flex items-center gap-1">
                          <Calendar size={14} className="text-gray-400" />
                          <span>{new Date(app.move_in_date).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedApplication(app);
                        setShowDetailsModal(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition font-medium"
                    >
                      <Eye size={18} />
                      View
                    </button>
                    <button
                      onClick={() => handleDeleteApplication(app.id)}
                      className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition font-medium"
                      title="Delete application"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
              {applications.length >= 5 && (
                <p className="text-center text-sm text-gray-500 pt-2">
                  Showing 5 most recent applications
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Application Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-800">Create Rental Application</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleCreateApplication} className="p-6 space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800">
                  <strong>How it works:</strong> Select a property and search for an existing renter.
                  A message will be sent to the renter asking them to provide their move-in date, lease term preferences, and other relevant applicant information.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Property <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedPropertyId}
                  onChange={(e) => setSelectedPropertyId(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">
                    {properties.length === 0 ? 'No rental properties available - create one first' : 'Choose a property...'}
                  </option>
                  {properties.map((prop) => (
                    <option key={prop.id} value={prop.id}>
                      {prop.address_line1}, {prop.city}, {prop.state} - ${prop.price.toLocaleString()}/mo
                    </option>
                  ))}
                </select>
                {properties.length === 0 && (
                  <p className="mt-2 text-sm text-amber-600">
                    You need to create a rental property listing first before creating applications.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search for Renter <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={renterSearch}
                    onChange={(e) => {
                      setRenterSearch(e.target.value);
                      searchRenters(e.target.value);
                    }}
                    onFocus={() => {
                      if (availableRenters.length > 0) {
                        setShowRenterDropdown(true);
                      }
                    }}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Search by name or phone number..."
                  />

                  {showRenterDropdown && availableRenters.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {availableRenters.map((renter) => (
                        <button
                          key={renter.id}
                          type="button"
                          onClick={() => {
                            setSelectedRenter(renter);
                            setRenterSearch(renter.full_name);
                            setShowRenterDropdown(false);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-teal-50 transition"
                        >
                          <div className="font-medium text-gray-900">{renter.full_name}</div>
                          <div className="text-sm text-gray-600">{renter.phone_number || 'No phone'}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selectedRenter && (
                  <div className="mt-3 p-3 bg-teal-50 border border-teal-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-teal-900">{selectedRenter.full_name}</p>
                        <p className="text-sm text-teal-700">{selectedRenter.phone_number || 'No phone'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRenter(null);
                          setRenterSearch('');
                        }}
                        className="text-teal-600 hover:text-teal-800"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  </div>
                )}

                {renterSearch.length >= 2 && availableRenters.length === 0 && !selectedRenter && (
                  <p className="mt-2 text-sm text-amber-600">
                    No renters found. The person must have a renter account first.
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition font-medium disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Application Details Modal */}
      {showDetailsModal && selectedApplication && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full my-8">
            <div className="bg-gradient-to-r from-teal-600 to-teal-700 p-6 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <FileText className="text-white" size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">Application Details</h2>
                    <p className="text-teal-100 text-sm">Complete rental application information</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedApplication(null);
                  }}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Renter Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <User size={20} className="text-teal-600" />
                  Renter Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Full Name</label>
                    <p className="text-gray-900">{selectedApplication.renter?.full_name || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Phone Number</label>
                    <p className="text-gray-900">{selectedApplication.renter?.phone_number || 'Not provided'}</p>
                  </div>
                </div>
              </div>

              {/* Property Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Home size={20} className="text-teal-600" />
                  Property Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Address</label>
                    <p className="text-gray-900">
                      {selectedApplication.property.address_line1}, {selectedApplication.property.city}, {selectedApplication.property.state}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Monthly Rent</label>
                    <p className="text-gray-900">${selectedApplication.property.price.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Lease Details */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Calendar size={20} className="text-teal-600" />
                  Lease Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 rounded-lg p-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Move-in Date</label>
                    <p className="text-gray-900">
                      {selectedApplication.move_in_date
                        ? new Date(selectedApplication.move_in_date).toLocaleDateString()
                        : 'Not specified'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Lease Term</label>
                    <p className="text-gray-900">
                      {selectedApplication.lease_term_months
                        ? `${selectedApplication.lease_term_months} months`
                        : 'Not specified'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Additional Occupants</label>
                    <p className="text-gray-900">{selectedApplication.additional_occupants}</p>
                  </div>
                </div>
              </div>

              {/* Financial Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <DollarSign size={20} className="text-teal-600" />
                  Financial Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Monthly Income</label>
                    <p className="text-gray-900">
                      {selectedApplication.monthly_income
                        ? `$${selectedApplication.monthly_income.toLocaleString()}`
                        : 'Not provided'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Employment Status</label>
                    <p className="text-gray-900">{selectedApplication.employment_status || 'Not provided'}</p>
                  </div>
                </div>
              </div>

              {/* Current Residence */}
              {selectedApplication.current_address && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Residence</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-900">{selectedApplication.current_address}</p>
                  </div>
                </div>
              )}

              {/* Previous Landlord */}
              {(selectedApplication.previous_landlord_name || selectedApplication.previous_landlord_phone) && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Previous Landlord</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
                    {selectedApplication.previous_landlord_name && (
                      <div>
                        <label className="text-sm font-medium text-gray-600">Name</label>
                        <p className="text-gray-900">{selectedApplication.previous_landlord_name}</p>
                      </div>
                    )}
                    {selectedApplication.previous_landlord_phone && (
                      <div>
                        <label className="text-sm font-medium text-gray-600">Phone</label>
                        <p className="text-gray-900">{selectedApplication.previous_landlord_phone}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Emergency Contact */}
              {(selectedApplication.emergency_contact_name || selectedApplication.emergency_contact_phone) && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Emergency Contact</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
                    {selectedApplication.emergency_contact_name && (
                      <div>
                        <label className="text-sm font-medium text-gray-600">Name</label>
                        <p className="text-gray-900">{selectedApplication.emergency_contact_name}</p>
                      </div>
                    )}
                    {selectedApplication.emergency_contact_phone && (
                      <div>
                        <label className="text-sm font-medium text-gray-600">Phone</label>
                        <p className="text-gray-900">{selectedApplication.emergency_contact_phone}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Pet Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Pet Information</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-900">
                    {selectedApplication.has_pets ? 'Has pets' : 'No pets'}
                  </p>
                  {selectedApplication.pet_details && (
                    <p className="text-gray-700 mt-2">{selectedApplication.pet_details}</p>
                  )}
                </div>
              </div>

              {/* Special Requests */}
              {selectedApplication.special_requests && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Special Requests</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-900">{selectedApplication.special_requests}</p>
                  </div>
                </div>
              )}

              {/* Application Status */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Status</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(selectedApplication.status)}`}>
                    {selectedApplication.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t">
                {selectedApplication.status === 'applied' && (
                  <div className="flex gap-3">
                    <button
                      onClick={handleApproveApplication}
                      disabled={submitting}
                      className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <ThumbsUp size={18} />
                      {submitting ? 'Processing...' : 'Approve Application'}
                    </button>
                    <button
                      onClick={handleRejectApplication}
                      disabled={submitting}
                      className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <ThumbsDown size={18} />
                      {submitting ? 'Processing...' : 'Reject Application'}
                    </button>
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={async () => {
                      setShowDetailsModal(false);
                      await handleDeleteApplication(selectedApplication.id);
                      setSelectedApplication(null);
                    }}
                    className="px-6 py-3 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition font-medium flex items-center justify-center gap-2"
                  >
                    <Trash2 size={18} />
                    Delete
                  </button>
                  <button
                    onClick={() => {
                      setShowDetailsModal(false);
                      setSelectedApplication(null);
                    }}
                    className="flex-1 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
