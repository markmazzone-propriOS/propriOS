import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Target, Users, Home, Award, Calendar, BarChart3, PieChart, TrendingDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface PricingAccuracy {
  listPrice: number;
  soldPrice: number;
  address: string;
  propertyId: string;
  soldDate: string;
}

interface Analytics {
  totalActiveDeals: number;
  totalPipelineValue: number;
  totalPipelineCommission: number;
  closedDeals: number;
  totalRevenue: number;
  averageDealValue: number;
  averageCommission: number;
  averageDaysToClose: number;
  conversionRate: number;
  activeListings: number;
  soldListings: number;
  totalClients: number;
  monthlyStats: MonthlyStats[];
  dealsByStage: { stage: string; count: number; value: number }[];
  dealsByType: { type: string; count: number; value: number }[];
  leadSources: { source: string; count: number }[];
  pricingAccuracy: PricingAccuracy[];
}

interface MonthlyStats {
  month: string;
  closedDeals: number;
  revenue: number;
  averageValue: number;
}

export function AgentAnalytics() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'30d' | '90d' | 'ytd' | 'all'>('all');

  useEffect(() => {
    if (user) {
      loadAnalytics();
    }
  }, [user, timeRange]);

  const loadAnalytics = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const dateFilter = getDateFilter(timeRange);

      // Load active transactions (pipeline) - always show current active deals, no time filter
      const { data: activeTransactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('agent_id', user.id)
        .eq('status', 'active');

      // Load closed/won transactions - filter by close date
      const { data: wonTransactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('agent_id', user.id)
        .eq('status', 'won')
        .gte('actual_close_date', dateFilter);

      // Load all transactions created in time range for conversion calculation
      const { data: allTransactionsCreated } = await supabase
        .from('transactions')
        .select('*')
        .eq('agent_id', user.id)
        .gte('created_at', dateFilter);

      // Load won transactions in time range for conversion calculation
      const { data: wonInRange } = await supabase
        .from('transactions')
        .select('*')
        .eq('agent_id', user.id)
        .in('status', ['won', 'lost'])
        .gte('actual_close_date', dateFilter);

      // Load properties
      const { data: properties } = await supabase
        .from('properties')
        .select('*')
        .or(`agent_id.eq.${user.id},listed_by.eq.${user.id}`);

      // Load clients
      const { data: clients } = await supabase
        .from('profiles')
        .select('id')
        .eq('assigned_agent_id', user.id);

      const activeDeals = activeTransactions || [];
      const closedDeals = wonTransactions || [];
      const wonDealsInRange = wonInRange || [];

      // Calculate metrics
      const totalPipelineValue = activeDeals.reduce((sum, t) => sum + (t.deal_value || 0), 0);
      const totalPipelineCommission = activeDeals.reduce((sum, t) => sum + (t.commission_amount || 0), 0);
      const totalRevenue = closedDeals.reduce((sum, t) => sum + (t.commission_amount || 0), 0);
      const averageDealValue = closedDeals.length > 0
        ? closedDeals.reduce((sum, t) => sum + (t.deal_value || 0), 0) / closedDeals.length
        : 0;
      const averageCommission = closedDeals.length > 0
        ? totalRevenue / closedDeals.length
        : 0;

      // Calculate average days to close (using only closed deals in time range)
      const daysToClose = closedDeals
        .filter(t => t.created_at && t.actual_close_date)
        .map(t => {
          const start = new Date(t.created_at).getTime();
          const end = new Date(t.actual_close_date!).getTime();
          return (end - start) / (1000 * 60 * 60 * 24);
        });
      const averageDaysToClose = daysToClose.length > 0
        ? daysToClose.reduce((sum, days) => sum + days, 0) / daysToClose.length
        : 0;

      // Calculate conversion rate (won vs total closed in time range)
      const totalClosedInRange = wonDealsInRange.length;
      const wonCount = wonDealsInRange.filter(t => t.status === 'won').length;
      const conversionRate = totalClosedInRange > 0
        ? (wonCount / totalClosedInRange) * 100
        : 0;

      // Monthly stats
      const monthlyStats = calculateMonthlyStats(closedDeals, timeRange);

      // Deals by stage
      const dealsByStage = calculateDealsByStage(activeDeals);

      // Deals by type (only include closed deals for time-filtered view)
      const dealsByType = calculateDealsByType(closedDeals);

      // Lead sources (use closed deals for consistent time filtering)
      const leadSources = calculateLeadSources(closedDeals);

      // Pricing accuracy analysis
      const { data: soldPropertiesWithOffers, error: pricingError } = await supabase
        .from('properties')
        .select(`
          id,
          price,
          address_line1,
          city,
          state,
          updated_at,
          property_offers!inner(
            offer_amount,
            offer_status,
            updated_at
          )
        `)
        .or(`agent_id.eq.${user.id},listed_by.eq.${user.id}`)
        .eq('status', 'sold')
        .eq('property_offers.offer_status', 'accepted')
        .gte('property_offers.updated_at', dateFilter);

      const pricingAccuracy: PricingAccuracy[] = (soldPropertiesWithOffers || []).map((property: any) => {
        const acceptedOffer = property.property_offers[0];
        return {
          listPrice: property.price,
          soldPrice: acceptedOffer.offer_amount,
          address: `${property.address_line1}, ${property.city}, ${property.state}`,
          propertyId: property.id,
          soldDate: acceptedOffer.updated_at
        };
      });

      setAnalytics({
        totalActiveDeals: activeDeals.length,
        totalPipelineValue,
        totalPipelineCommission,
        closedDeals: closedDeals.length,
        totalRevenue,
        averageDealValue,
        averageCommission,
        averageDaysToClose,
        conversionRate,
        activeListings: properties?.filter(p => p.status === 'active').length || 0,
        soldListings: properties?.filter(p => p.status === 'sold').length || 0,
        totalClients: clients?.length || 0,
        monthlyStats,
        dealsByStage,
        dealsByType,
        leadSources,
        pricingAccuracy
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDateFilter = (range: string): string => {
    const now = new Date();
    switch (range) {
      case '30d':
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return thirtyDaysAgo.toISOString();
      case '90d':
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        return ninetyDaysAgo.toISOString();
      case 'ytd':
        return new Date(now.getFullYear(), 0, 1).toISOString();
      case 'all':
      default:
        return '1970-01-01';
    }
  };

  const calculateMonthlyStats = (deals: any[], range: string): MonthlyStats[] => {
    const monthsMap = new Map<string, { closedDeals: number; revenue: number; totalValue: number }>();

    deals.forEach(deal => {
      if (!deal.actual_close_date) return;
      const date = new Date(deal.actual_close_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      const existing = monthsMap.get(monthKey) || { closedDeals: 0, revenue: 0, totalValue: 0 };
      monthsMap.set(monthKey, {
        closedDeals: existing.closedDeals + 1,
        revenue: existing.revenue + (deal.commission_amount || 0),
        totalValue: existing.totalValue + (deal.deal_value || 0)
      });
    });

    const sortedMonths = Array.from(monthsMap.entries())
      .map(([month, stats]) => ({
        month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        closedDeals: stats.closedDeals,
        revenue: stats.revenue,
        averageValue: stats.closedDeals > 0 ? stats.totalValue / stats.closedDeals : 0
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // For 30d: show only the current month
    // For 90d: show last 3 months
    // For YTD and all time: show last 6 months
    if (range === '30d') {
      return sortedMonths.slice(-1);
    } else if (range === '90d') {
      return sortedMonths.slice(-3);
    }
    return sortedMonths.slice(-6);
  };

  const calculateDealsByStage = (deals: any[]) => {
    const stagesMap = new Map<string, { count: number; value: number }>();

    deals.forEach(deal => {
      const existing = stagesMap.get(deal.stage) || { count: 0, value: 0 };
      stagesMap.set(deal.stage, {
        count: existing.count + 1,
        value: existing.value + (deal.deal_value || 0)
      });
    });

    return Array.from(stagesMap.entries()).map(([stage, data]) => ({
      stage: stage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      count: data.count,
      value: data.value
    }));
  };

  const calculateDealsByType = (deals: any[]) => {
    const typesMap = new Map<string, { count: number; value: number }>();

    deals.forEach(deal => {
      const existing = typesMap.get(deal.transaction_type) || { count: 0, value: 0 };
      typesMap.set(deal.transaction_type, {
        count: existing.count + 1,
        value: existing.value + (deal.deal_value || 0)
      });
    });

    return Array.from(typesMap.entries()).map(([type, data]) => ({
      type: type === 'buyer_side' ? 'Buyer Side' : 'Seller Side',
      count: data.count,
      value: data.value
    }));
  };

  const calculateLeadSources = (deals: any[]) => {
    const sourcesMap = new Map<string, number>();

    deals.forEach(deal => {
      if (!deal.lead_source) return;
      const count = sourcesMap.get(deal.lead_source) || 0;
      sourcesMap.set(deal.lead_source, count + 1);
    });

    return Array.from(sourcesMap.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12 text-gray-600">
        Failed to load analytics data
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Analytics Dashboard</h2>
          <p className="text-gray-600 mt-1">Track your performance and business metrics</p>
        </div>
        <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-300 p-1">
          <button
            onClick={() => setTimeRange('30d')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              timeRange === '30d' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            30 Days
          </button>
          <button
            onClick={() => setTimeRange('90d')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              timeRange === '90d' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            90 Days
          </button>
          <button
            onClick={() => setTimeRange('ytd')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              timeRange === 'ytd' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            YTD
          </button>
          <button
            onClick={() => setTimeRange('all')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              timeRange === 'all' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            All Time
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <DollarSign size={32} />
            <div className="text-right">
              <p className="text-green-100 text-sm">Total Revenue</p>
              <p className="text-3xl font-bold">{formatCurrency(analytics.totalRevenue)}</p>
            </div>
          </div>
          <p className="text-green-100 text-sm mt-2">{analytics.closedDeals} closed deals</p>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp size={32} />
            <div className="text-right">
              <p className="text-blue-100 text-sm">Pipeline Value</p>
              <p className="text-3xl font-bold">{formatCurrency(analytics.totalPipelineValue)}</p>
            </div>
          </div>
          <p className="text-blue-100 text-sm mt-2">{analytics.totalActiveDeals} active deals</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Target size={32} />
            <div className="text-right">
              <p className="text-orange-100 text-sm">Conversion Rate</p>
              <p className="text-3xl font-bold">{formatPercent(analytics.conversionRate)}</p>
            </div>
          </div>
          <p className="text-orange-100 text-sm mt-2">Lead to close ratio</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Award size={32} />
            <div className="text-right">
              <p className="text-purple-100 text-sm">Avg. Commission</p>
              <p className="text-3xl font-bold">{formatCurrency(analytics.averageCommission)}</p>
            </div>
          </div>
          <p className="text-purple-100 text-sm mt-2">Per closed deal</p>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <DollarSign size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Avg. Deal Value</p>
              <p className="text-xl font-bold text-gray-800">{formatCurrency(analytics.averageDealValue)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <Calendar size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Avg. Days to Close</p>
              <p className="text-xl font-bold text-gray-800">{Math.round(analytics.averageDaysToClose)} days</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Home size={20} className="text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active Listings</p>
              <p className="text-xl font-bold text-gray-800">{analytics.activeListings}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Users size={20} className="text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Clients</p>
              <p className="text-xl font-bold text-gray-800">{analytics.totalClients}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Performance */}
      {analytics.monthlyStats.length > 0 && (
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={24} className="text-blue-600" />
            <h3 className="text-lg font-bold text-gray-800">Monthly Performance</h3>
          </div>
          <div className="space-y-3">
            {analytics.monthlyStats.map((month) => (
              <div key={month.month} className="flex items-center gap-4">
                <div className="w-24 text-sm font-medium text-gray-600">{month.month}</div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">{month.closedDeals} deals</span>
                    <span className="text-sm font-semibold text-green-600">{formatCurrency(month.revenue)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full"
                      style={{
                        width: `${Math.min((month.revenue / (analytics.monthlyStats.reduce((max, m) => Math.max(max, m.revenue), 0))) * 100, 100)}%`
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Deals by Type */}
        {analytics.dealsByType.length > 0 && (
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <PieChart size={24} className="text-blue-600" />
              <h3 className="text-lg font-bold text-gray-800">Deals by Type</h3>
            </div>
            <div className="space-y-3">
              {analytics.dealsByType.map((item) => (
                <div key={item.type}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{item.type}</span>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-gray-800">{item.count} deals</span>
                      <span className="text-xs text-gray-500 ml-2">{formatCurrency(item.value)}</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${item.type === 'Buyer Side' ? 'bg-blue-500' : 'bg-green-500'}`}
                      style={{
                        width: `${(item.count / analytics.dealsByType.reduce((sum, d) => sum + d.count, 0)) * 100}%`
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lead Sources */}
        {analytics.leadSources.length > 0 && (
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={24} className="text-blue-600" />
              <h3 className="text-lg font-bold text-gray-800">Top Lead Sources</h3>
            </div>
            <div className="space-y-3">
              {analytics.leadSources.map((source, index) => (
                <div key={source.source} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    index === 0 ? 'bg-yellow-100 text-yellow-700' :
                    index === 1 ? 'bg-gray-100 text-gray-700' :
                    index === 2 ? 'bg-orange-100 text-orange-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">{source.source}</span>
                      <span className="text-sm font-semibold text-gray-800">{source.count} leads</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Pricing Accuracy Analysis */}
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <div className="flex items-center gap-2 mb-6">
          <Target size={24} className="text-blue-600" />
          <div>
            <h3 className="text-lg font-bold text-gray-800">Pricing Accuracy Analysis</h3>
            <p className="text-sm text-gray-600">Compare sold prices to list prices</p>
          </div>
        </div>

        {analytics.pricingAccuracy.length === 0 ? (
          <div className="text-center py-12">
            <Target size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 mb-2">No sold properties with accepted offers yet</p>
            <p className="text-sm text-gray-400">Once you have properties that sell, pricing accuracy metrics will appear here</p>
          </div>
        ) : (
          (() => {
            const totalProperties = analytics.pricingAccuracy.length;
            const overAsking = analytics.pricingAccuracy.filter(p => p.soldPrice > p.listPrice);
            const underAsking = analytics.pricingAccuracy.filter(p => p.soldPrice < p.listPrice);
            const atAsking = analytics.pricingAccuracy.filter(p => p.soldPrice === p.listPrice);

            const avgPercentDiff = analytics.pricingAccuracy.reduce((sum, p) => {
              return sum + ((p.soldPrice - p.listPrice) / p.listPrice * 100);
            }, 0) / totalProperties;

            const avgOverAskingPercent = overAsking.length > 0
              ? overAsking.reduce((sum, p) => sum + ((p.soldPrice - p.listPrice) / p.listPrice * 100), 0) / overAsking.length
              : 0;

            const avgUnderAskingPercent = underAsking.length > 0
              ? underAsking.reduce((sum, p) => sum + ((p.soldPrice - p.listPrice) / p.listPrice * 100), 0) / underAsking.length
              : 0;

            return (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <div className="text-sm text-blue-600 font-medium mb-1">Average Difference</div>
                    <div className={`text-2xl font-bold ${avgPercentDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {avgPercentDiff >= 0 ? '+' : ''}{avgPercentDiff.toFixed(2)}%
                    </div>
                    <div className="text-xs text-gray-600 mt-1">List vs Sold Price</div>
                  </div>

                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <div className="text-sm text-green-600 font-medium mb-1">Over Asking</div>
                    <div className="text-2xl font-bold text-green-600">
                      {overAsking.length}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {totalProperties > 0 ? `${((overAsking.length / totalProperties) * 100).toFixed(1)}%` : '0%'} of sales
                      {overAsking.length > 0 && ` (+${avgOverAskingPercent.toFixed(2)}% avg)`}
                    </div>
                  </div>

                  <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                    <div className="text-sm text-red-600 font-medium mb-1">Under Asking</div>
                    <div className="text-2xl font-bold text-red-600">
                      {underAsking.length}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {totalProperties > 0 ? `${((underAsking.length / totalProperties) * 100).toFixed(1)}%` : '0%'} of sales
                      {underAsking.length > 0 && ` (${avgUnderAskingPercent.toFixed(2)}% avg)`}
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="text-sm text-gray-600 font-medium mb-1">At Asking</div>
                    <div className="text-2xl font-bold text-gray-600">
                      {atAsking.length}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {totalProperties > 0 ? `${((atAsking.length / totalProperties) * 100).toFixed(1)}%` : '0%'} of sales
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm font-medium text-gray-600 px-2">
                    <span className="w-1/3">Property</span>
                    <span className="w-1/6 text-right">List Price</span>
                    <span className="w-1/6 text-right">Sold Price</span>
                    <span className="w-1/6 text-right">Difference</span>
                    <span className="w-1/6 text-right">% Change</span>
                  </div>
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {analytics.pricingAccuracy
                      .sort((a, b) => {
                        const diffA = (a.soldPrice - a.listPrice) / a.listPrice;
                        const diffB = (b.soldPrice - b.listPrice) / b.listPrice;
                        return diffB - diffA;
                      })
                      .map((property) => {
                        const difference = property.soldPrice - property.listPrice;
                        const percentChange = (difference / property.listPrice) * 100;
                        const isOverAsking = difference > 0;
                        const isUnderAsking = difference < 0;

                        return (
                          <div
                            key={property.propertyId}
                            className={`flex items-center justify-between p-3 rounded-lg border ${
                              isOverAsking ? 'bg-green-50 border-green-200' :
                              isUnderAsking ? 'bg-red-50 border-red-200' :
                              'bg-gray-50 border-gray-200'
                            }`}
                          >
                            <div className="w-1/3">
                              <div className="text-sm font-medium text-gray-800 truncate">{property.address}</div>
                              <div className="text-xs text-gray-500">
                                {new Date(property.soldDate).toLocaleDateString()}
                              </div>
                            </div>
                            <div className="w-1/6 text-right text-sm text-gray-700">
                              {formatCurrency(property.listPrice)}
                            </div>
                            <div className="w-1/6 text-right text-sm font-semibold text-gray-800">
                              {formatCurrency(property.soldPrice)}
                            </div>
                            <div className={`w-1/6 text-right text-sm font-semibold flex items-center justify-end gap-1 ${
                              isOverAsking ? 'text-green-600' :
                              isUnderAsking ? 'text-red-600' :
                              'text-gray-600'
                            }`}>
                              {isOverAsking && <TrendingUp size={14} />}
                              {isUnderAsking && <TrendingDown size={14} />}
                              {isOverAsking && '+'}
                              {formatCurrency(Math.abs(difference))}
                            </div>
                            <div className={`w-1/6 text-right text-sm font-bold ${
                              isOverAsking ? 'text-green-600' :
                              isUnderAsking ? 'text-red-600' :
                              'text-gray-600'
                            }`}>
                              {isOverAsking && '+'}
                              {percentChange.toFixed(2)}%
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </>
            );
          })()
        )}
      </div>

      {/* Pipeline Commission */}
      <div className="bg-gradient-to-r from-blue-50 to-green-50 dark:from-slate-800 dark:to-slate-700 rounded-lg p-6 border border-blue-200 dark:border-slate-600">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">Projected Pipeline Commission</h3>
            <p className="text-gray-600 dark:text-slate-300 text-sm">Potential earnings from active deals</p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold text-green-600 dark:text-green-400">{formatCurrency(analytics.totalPipelineCommission)}</p>
            <p className="text-sm text-gray-600 dark:text-slate-300 mt-1">from {analytics.totalActiveDeals} active deals</p>
          </div>
        </div>
      </div>
    </div>
  );
}
