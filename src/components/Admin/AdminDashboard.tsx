import { useState, useEffect } from 'react';
import { Users, Building2, Briefcase, DollarSign, AlertTriangle, Activity, LifeBuoy } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from '../Navigation/Router';

type DashboardStats = {
  totalUsers: number;
  suspendedUsers: number;
  totalAgents: number;
  totalLenders: number;
  totalProviders: number;
  totalListings: number;
  activeListings: number;
  openTickets: number;
  urgentTickets: number;
};

export function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    suspendedUsers: 0,
    totalAgents: 0,
    totalLenders: 0,
    totalProviders: 0,
    totalListings: 0,
    activeListings: 0,
    openTickets: 0,
    urgentTickets: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminAccess();
  }, [user]);

  const checkAdminAccess = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        navigate('/dashboard');
        return;
      }

      setIsAdmin(true);
      loadStats();
    } catch (error) {
      console.error('Error checking admin access:', error);
      navigate('/dashboard');
    }
  };

  const loadStats = async () => {
    try {
      const [
        { count: totalUsers },
        { count: suspendedUsers },
        { count: totalAgents },
        { count: totalLenders },
        { count: totalProviders },
        { count: totalListings },
        { count: activeListings },
        { count: openTickets },
        { count: urgentTickets },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_suspended', true),
        supabase.from('agent_profiles').select('*', { count: 'exact', head: true }),
        supabase.from('mortgage_lender_profiles').select('*', { count: 'exact', head: true }),
        supabase.from('service_provider_profiles').select('*', { count: 'exact', head: true }),
        supabase.from('properties').select('*', { count: 'exact', head: true }),
        supabase.from('properties').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('support_tickets').select('*', { count: 'exact', head: true }).in('status', ['open', 'in_progress']),
        supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('priority', 'urgent').in('status', ['open', 'in_progress']),
      ]);

      setStats({
        totalUsers: totalUsers || 0,
        suspendedUsers: suspendedUsers || 0,
        totalAgents: totalAgents || 0,
        totalLenders: totalLenders || 0,
        totalProviders: totalProviders || 0,
        totalListings: totalListings || 0,
        activeListings: activeListings || 0,
        openTickets: openTickets || 0,
        urgentTickets: urgentTickets || 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <h1 className="text-4xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-blue-100">System overview and management</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <button
            onClick={() => navigate('/admin/user-growth')}
            className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500 hover:shadow-lg hover:border-blue-600 transition text-left"
          >
            <div className="flex items-center justify-between mb-2">
              <Users className="text-blue-500" size={32} />
              <span className="text-3xl font-bold text-gray-800">{stats.totalUsers}</span>
            </div>
            <p className="text-gray-600 font-medium">Total Users</p>
            {stats.suspendedUsers > 0 && (
              <p className="text-sm text-red-600 mt-2">
                {stats.suspendedUsers} suspended
              </p>
            )}
          </button>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between mb-2">
              <Building2 className="text-green-500" size={32} />
              <span className="text-3xl font-bold text-gray-800">{stats.totalAgents}</span>
            </div>
            <p className="text-gray-600 font-medium">Real Estate Agents</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="text-purple-500" size={32} />
              <span className="text-3xl font-bold text-gray-800">{stats.totalLenders}</span>
            </div>
            <p className="text-gray-600 font-medium">Mortgage Lenders</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
            <div className="flex items-center justify-between mb-2">
              <Briefcase className="text-orange-500" size={32} />
              <span className="text-3xl font-bold text-gray-800">{stats.totalProviders}</span>
            </div>
            <p className="text-gray-600 font-medium">Service Providers</p>
          </div>

          <button
            onClick={() => navigate('/admin/support')}
            className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500 hover:shadow-lg hover:border-red-600 transition text-left"
          >
            <div className="flex items-center justify-between mb-2">
              <LifeBuoy className="text-red-500" size={32} />
              <span className="text-3xl font-bold text-gray-800">{stats.openTickets}</span>
            </div>
            <p className="text-gray-600 font-medium">Open Support Tickets</p>
            {stats.urgentTickets > 0 && (
              <p className="text-sm text-red-600 mt-2 font-semibold">
                {stats.urgentTickets} urgent ticket{stats.urgentTickets !== 1 ? 's' : ''}
              </p>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-4">
              <Activity className="text-blue-600" size={24} />
              <h2 className="text-xl font-bold text-gray-800">Property Listings</h2>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Listings</span>
                <span className="text-2xl font-bold text-gray-800">{stats.totalListings}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Active Listings</span>
                <span className="text-2xl font-bold text-green-600">{stats.activeListings}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Inactive Listings</span>
                <span className="text-2xl font-bold text-gray-500">
                  {stats.totalListings - stats.activeListings}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="text-orange-600" size={24} />
              <h2 className="text-xl font-bold text-gray-800">System Alerts</h2>
            </div>
            <div className="space-y-3">
              {stats.suspendedUsers > 0 && (
                <div className="flex items-center gap-2 text-red-600">
                  <AlertTriangle size={16} />
                  <span>{stats.suspendedUsers} suspended account{stats.suspendedUsers !== 1 ? 's' : ''}</span>
                </div>
              )}
              {stats.suspendedUsers === 0 && (
                <p className="text-gray-500">No alerts at this time</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => navigate('/admin/accounts')}
              className="flex items-center gap-3 p-4 border-2 border-gray-300 rounded-lg hover:border-blue-600 hover:bg-blue-50 transition"
            >
              <Users className="text-blue-600" size={24} />
              <div className="text-left">
                <p className="font-semibold text-gray-800">Manage Accounts</p>
                <p className="text-sm text-gray-600">View and manage user accounts</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/admin/listings')}
              className="flex items-center gap-3 p-4 border-2 border-gray-300 rounded-lg hover:border-blue-600 hover:bg-blue-50 transition"
            >
              <Building2 className="text-blue-600" size={24} />
              <div className="text-left">
                <p className="font-semibold text-gray-800">Manage Listings</p>
                <p className="text-sm text-gray-600">View and manage property listings</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/admin/support')}
              className="flex items-center gap-3 p-4 border-2 border-gray-300 rounded-lg hover:border-blue-600 hover:bg-blue-50 transition"
            >
              <LifeBuoy className="text-blue-600" size={24} />
              <div className="text-left">
                <p className="font-semibold text-gray-800">Support Tickets</p>
                <p className="text-sm text-gray-600">View and respond to user tickets</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-3 p-4 border-2 border-gray-300 rounded-lg hover:border-blue-600 hover:bg-blue-50 transition"
            >
              <Activity className="text-blue-600" size={24} />
              <div className="text-left">
                <p className="font-semibold text-gray-800">Exit Admin Portal</p>
                <p className="text-sm text-gray-600">Return to main dashboard</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
