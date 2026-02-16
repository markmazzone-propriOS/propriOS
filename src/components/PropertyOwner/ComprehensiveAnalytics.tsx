import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from '../Navigation/Router';
import {
  ArrowLeft,
  Users,
  TrendingDown,
  Clock,
  Home,
  Calendar,
  Award
} from 'lucide-react';

type AgreementStats = {
  totalAgreements: number;
  activeAgreements: number;
  avgTenure: number;
  turnoverRate: number;
  renewalRate: number;
  avgDaysVacant: number;
};

export function ComprehensiveAnalytics() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [agreementStats, setAgreementStats] = useState<AgreementStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadAllAnalytics();
    }
  }, [user]);

  const loadAllAnalytics = async () => {
    if (!user) return;

    try {
      setLoading(true);
      await loadTenantLifecycleMetrics();
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTenantLifecycleMetrics = async () => {
    if (!user) return;

    const { data: agreements } = await supabase
      .from('rental_agreements')
      .select('*')
      .eq('property_owner_id', user.id);

    if (!agreements) return;

    const totalAgreements = agreements.length;
    const activeAgreements = agreements.filter(a => a.status === 'active').length;

    const completedAgreements = agreements.filter(a =>
      a.status === 'expired' || a.status === 'terminated'
    );

    let totalTenureDays = 0;
    completedAgreements.forEach(agreement => {
      const start = new Date(agreement.lease_start_date);
      const end = agreement.move_out_date
        ? new Date(agreement.move_out_date)
        : new Date(agreement.lease_end_date);
      const tenure = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      totalTenureDays += tenure;
    });

    const avgTenure = completedAgreements.length > 0
      ? Math.floor(totalTenureDays / completedAgreements.length)
      : 0;

    const renewedAgreements = agreements.filter(a => a.renewed_from_agreement_id).length;
    const turnoverRate = completedAgreements.length > 0
      ? ((completedAgreements.length - renewedAgreements) / completedAgreements.length) * 100
      : 0;

    const renewalRate = completedAgreements.length > 0
      ? (renewedAgreements / completedAgreements.length) * 100
      : 0;

    const { data: properties } = await supabase
      .from('properties')
      .select('created_at, id')
      .eq('listed_by', user.id)
      .eq('listing_type', 'rent');

    let totalVacantDays = 0;
    let vacancyCount = 0;

    if (properties) {
      for (const property of properties) {
        const { data: propAgreements } = await supabase
          .from('rental_agreements')
          .select('lease_start_date, lease_end_date, move_out_date, status')
          .eq('property_id', property.id)
          .order('lease_start_date', { ascending: true });

        if (propAgreements && propAgreements.length > 0) {
          for (let i = 0; i < propAgreements.length - 1; i++) {
            const currentEnd = propAgreements[i].move_out_date
              ? new Date(propAgreements[i].move_out_date)
              : new Date(propAgreements[i].lease_end_date);
            const nextStart = new Date(propAgreements[i + 1].lease_start_date);
            const vacantDays = Math.floor((nextStart.getTime() - currentEnd.getTime()) / (1000 * 60 * 60 * 24));
            if (vacantDays > 0) {
              totalVacantDays += vacantDays;
              vacancyCount++;
            }
          }
        }
      }
    }

    const avgDaysVacant = vacancyCount > 0 ? Math.floor(totalVacantDays / vacancyCount) : 0;

    setAgreementStats({
      totalAgreements,
      activeAgreements,
      avgTenure,
      turnoverRate,
      renewalRate,
      avgDaysVacant
    });
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => navigate('/property-owner/dashboard')}
          className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition mb-6 group"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Back to Dashboard</span>
        </button>

        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-blue-900 to-gray-900 bg-clip-text text-transparent mb-2">
            Portfolio Analytics
          </h1>
          <p className="text-gray-600 text-lg">
            Comprehensive insights across all your properties
          </p>
        </div>

        <div className="space-y-8">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6">
              <div className="flex items-center gap-3">
                <Users className="text-white" size={28} />
                <h2 className="text-2xl font-bold text-white">Tenant Lifecycle Metrics</h2>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="p-5 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-blue-700">Active Tenants</p>
                    <Home className="text-blue-600" size={20} />
                  </div>
                  <p className="text-3xl font-bold text-blue-900">
                    {agreementStats?.activeAgreements || 0}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    of {agreementStats?.totalAgreements || 0} total
                  </p>
                </div>

                <div className="p-5 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl border border-emerald-200">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-emerald-700">Avg Tenure</p>
                    <Clock className="text-emerald-600" size={20} />
                  </div>
                  <p className="text-3xl font-bold text-emerald-900">
                    {agreementStats?.avgTenure || 0}
                  </p>
                  <p className="text-xs text-emerald-600 mt-1">days</p>
                </div>

                <div className="p-5 bg-gradient-to-br from-teal-50 to-teal-100 rounded-xl border border-teal-200">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-teal-700">Renewal Rate</p>
                    <Award className="text-teal-600" size={20} />
                  </div>
                  <p className="text-3xl font-bold text-teal-900">
                    {agreementStats?.renewalRate.toFixed(1) || 0}%
                  </p>
                  <p className="text-xs text-teal-600 mt-1">tenant retention</p>
                </div>

                <div className="p-5 bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl border border-amber-200">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-amber-700">Turnover Rate</p>
                    <TrendingDown className="text-amber-600" size={20} />
                  </div>
                  <p className="text-3xl font-bold text-amber-900">
                    {agreementStats?.turnoverRate.toFixed(1) || 0}%
                  </p>
                  <p className="text-xs text-amber-600 mt-1">tenant turnover</p>
                </div>

                <div className="p-5 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border border-orange-200">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-orange-700">Avg Days Vacant</p>
                    <Calendar className="text-orange-600" size={20} />
                  </div>
                  <p className="text-3xl font-bold text-orange-900">
                    {agreementStats?.avgDaysVacant || 0}
                  </p>
                  <p className="text-xs text-orange-600 mt-1">between tenants</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
