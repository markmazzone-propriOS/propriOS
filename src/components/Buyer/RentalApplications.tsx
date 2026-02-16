import { useState, useEffect } from 'react';
import { FileText, Calendar, DollarSign, Home, User, Phone, X, CheckCircle, Clock, XCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

type RentalApplication = {
  id: string;
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
  has_pets: boolean | null;
  pet_details: string | null;
  additional_occupants: number | null;
  special_requests: string | null;
  application_submitted_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  property: {
    address_line1: string;
    city: string;
    state: string;
    price: number;
  };
};

export function RentalApplications() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<RentalApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFillModal, setShowFillModal] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<RentalApplication | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    move_in_date: '',
    lease_term_months: '',
    monthly_income: '',
    employment_status: '',
    current_address: '',
    previous_landlord_name: '',
    previous_landlord_phone: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    has_pets: false,
    pet_details: '',
    additional_occupants: '0',
    special_requests: '',
    consent_to_background_check: false,
  });

  useEffect(() => {
    if (user) {
      loadApplications();
    }
  }, [user]);

  const loadApplications = async () => {
    try {
      const { data, error } = await supabase
        .from('rental_applications')
        .select(`
          *,
          property:properties(address_line1, city, state, price)
        `)
        .eq('renter_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApplications(data || []);
    } catch (error) {
      console.error('Error loading applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFillApplication = (application: RentalApplication) => {
    setSelectedApplication(application);
    setFormData({
      move_in_date: application.move_in_date || '',
      lease_term_months: application.lease_term_months?.toString() || '',
      monthly_income: application.monthly_income?.toString() || '',
      employment_status: application.employment_status || '',
      current_address: application.current_address || '',
      previous_landlord_name: application.previous_landlord_name || '',
      previous_landlord_phone: application.previous_landlord_phone || '',
      emergency_contact_name: application.emergency_contact_name || '',
      emergency_contact_phone: application.emergency_contact_phone || '',
      has_pets: application.has_pets || false,
      pet_details: application.pet_details || '',
      additional_occupants: application.additional_occupants?.toString() || '0',
      special_requests: application.special_requests || '',
      consent_to_background_check: false,
    });
    setShowFillModal(true);
  };

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApplication) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('rental_applications')
        .update({
          move_in_date: formData.move_in_date || null,
          lease_term_months: formData.lease_term_months ? parseInt(formData.lease_term_months) : null,
          monthly_income: formData.monthly_income ? parseFloat(formData.monthly_income) : null,
          employment_status: formData.employment_status || null,
          current_address: formData.current_address || null,
          previous_landlord_name: formData.previous_landlord_name || null,
          previous_landlord_phone: formData.previous_landlord_phone || null,
          emergency_contact_name: formData.emergency_contact_name || null,
          emergency_contact_phone: formData.emergency_contact_phone || null,
          has_pets: formData.has_pets,
          pet_details: formData.pet_details || null,
          additional_occupants: formData.additional_occupants ? parseInt(formData.additional_occupants) : 0,
          special_requests: formData.special_requests || null,
          consent_to_background_check: formData.consent_to_background_check,
          consent_given_at: formData.consent_to_background_check ? new Date().toISOString() : null,
          status: 'applied',
          application_submitted_at: new Date().toISOString(),
        })
        .eq('id', selectedApplication.id);

      if (error) throw error;

      alert('Application submitted successfully!');
      setShowFillModal(false);
      setSelectedApplication(null);
      loadApplications();
    } catch (error: any) {
      console.error('Error submitting application:', error);
      const errorMessage = error?.message || 'Unknown error occurred';
      alert(`Failed to submit application: ${errorMessage}`);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: { icon: Clock, color: 'bg-yellow-100 text-yellow-800', text: 'Pending' },
      interested: { icon: Clock, color: 'bg-yellow-100 text-yellow-800', text: 'Action Required' },
      applied: { icon: CheckCircle, color: 'bg-blue-100 text-blue-800', text: 'Applied' },
      background_check: { icon: Clock, color: 'bg-purple-100 text-purple-800', text: 'Background Check' },
      approved: { icon: CheckCircle, color: 'bg-green-100 text-green-800', text: 'Approved' },
      rejected: { icon: XCircle, color: 'bg-red-100 text-red-800', text: 'Rejected' },
      lease_signed: { icon: CheckCircle, color: 'bg-teal-100 text-teal-800', text: 'Lease Signed' },
      active: { icon: CheckCircle, color: 'bg-green-100 text-green-800', text: 'Active' },
      completed: { icon: CheckCircle, color: 'bg-gray-100 text-gray-800', text: 'Completed' },
      disconnected: { icon: XCircle, color: 'bg-gray-100 text-gray-800', text: 'Disconnected' },
    };
    const badge = badges[status as keyof typeof badges] || badges.pending;
    const Icon = badge.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${badge.color}`}>
        <Icon size={16} />
        {badge.text}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/4"></div>
          <div className="h-24 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <FileText className="text-teal-600" size={24} />
          <h2 className="text-xl font-bold text-gray-900">Rental Applications</h2>
        </div>
        <p className="text-gray-500">No rental applications yet.</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <FileText className="text-teal-600" size={24} />
          <h2 className="text-xl font-bold text-gray-900">Rental Applications</h2>
        </div>

        <div className="space-y-4">
          {applications.map((app) => (
            <div key={app.id} className="border border-gray-200 rounded-lg p-4 hover:border-teal-300 transition">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Home size={18} className="text-gray-400" />
                    <h3 className="font-semibold text-gray-900">
                      {app.property.address_line1}
                    </h3>
                  </div>
                  <p className="text-sm text-gray-600">
                    {app.property.city}, {app.property.state}
                  </p>
                  <p className="text-sm text-gray-900 font-medium mt-1">
                    ${app.property.price.toLocaleString()}/month
                  </p>
                </div>
                {getStatusBadge(app.status)}
              </div>

              {(app.status === 'pending' || app.status === 'interested') && (
                <button
                  onClick={() => handleFillApplication(app)}
                  className="w-full mt-3 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition font-medium"
                >
                  Fill Out Application
                </button>
              )}

              {app.status === 'applied' && (
                <div className="mt-3 bg-blue-50 rounded-lg p-3 text-sm text-blue-800">
                  Application submitted. Waiting for property owner review.
                </div>
              )}

              {app.status === 'approved' && (
                <div className="mt-3 bg-green-50 rounded-lg p-3 text-sm text-green-800">
                  Congratulations! Your application has been approved.
                </div>
              )}

              {app.status === 'rejected' && (
                <div className="mt-3 bg-red-50 rounded-lg p-3 text-sm text-red-800">
                  <p className="font-medium">Application Rejected</p>
                  {app.rejection_reason && (
                    <p className="mt-1">{app.rejection_reason}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {showFillModal && selectedApplication && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full my-8">
            <div className="bg-gradient-to-r from-teal-600 to-teal-700 p-6 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <FileText className="text-white" size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">Complete Rental Application</h2>
                    <p className="text-teal-100 text-sm">
                      {selectedApplication.property.address_line1}, {selectedApplication.property.city}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowFillModal(false);
                    setSelectedApplication(null);
                  }}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmitApplication} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Desired Move-in Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.move_in_date}
                    onChange={(e) => setFormData({ ...formData, move_in_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Lease Term (months) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.lease_term_months}
                    onChange={(e) => setFormData({ ...formData, lease_term_months: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Monthly Income *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.monthly_income}
                    onChange={(e) => setFormData({ ...formData, monthly_income: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Employment Status *
                  </label>
                  <select
                    required
                    value={formData.employment_status}
                    onChange={(e) => setFormData({ ...formData, employment_status: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="">Select status</option>
                    <option value="employed">Employed</option>
                    <option value="self-employed">Self-Employed</option>
                    <option value="unemployed">Unemployed</option>
                    <option value="student">Student</option>
                    <option value="retired">Retired</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Address *
                </label>
                <input
                  type="text"
                  required
                  value={formData.current_address}
                  onChange={(e) => setFormData({ ...formData, current_address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Previous Landlord Name
                  </label>
                  <input
                    type="text"
                    value={formData.previous_landlord_name}
                    onChange={(e) => setFormData({ ...formData, previous_landlord_name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Previous Landlord Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.previous_landlord_phone}
                    onChange={(e) => setFormData({ ...formData, previous_landlord_phone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Emergency Contact Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.emergency_contact_name}
                    onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Emergency Contact Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.emergency_contact_phone}
                    onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <input
                    type="checkbox"
                    checked={formData.has_pets}
                    onChange={(e) => setFormData({ ...formData, has_pets: e.target.checked })}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  I have pets
                </label>
                {formData.has_pets && (
                  <textarea
                    value={formData.pet_details}
                    onChange={(e) => setFormData({ ...formData, pet_details: e.target.value })}
                    placeholder="Please describe your pets (type, breed, size, etc.)"
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Occupants (excluding yourself)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.additional_occupants}
                  onChange={(e) => setFormData({ ...formData, additional_occupants: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Special Requests or Comments
                </label>
                <textarea
                  value={formData.special_requests}
                  onChange={(e) => setFormData({ ...formData, special_requests: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={formData.consent_to_background_check}
                    onChange={(e) => setFormData({ ...formData, consent_to_background_check: e.target.checked })}
                    className="mt-1 rounded text-teal-600 focus:ring-teal-500"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-900">
                      I consent to background and credit check *
                    </span>
                    <p className="text-xs text-gray-600 mt-1">
                      By checking this box, I authorize the property owner to conduct a background and credit check as part of the rental application process.
                    </p>
                  </div>
                </label>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowFillModal(false);
                    setSelectedApplication(null);
                  }}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition font-medium disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
