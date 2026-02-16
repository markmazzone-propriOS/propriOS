import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Calendar, Home, User, DollarSign, FileText, Filter } from 'lucide-react';

interface RentalAgreement {
  id: string;
  property_id: string;
  renter_id: string;
  monthly_rent: number;
  security_deposit: number;
  lease_start_date: string;
  lease_end_date: string;
  status: string;
  move_out_date: string | null;
  move_out_reason: string | null;
  created_at: string;
  property: {
    address_line1: string;
    city: string;
    state: string;
  };
  renter: {
    full_name: string;
  };
}

export default function RentalHistory() {
  const { user } = useAuth();
  const [agreements, setAgreements] = useState<RentalAgreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'expired' | 'terminated'>('all');
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
            full_name
          )
        `)
        .eq('property_owner_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setAgreements((data as any) || []);
    } catch (error) {
      console.error('Error fetching rental history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredAgreements = () => {
    let filtered = agreements;

    if (filter !== 'all') {
      filtered = filtered.filter(a => a.status === filter);
    }

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        a =>
          a.renter?.full_name?.toLowerCase().includes(searchLower) ||
          a.property?.address_line1?.toLowerCase().includes(searchLower) ||
          a.property?.city?.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  };

  const getDuration = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    return months;
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      active: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      expired: 'bg-gray-100 text-gray-800',
      terminated: 'bg-red-100 text-red-800',
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badges[status as keyof typeof badges] || badges.pending}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const filteredAgreements = getFilteredAgreements();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Rental History</h2>
        <p className="text-gray-600 mt-1">View all rental agreements across all properties</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by tenant or property..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'active'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setFilter('expired')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'expired'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Expired
          </button>
          <button
            onClick={() => setFilter('terminated')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'terminated'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Terminated
          </button>
        </div>
      </div>

      {filteredAgreements.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Rental History</h3>
          <p className="text-gray-600">
            {searchTerm || filter !== 'all'
              ? 'No agreements match your filters'
              : 'Your rental history will appear here'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAgreements.map((agreement) => {
            const duration = getDuration(agreement.lease_start_date, agreement.lease_end_date);
            const totalRent = Number(agreement.monthly_rent) * duration;

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
                  {getStatusBadge(agreement.status)}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-t border-b border-gray-200">
                  <div>
                    <p className="text-sm text-gray-500">Lease Term</p>
                    <p className="font-medium text-gray-900">
                      {new Date(agreement.lease_start_date).toLocaleDateString()} -{' '}
                      {new Date(agreement.lease_end_date).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{duration} months</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Monthly Rent</p>
                    <p className="font-medium text-gray-900">
                      ${Number(agreement.monthly_rent).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Security Deposit</p>
                    <p className="font-medium text-gray-900">
                      ${Number(agreement.security_deposit).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Revenue</p>
                    <p className="font-medium text-gray-900">
                      ${totalRent.toLocaleString()}
                    </p>
                  </div>
                </div>

                {(agreement.move_out_date || agreement.move_out_reason) && (
                  <div className="mt-4 bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Move Out Information</h4>
                    {agreement.move_out_date && (
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Date:</span>{' '}
                        {new Date(agreement.move_out_date).toLocaleDateString()}
                      </p>
                    )}
                    {agreement.move_out_reason && (
                      <p className="text-sm text-gray-700 mt-1">
                        <span className="font-medium">Reason:</span> {agreement.move_out_reason}
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-4 text-xs text-gray-500">
                  Agreement created on {new Date(agreement.created_at).toLocaleDateString()}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {filteredAgreements.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-blue-900">Summary</h3>
              <p className="text-sm text-blue-700 mt-1">
                Showing {filteredAgreements.length} of {agreements.length} total agreements
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-blue-700">Total Revenue (All Time)</p>
              <p className="text-2xl font-bold text-blue-900">
                $
                {agreements
                  .reduce((sum, a) => {
                    const duration = getDuration(a.lease_start_date, a.lease_end_date);
                    return sum + Number(a.monthly_rent) * duration;
                  }, 0)
                  .toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
