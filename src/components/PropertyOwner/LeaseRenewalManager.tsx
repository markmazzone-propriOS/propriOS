import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { FileText, Plus, Calendar, DollarSign, User, CheckCircle, XCircle, Clock, Send } from 'lucide-react';

interface RentalAgreement {
  id: string;
  property_id: string;
  renter_id: string;
  monthly_rent: number;
  lease_end_date: string;
  property: {
    address_line1: string;
    city: string;
  };
  renter: {
    full_name: string;
  };
}

interface LeaseRenewal {
  id: string;
  rental_agreement_id: string;
  property_owner_id: string;
  renter_id: string;
  current_lease_end_date: string;
  proposed_start_date: string;
  proposed_end_date: string;
  proposed_rent: number;
  status: string;
  renter_response: string | null;
  owner_notes: string | null;
  responded_at: string | null;
  created_at: string;
  rental_agreement: {
    property: {
      address_line1: string;
      city: string;
    };
    renter: {
      full_name: string;
    };
  };
}

interface LeaseRenewalManagerProps {
  onUpdate: () => void;
}

export default function LeaseRenewalManager({ onUpdate }: LeaseRenewalManagerProps) {
  const { user } = useAuth();
  const [renewals, setRenewals] = useState<LeaseRenewal[]>([]);
  const [agreements, setAgreements] = useState<RentalAgreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAgreement, setSelectedAgreement] = useState<string>('');
  const [formData, setFormData] = useState({
    proposed_start_date: '',
    proposed_end_date: '',
    proposed_rent: '',
    owner_notes: '',
  });

  useEffect(() => {
    if (user) {
      fetchRenewals();
      fetchExpiringAgreements();
    }
  }, [user]);

  const fetchRenewals = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('lease_renewals')
        .select(`
          *,
          rental_agreement:rental_agreements!lease_renewals_rental_agreement_id_fkey(
            property:properties!rental_agreements_property_id_fkey(
              address_line1,
              city
            ),
            renter:profiles!rental_agreements_renter_id_fkey(
              full_name
            )
          )
        `)
        .eq('property_owner_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setRenewals((data as any) || []);
    } catch (error) {
      console.error('Error fetching renewals:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchExpiringAgreements = async () => {
    if (!user) return;

    try {
      const threeMonthsFromNow = new Date();
      threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);

      const { data, error } = await supabase
        .from('rental_agreements')
        .select(`
          *,
          property:properties!rental_agreements_property_id_fkey(
            address,
            city
          ),
          renter:profiles!rental_agreements_renter_id_fkey(
            full_name
          )
        `)
        .eq('property_owner_id', user.id)
        .eq('status', 'active')
        .lte('lease_end_date', threeMonthsFromNow.toISOString().split('T')[0])
        .order('lease_end_date', { ascending: true });

      if (error) throw error;

      setAgreements((data as any) || []);
    } catch (error) {
      console.error('Error fetching expiring agreements:', error);
    }
  };

  const handleCreateRenewal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedAgreement) return;

    try {
      const agreement = agreements.find(a => a.id === selectedAgreement);
      if (!agreement) return;

      const { error } = await supabase.from('lease_renewals').insert({
        rental_agreement_id: selectedAgreement,
        property_owner_id: user.id,
        renter_id: agreement.renter_id,
        current_lease_end_date: agreement.lease_end_date,
        proposed_start_date: formData.proposed_start_date,
        proposed_end_date: formData.proposed_end_date,
        proposed_rent: parseFloat(formData.proposed_rent),
        owner_notes: formData.owner_notes || null,
        status: 'pending',
      });

      if (error) throw error;

      alert('Lease renewal offer sent successfully!');
      setShowCreateModal(false);
      setSelectedAgreement('');
      setFormData({
        proposed_start_date: '',
        proposed_end_date: '',
        proposed_rent: '',
        owner_notes: '',
      });
      fetchRenewals();
      onUpdate();
    } catch (error: any) {
      console.error('Error creating renewal:', error);
      alert('Failed to create renewal offer: ' + error.message);
    }
  };

  const handleCancelRenewal = async (renewalId: string) => {
    if (!confirm('Are you sure you want to cancel this renewal offer?')) return;

    try {
      const { error } = await supabase
        .from('lease_renewals')
        .update({ status: 'cancelled' })
        .eq('id', renewalId);

      if (error) throw error;

      fetchRenewals();
      onUpdate();
    } catch (error: any) {
      console.error('Error cancelling renewal:', error);
      alert('Failed to cancel renewal: ' + error.message);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pending' },
      approved: { color: 'bg-blue-100 text-blue-800', icon: CheckCircle, label: 'Approved' },
      rejected: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Rejected' },
      signed: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Signed' },
      cancelled: { color: 'bg-gray-100 text-gray-800', icon: XCircle, label: 'Cancelled' },
    };

    const badge = badges[status as keyof typeof badges] || badges.pending;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {badge.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Lease Renewals</h2>
          <p className="text-gray-600 mt-1">Manage lease renewal offers and responses</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Create Renewal Offer
        </button>
      </div>

      {agreements.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-yellow-900">Leases Expiring Soon</h3>
              <p className="text-sm text-yellow-700 mt-1">
                You have {agreements.length} lease{agreements.length !== 1 ? 's' : ''} expiring in the next 3 months
              </p>
            </div>
          </div>
        </div>
      )}

      {renewals.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Lease Renewals</h3>
          <p className="text-gray-600">
            Create renewal offers for leases that are expiring soon
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {renewals.map((renewal) => (
            <div
              key={renewal.id}
              className="bg-white border border-gray-200 rounded-lg p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {renewal.rental_agreement?.renter?.full_name}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {renewal.rental_agreement?.property?.address}, {renewal.rental_agreement?.property?.city}
                  </p>
                </div>
                {getStatusBadge(renewal.status)}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-t border-b border-gray-200">
                <div>
                  <p className="text-sm text-gray-500">Current End Date</p>
                  <p className="font-medium">
                    {new Date(renewal.current_lease_end_date).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Proposed Start</p>
                  <p className="font-medium">
                    {new Date(renewal.proposed_start_date).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Proposed End</p>
                  <p className="font-medium">
                    {new Date(renewal.proposed_end_date).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Proposed Rent</p>
                  <p className="font-medium">
                    ${Number(renewal.proposed_rent).toLocaleString()}/mo
                  </p>
                </div>
              </div>

              {renewal.renter_response && (
                <div className="mt-4 bg-blue-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-blue-900 mb-1">Tenant Response:</p>
                  <p className="text-sm text-blue-800">{renewal.renter_response}</p>
                  {renewal.responded_at && (
                    <p className="text-xs text-blue-600 mt-2">
                      Responded on {new Date(renewal.responded_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}

              {renewal.owner_notes && (
                <div className="mt-4 bg-gray-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-900 mb-1">Your Notes:</p>
                  <p className="text-sm text-gray-700">{renewal.owner_notes}</p>
                </div>
              )}

              {renewal.status === 'pending' && (
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => handleCancelRenewal(renewal.id)}
                    className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Cancel Offer
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Create Lease Renewal Offer</h2>
            </div>

            <form onSubmit={handleCreateRenewal} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Tenant
                </label>
                <select
                  value={selectedAgreement}
                  onChange={(e) => {
                    const agreement = agreements.find(a => a.id === e.target.value);
                    setSelectedAgreement(e.target.value);
                    if (agreement) {
                      setFormData(prev => ({
                        ...prev,
                        proposed_rent: agreement.monthly_rent.toString(),
                      }));
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Choose a tenant...</option>
                  {agreements.map((agreement) => (
                    <option key={agreement.id} value={agreement.id}>
                      {agreement.renter?.full_name} - {agreement.property?.address_line1} (Expires: {new Date(agreement.lease_end_date).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Proposed Start Date
                  </label>
                  <input
                    type="date"
                    value={formData.proposed_start_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, proposed_start_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Proposed End Date
                  </label>
                  <input
                    type="date"
                    value={formData.proposed_end_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, proposed_end_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Proposed Monthly Rent
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.proposed_rent}
                  onChange={(e) => setFormData(prev => ({ ...prev, proposed_rent: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={formData.owner_notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, owner_notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Add any additional notes about this renewal offer..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Send Renewal Offer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setSelectedAgreement('');
                    setFormData({
                      proposed_start_date: '',
                      proposed_end_date: '',
                      proposed_rent: '',
                      owner_notes: '',
                    });
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
