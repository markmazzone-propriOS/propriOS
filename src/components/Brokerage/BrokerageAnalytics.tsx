import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { TrendingUp, Home, Eye, Heart, DollarSign, Clock, Activity, FileText, Users, Calendar } from 'lucide-react';

interface BrokerageAnalyticsProps {
  brokerageId: string;
}

interface AnalyticsData {
  totalListings: number;
  activeListings: number;
  pendingListings: number;
  soldListings: number;
  rentedListings: number;
  totalViews: number;
  totalFavorites: number;
  totalOffers: number;
  avgPrice: number;
  avgSalePrice: number;
  avgRentPrice: number;
  avgDaysOnMarket: number;
  totalPropertyValue: number;
  recentActivity: number;
  totalViewings: number;
}

export function BrokerageAnalytics({ brokerageId }: BrokerageAnalyticsProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [agentCount, setAgentCount] = useState(0);

  useEffect(() => {
    loadAnalytics();
  }, [brokerageId]);

  const loadAnalytics = async () => {
    try {
      // Get all active agents in brokerage
      const { data: agentIds } = await supabase
        .from('brokerage_agents')
        .select('agent_id')
        .eq('brokerage_id', brokerageId)
        .eq('status', 'active');

      if (!agentIds || agentIds.length === 0) {
        setAnalytics({
          totalListings: 0,
          activeListings: 0,
          pendingListings: 0,
          soldListings: 0,
          rentedListings: 0,
          totalViews: 0,
          totalFavorites: 0,
          totalOffers: 0,
          avgPrice: 0,
          avgSalePrice: 0,
          avgRentPrice: 0,
          avgDaysOnMarket: 0,
          totalPropertyValue: 0,
          recentActivity: 0,
          totalViewings: 0,
        });
        setLoading(false);
        return;
      }

      setAgentCount(agentIds.length);
      const agentIdList = agentIds.map(a => a.agent_id);

      // Get all properties for brokerage agents
      const { data: properties } = await supabase
        .from('properties')
        .select('id, price, status, listing_type, created_at')
        .in('agent_id', agentIdList);

      if (!properties) {
        setLoading(false);
        return;
      }

      const propertyIds = properties.map(p => p.id);

      // Get total views
      const { count: viewsCount } = await supabase
        .from('property_views')
        .select('*', { count: 'exact', head: true })
        .in('property_id', propertyIds);

      // Get total favorites
      const { count: favoritesCount } = await supabase
        .from('favorites')
        .select('*', { count: 'exact', head: true })
        .in('property_id', propertyIds);

      // Get total offers
      const { count: offersCount } = await supabase
        .from('property_offers')
        .select('*', { count: 'exact', head: true })
        .in('property_id', propertyIds);

      // Get calendar events (viewings)
      const { count: viewingsCount } = await supabase
        .from('calendar_events')
        .select('*', { count: 'exact', head: true })
        .in('property_id', propertyIds)
        .eq('event_type', 'viewing');

      // Get recent activity (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count: recentActivityCount } = await supabase
        .from('activity_feed')
        .select('*', { count: 'exact', head: true })
        .in('user_id', agentIdList)
        .gte('created_at', thirtyDaysAgo.toISOString());

      // Calculate stats
      const activeListings = properties.filter(p => p.status === 'active').length;
      const pendingListings = properties.filter(p => p.status === 'pending').length;
      const soldListings = properties.filter(p => p.status === 'sold').length;
      const rentedListings = properties.filter(p => p.status === 'rented').length;

      const saleProperties = properties.filter(p => p.listing_type === 'sale');
      const rentProperties = properties.filter(p => p.listing_type === 'rent');

      const avgSalePrice = saleProperties.length > 0
        ? saleProperties.reduce((sum, p) => sum + Number(p.price), 0) / saleProperties.length
        : 0;

      const avgRentPrice = rentProperties.length > 0
        ? rentProperties.reduce((sum, p) => sum + Number(p.price), 0) / rentProperties.length
        : 0;

      const avgPrice = properties.length > 0
        ? properties.reduce((sum, p) => sum + Number(p.price), 0) / properties.length
        : 0;

      const totalPropertyValue = properties.reduce((sum, p) => sum + Number(p.price), 0);

      // Calculate average days on market
      const now = new Date();
      const daysOnMarket = properties.map(p => {
        const created = new Date(p.created_at);
        const diff = now.getTime() - created.getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24));
      });

      const avgDaysOnMarket = daysOnMarket.length > 0
        ? daysOnMarket.reduce((sum, days) => sum + days, 0) / daysOnMarket.length
        : 0;

      setAnalytics({
        totalListings: properties.length,
        activeListings,
        pendingListings,
        soldListings,
        rentedListings,
        totalViews: viewsCount || 0,
        totalFavorites: favoritesCount || 0,
        totalOffers: offersCount || 0,
        avgPrice,
        avgSalePrice,
        avgRentPrice,
        avgDaysOnMarket: Math.round(avgDaysOnMarket),
        totalPropertyValue,
        recentActivity: recentActivityCount || 0,
        totalViewings: viewingsCount || 0,
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12 text-gray-600">
        Failed to load analytics
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const statCards = [
    {
      title: 'Total Listings',
      value: analytics.totalListings,
      icon: Home,
      color: 'blue',
      description: 'All properties across brokerage',
    },
    {
      title: 'Active Listings',
      value: analytics.activeListings,
      icon: TrendingUp,
      color: 'green',
      description: 'Currently on market',
    },
    {
      title: 'Total Views',
      value: analytics.totalViews.toLocaleString(),
      icon: Eye,
      color: 'purple',
      description: 'Property page views',
    },
    {
      title: 'Total Favorites',
      value: analytics.totalFavorites.toLocaleString(),
      icon: Heart,
      color: 'red',
      description: 'Properties saved by buyers',
    },
    {
      title: 'Total Offers',
      value: analytics.totalOffers.toLocaleString(),
      icon: FileText,
      color: 'orange',
      description: 'Offers received',
    },
    {
      title: 'Scheduled Viewings',
      value: analytics.totalViewings.toLocaleString(),
      icon: Calendar,
      color: 'indigo',
      description: 'Total property viewings',
    },
  ];

  const avgStats = [
    {
      title: 'Avg Days on Market',
      value: `${analytics.avgDaysOnMarket} days`,
      icon: Clock,
      color: 'blue',
    },
    {
      title: 'Avg Property Price',
      value: formatCurrency(analytics.avgPrice),
      icon: DollarSign,
      color: 'green',
    },
    {
      title: 'Avg Sale Price',
      value: formatCurrency(analytics.avgSalePrice),
      icon: DollarSign,
      color: 'purple',
    },
    {
      title: 'Avg Rent Price',
      value: formatCurrency(analytics.avgRentPrice),
      icon: DollarSign,
      color: 'orange',
    },
    {
      title: 'Avg Listings per Agent',
      value: agentCount > 0 ? (analytics.totalListings / agentCount).toFixed(1) : '0',
      icon: Users,
      color: 'indigo',
    },
    {
      title: 'Recent Activity (30d)',
      value: analytics.recentActivity.toLocaleString(),
      icon: Activity,
      color: 'red',
    },
  ];

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
      blue: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' },
      green: { bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-200' },
      purple: { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200' },
      red: { bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-200' },
      orange: { bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200' },
      indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600', border: 'border-indigo-200' },
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="space-y-8">
      {/* Overview Section */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Brokerage Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {statCards.map((stat) => {
            const colors = getColorClasses(stat.color);
            const Icon = stat.icon;
            return (
              <div
                key={stat.title}
                className={`bg-white rounded-lg shadow-md p-6 border-2 ${colors.border} hover:shadow-lg transition`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-lg ${colors.bg}`}>
                    <Icon className={colors.text} size={24} />
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-gray-800">{stat.value}</div>
                  </div>
                </div>
                <h3 className="font-semibold text-gray-800 mb-1">{stat.title}</h3>
                <p className="text-sm text-gray-600">{stat.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Average Stats Section */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Performance Averages</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {avgStats.map((stat) => {
            const colors = getColorClasses(stat.color);
            const Icon = stat.icon;
            return (
              <div
                key={stat.title}
                className="bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition"
              >
                <div className="flex items-center gap-4 mb-3">
                  <div className={`p-2 rounded-lg ${colors.bg}`}>
                    <Icon className={colors.text} size={20} />
                  </div>
                  <h3 className="font-semibold text-gray-700">{stat.title}</h3>
                </div>
                <div className="text-2xl font-bold text-gray-800">{stat.value}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Status Breakdown */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Listing Status Breakdown</h2>
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-green-600 mb-2">
                {analytics.activeListings}
              </div>
              <div className="text-sm text-gray-600 font-medium">Active</div>
              <div className="text-xs text-gray-500 mt-1">
                {analytics.totalListings > 0
                  ? `${((analytics.activeListings / analytics.totalListings) * 100).toFixed(1)}%`
                  : '0%'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-yellow-600 mb-2">
                {analytics.pendingListings}
              </div>
              <div className="text-sm text-gray-600 font-medium">Pending</div>
              <div className="text-xs text-gray-500 mt-1">
                {analytics.totalListings > 0
                  ? `${((analytics.pendingListings / analytics.totalListings) * 100).toFixed(1)}%`
                  : '0%'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 mb-2">
                {analytics.soldListings}
              </div>
              <div className="text-sm text-gray-600 font-medium">Sold</div>
              <div className="text-xs text-gray-500 mt-1">
                {analytics.totalListings > 0
                  ? `${((analytics.soldListings / analytics.totalListings) * 100).toFixed(1)}%`
                  : '0%'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-600 mb-2">
                {analytics.rentedListings}
              </div>
              <div className="text-sm text-gray-600 font-medium">Rented</div>
              <div className="text-xs text-gray-500 mt-1">
                {analytics.totalListings > 0
                  ? `${((analytics.rentedListings / analytics.totalListings) * 100).toFixed(1)}%`
                  : '0%'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Portfolio Value */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Portfolio Value</h2>
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg shadow-md p-8 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-blue-100 mb-2">Total Portfolio Value</div>
              <div className="text-5xl font-bold">{formatCurrency(analytics.totalPropertyValue)}</div>
              <div className="text-sm text-blue-100 mt-4">
                Based on {analytics.totalListings} active and completed listings
              </div>
            </div>
            <div className="bg-white bg-opacity-20 p-6 rounded-lg">
              <DollarSign size={64} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
