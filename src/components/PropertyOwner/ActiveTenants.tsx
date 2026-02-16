import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { User, Mail, Phone, Home, Calendar, DollarSign, FileText, Plus, X, Users } from 'lucide-react';

interface RentalAgreement {
  id: string;
  property_id: string;
  renter_id: string;
  monthly_rent: number;
  security_deposit: number;
  lease_start_date: string;
  lease_end_date: string;
  status: string;
  payment_due_day: number;
  property: {
    address_line1: string;
    city: string;
    state: string;
  };
  renter: {
    id: string;
    full_name: string;
    phone_number: string;
  };
}

interface ActiveTenantsProps {
  onUpdate: () => void;
}

export default function ActiveTenants({ onUpdate }: ActiveTenantsProps) {
  const { user } = useAuth();
  const [agreements, setAgreements] = useState<RentalAgreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState<RentalAgreement | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (user) {
      fetchAgreements();
    }
  }, [user]);

  const fetchAgreements = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('rental_agreements')
        .select(`
          *,
          property:properties!rental_agreements_property_id_fkey(
            address_line1,
            city,
            state
          ),
          renter:profiles!rental_agreements_renter_id_fkey(
            id,
            full_name,
            phone_number
          )
        `)
        .eq('property_owner_id', user.id)
        .eq('status', 'active')
        .order('lease_end_date', { ascending: true });

      if (error) throw error;

      setAgreements((data as any) || []);
    } catch (error) {
      console.error('Error fetching rental agreements:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysUntilLeaseEnd = (endDate: string) => {
    const end = new Date(endDate);
    const today = new Date();
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const filteredAgreements = agreements.filter((agreement) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      agreement.renter?.full_name?.toLowerCase().includes(searchLower) ||
      agreement.property?.address_line1?.toLowerCase().includes(searchLower) ||
      agreement.property?.city?.toLowerCase().includes(searchLower)
    );
  });

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
        <div className="flex-1 max-w-md">
          <div className="relative">
            <input
              type="text"
              placeholder="Search tenants or properties..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <User className="h-5 w-5 text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      {filteredAgreements.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Tenants</h3>
          <p className="text-gray-600">
            {searchTerm ? 'No tenants match your search.' : 'You don\'t have any active tenants yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredAgreements.map((agreement) => {
            const daysUntilEnd = getDaysUntilLeaseEnd(agreement.lease_end_date);
            const isExpiringSoon = daysUntilEnd <= 90 && daysUntilEnd > 0;

            return (
              <div
                key={agreement.id}
                className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {agreement.renter?.full_name || 'Unknown Tenant'}
                      </h3>
                      <p className="text-gray-600 flex items-center gap-1 mt-1">
                        <Home className="w-4 h-4" />
                        {agreement.property?.address_line1}, {agreement.property?.city}, {agreement.property?.state}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedTenant(agreement)}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    View Details
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-200">
                  <div>
                    <p className="text-sm text-gray-500">Monthly Rent</p>
                    <p className="font-semibold text-gray-900">
                      ${Number(agreement.monthly_rent).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Payment Due</p>
                    <p className="font-semibold text-gray-900">Day {agreement.payment_due_day}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Lease End</p>
                    <p className="font-semibold text-gray-900">
                      {new Date(agreement.lease_end_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    {isExpiringSoon ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        Expiring in {daysUntilEnd} days
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-200 text-sm text-gray-600">
                  {agreement.renter?.phone_number && (
                    <div className="flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      {agreement.renter.phone_number}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedTenant && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Tenant Details</h2>
              <button
                onClick={() => setSelectedTenant(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Name</p>
                    <p className="font-medium">{selectedTenant.renter?.full_name}</p>
                  </div>
                  {selectedTenant.renter?.phone_number && (
                    <div>
                      <p className="text-sm text-gray-500">Phone</p>
                      <p className="font-medium">{selectedTenant.renter.phone_number}</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Property Information</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="font-medium">
                    {selectedTenant.property?.address_line1}
                  </p>
                  <p className="text-gray-600">
                    {selectedTenant.property?.city}, {selectedTenant.property?.state}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Lease Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Monthly Rent</p>
                    <p className="font-medium text-lg">
                      ${Number(selectedTenant.monthly_rent).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Security Deposit</p>
                    <p className="font-medium text-lg">
                      ${Number(selectedTenant.security_deposit).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Payment Due Day</p>
                    <p className="font-medium">Day {selectedTenant.payment_due_day} of each month</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Lease Term</p>
                    <p className="font-medium">
                      {new Date(selectedTenant.lease_start_date).toLocaleDateString()} -{' '}
                      {new Date(selectedTenant.lease_end_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
