import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Users, FileText, Wrench, Calendar, Plus, Search, Filter } from 'lucide-react';
import ActiveTenants from './ActiveTenants';
import LeaseRenewalManager from './LeaseRenewalManager';
import RentalHistory from './RentalHistory';
import MaintenanceRequests from './MaintenanceRequests';
import TenantNotes from './TenantNotes';

type Tab = 'active' | 'renewals' | 'history' | 'maintenance' | 'notes';

interface TenantStats {
  activeTenants: number;
  pendingRenewals: number;
  openMaintenanceRequests: number;
  totalRevenue: number;
}

export default function TenantManagement() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('active');
  const [stats, setStats] = useState<TenantStats>({
    activeTenants: 0,
    pendingRenewals: 0,
    openMaintenanceRequests: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user]);

  const fetchStats = async () => {
    if (!user) return;

    try {
      const [agreementsRes, renewalsRes, maintenanceRes] = await Promise.all([
        supabase
          .from('rental_agreements')
          .select('monthly_rent, status')
          .eq('property_owner_id', user.id),
        supabase
          .from('lease_renewals')
          .select('status')
          .eq('property_owner_id', user.id)
          .eq('status', 'pending'),
        supabase
          .from('maintenance_requests')
          .select('status, property:properties!maintenance_requests_property_id_fkey(listed_by)')
          .in('status', ['pending', 'in_progress']),
      ]);

      const activeAgreements = agreementsRes.data?.filter(a => a.status === 'active') || [];
      const totalRevenue = activeAgreements.reduce((sum, a) => sum + Number(a.monthly_rent), 0);

      const ownerMaintenanceRequests = (maintenanceRes.data || []).filter(
        (req: any) => req.property?.listed_by === user.id
      );

      setStats({
        activeTenants: activeAgreements.length,
        pendingRenewals: renewalsRes.data?.length || 0,
        openMaintenanceRequests: ownerMaintenanceRequests.length,
        totalRevenue,
      });
    } catch (error) {
      console.error('Error fetching tenant stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'active' as Tab, label: 'Active Tenants', icon: Users },
    { id: 'renewals' as Tab, label: 'Lease Renewals', icon: FileText },
    { id: 'history' as Tab, label: 'Rental History', icon: Calendar },
    { id: 'maintenance' as Tab, label: 'Maintenance', icon: Wrench },
    { id: 'notes' as Tab, label: 'Tenant Notes', icon: FileText },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Tenant Management</h1>
        <p className="text-gray-600">
          Manage your tenants, track lease renewals, and handle maintenance requests
        </p>
      </div>

      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Tenants</p>
                <p className="text-2xl font-bold text-gray-900">{stats.activeTenants}</p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending Renewals</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pendingRenewals}</p>
              </div>
              <FileText className="w-8 h-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Open Requests</p>
                <p className="text-2xl font-bold text-gray-900">{stats.openMaintenanceRequests}</p>
              </div>
              <Wrench className="w-8 h-8 text-orange-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Monthly Revenue</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${stats.totalRevenue.toLocaleString()}
                </p>
              </div>
              <Calendar className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors
                    ${
                      activeTab === tab.id
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'active' && <ActiveTenants onUpdate={fetchStats} />}
          {activeTab === 'renewals' && <LeaseRenewalManager onUpdate={fetchStats} />}
          {activeTab === 'history' && <RentalHistory />}
          {activeTab === 'maintenance' && <MaintenanceRequests onUpdate={fetchStats} />}
          {activeTab === 'notes' && <TenantNotes />}
        </div>
      </div>
    </div>
  );
}
