import { useState, useEffect } from 'react';
import { ArrowLeft, User, Eye, Heart, Calendar, TrendingUp, Award, DollarSign, Home, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from '../Navigation/Router';

type Agent = {
  id: string;
  full_name: string;
  profile_photo_url: string | null;
};

type AgentAnalytics = {
  total_properties: number;
  total_views: number;
  total_favorites: number;
  total_viewings: number;
  total_offers: number;
  avg_views_per_property: number;
  avg_favorites_per_property: number;
  avg_viewings_per_property: number;
  avg_offers_per_property: number;
  avg_conversion_rate: number;
  total_listing_value: number;
  avg_days_on_market: number;
};

export function BrokerageAgentAnalytics() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [analytics, setAnalytics] = useState<AgentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [brokerageId, setBrokerageId] = useState<string>('');

  useEffect(() => {
    loadBrokerageAndAgents();
  }, [user]);

  useEffect(() => {
    if (selectedAgentId) {
      loadAgentAnalytics(selectedAgentId);
    }
  }, [selectedAgentId]);

  const loadBrokerageAndAgents = async () => {
    if (!user) return;

    try {
      let brokerageData = null;

      const { data: superAdminBrokerage, error: superAdminError } = await supabase
        .from('brokerages')
        .select('id')
        .eq('super_admin_id', user.id)
        .maybeSingle();

      if (superAdminError) throw superAdminError;

      if (superAdminBrokerage) {
        brokerageData = superAdminBrokerage;
      } else {
        const { data: agentBrokerage, error: agentError } = await supabase
          .from('brokerage_agents')
          .select('brokerage_id')
          .eq('agent_id', user.id)
          .eq('status', 'active')
          .maybeSingle();

        if (agentError) throw agentError;

        if (agentBrokerage) {
          brokerageData = { id: agentBrokerage.brokerage_id };
        }
      }

      if (!brokerageData) {
        navigate('/brokerage/setup');
        return;
      }

      setBrokerageId(brokerageData.id);

      const { data: agentsData, error: agentsError } = await supabase
        .from('brokerage_agents')
        .select(`
          agent_id,
          profiles!brokerage_agents_agent_id_fkey(
            full_name
          )
        `)
        .eq('brokerage_id', brokerageData.id)
        .eq('status', 'active');

      if (agentsError) {
        console.error('Error loading agents:', agentsError);
        throw agentsError;
      }

      if (!agentsData || agentsData.length === 0) {
        setAgents([]);
        setLoading(false);
        return;
      }

      const agentIds = agentsData.map(a => a.agent_id);

      const { data: agentProfilesData, error: profilesError } = await supabase
        .from('agent_profiles')
        .select('id, profile_photo_url')
        .in('id', agentIds);

      if (profilesError) {
        console.error('Error loading agent profiles:', profilesError);
      }

      const profilePhotoMap = new Map(
        (agentProfilesData || []).map(ap => [ap.id, ap.profile_photo_url])
      );

      const formattedAgents = agentsData.map(item => ({
        id: item.agent_id,
        full_name: item.profiles?.full_name || 'Unknown Agent',
        profile_photo_url: profilePhotoMap.get(item.agent_id) || null,
      })).sort((a, b) => a.full_name.localeCompare(b.full_name));

      setAgents(formattedAgents);

      if (formattedAgents.length > 0) {
        setSelectedAgentId(formattedAgents[0].id);
      }
    } catch (error) {
      console.error('Error loading agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAgentAnalytics = async (agentId: string) => {
    setAnalyticsLoading(true);
    try {
      const { data: properties, error: propertiesError } = await supabase
        .from('properties')
        .select('id, price, created_at')
        .eq('agent_id', agentId);

      if (propertiesError) throw propertiesError;

      if (!properties || properties.length === 0) {
        setAnalytics({
          total_properties: 0,
          total_views: 0,
          total_favorites: 0,
          total_viewings: 0,
          total_offers: 0,
          avg_views_per_property: 0,
          avg_favorites_per_property: 0,
          avg_viewings_per_property: 0,
          avg_offers_per_property: 0,
          avg_conversion_rate: 0,
          total_listing_value: 0,
          avg_days_on_market: 0,
        });
        return;
      }

      const propertyIds = properties.map(p => p.id);

      const [viewsResult, anonymousViewsResult, favoritesResult, viewingsResult, offersResult] = await Promise.all([
        supabase
          .from('property_views')
          .select('property_id', { count: 'exact' })
          .in('property_id', propertyIds),
        supabase
          .from('anonymous_property_views')
          .select('property_id', { count: 'exact' })
          .in('property_id', propertyIds),
        supabase
          .from('favorites')
          .select('property_id', { count: 'exact' })
          .in('property_id', propertyIds),
        supabase
          .from('calendar_events')
          .select('property_id', { count: 'exact' })
          .in('property_id', propertyIds)
          .eq('event_type', 'viewing'),
        supabase
          .from('property_offers')
          .select('property_id', { count: 'exact' })
          .in('property_id', propertyIds),
      ]);

      const totalViews = (viewsResult.count || 0) + (anonymousViewsResult.count || 0);
      const totalFavorites = favoritesResult.count || 0;
      const totalViewings = viewingsResult.count || 0;
      const totalOffers = offersResult.count || 0;

      const totalProperties = properties.length;
      const totalListingValue = properties.reduce((sum, p) => sum + p.price, 0);

      const now = new Date();
      const totalDaysOnMarket = properties.reduce((sum, p) => {
        const createdAt = new Date(p.created_at);
        const daysOnMarket = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
        return sum + daysOnMarket;
      }, 0);

      const avgConversionRate = totalViews > 0 ? (totalOffers / totalViews) * 100 : 0;

      setAnalytics({
        total_properties: totalProperties,
        total_views: totalViews,
        total_favorites: totalFavorites,
        total_viewings: totalViewings,
        total_offers: totalOffers,
        avg_views_per_property: totalViews / totalProperties,
        avg_favorites_per_property: totalFavorites / totalProperties,
        avg_viewings_per_property: totalViewings / totalProperties,
        avg_offers_per_property: totalOffers / totalProperties,
        avg_conversion_rate: avgConversionRate,
        total_listing_value: totalListingValue,
        avg_days_on_market: totalDaysOnMarket / totalProperties,
      });
    } catch (error) {
      console.error('Error loading agent analytics:', error);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <button
            onClick={() => navigate('/brokerage/dashboard')}
            className="mb-6 inline-flex items-center text-blue-600 hover:text-blue-700"
          >
            <ArrowLeft size={20} className="mr-2" />
            Back to Dashboard
          </button>

          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <User className="mx-auto text-gray-400 mb-4" size={48} />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">No Agents Yet</h2>
            <p className="text-gray-600">Invite agents to your brokerage to see their analytics.</p>
          </div>
        </div>
      </div>
    );
  }

  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => navigate('/brokerage/dashboard')}
          className="mb-6 inline-flex items-center text-blue-600 hover:text-blue-700"
        >
          <ArrowLeft size={20} className="mr-2" />
          Back to Dashboard
        </button>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Agent Performance Analytics</h1>

          <div className="max-w-md">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Agent
            </label>
            <div className="relative">
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                className="w-full pl-4 pr-10 py-3 border border-gray-300 rounded-lg appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                {agents.map(agent => (
                  <option key={agent.id} value={agent.id}>
                    {agent.full_name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
            </div>
          </div>
        </div>

        {analyticsLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : analytics && selectedAgent ? (
          <>
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="flex items-center space-x-4 mb-6">
                {selectedAgent.profile_photo_url ? (
                  <img
                    src={selectedAgent.profile_photo_url}
                    alt={selectedAgent.full_name}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                    <User size={32} className="text-blue-600" />
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedAgent.full_name}</h2>
                  <p className="text-gray-600">Performance Overview</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-600 font-medium">Total Properties</p>
                      <p className="text-3xl font-bold text-blue-900 mt-1">{analytics.total_properties}</p>
                    </div>
                    <Home className="text-blue-600" size={32} />
                  </div>
                </div>

                <div className="bg-green-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-600 font-medium">Total Listing Value</p>
                      <p className="text-3xl font-bold text-green-900 mt-1">
                        ${analytics.total_listing_value.toLocaleString()}
                      </p>
                    </div>
                    <DollarSign className="text-green-600" size={32} />
                  </div>
                </div>

                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-purple-600 font-medium">Avg Days on Market</p>
                      <p className="text-3xl font-bold text-purple-900 mt-1">
                        {analytics.avg_days_on_market.toFixed(0)}
                      </p>
                    </div>
                    <Calendar className="text-purple-600" size={32} />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Total Views</h3>
                  <Eye className="text-blue-600" size={24} />
                </div>
                <p className="text-3xl font-bold text-gray-900 mb-2">{analytics.total_views.toLocaleString()}</p>
                <p className="text-sm text-gray-600">
                  Avg: {analytics.avg_views_per_property.toFixed(1)} per property
                </p>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Total Favorites</h3>
                  <Heart className="text-red-600" size={24} />
                </div>
                <p className="text-3xl font-bold text-gray-900 mb-2">{analytics.total_favorites.toLocaleString()}</p>
                <p className="text-sm text-gray-600">
                  Avg: {analytics.avg_favorites_per_property.toFixed(1)} per property
                </p>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Total Viewings</h3>
                  <Calendar className="text-green-600" size={24} />
                </div>
                <p className="text-3xl font-bold text-gray-900 mb-2">{analytics.total_viewings.toLocaleString()}</p>
                <p className="text-sm text-gray-600">
                  Avg: {analytics.avg_viewings_per_property.toFixed(1)} per property
                </p>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Total Offers</h3>
                  <Award className="text-yellow-600" size={24} />
                </div>
                <p className="text-3xl font-bold text-gray-900 mb-2">{analytics.total_offers.toLocaleString()}</p>
                <p className="text-sm text-gray-600">
                  Avg: {analytics.avg_offers_per_property.toFixed(1)} per property
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Conversion Rate</h3>
                <TrendingUp className="text-blue-600" size={24} />
              </div>
              <div className="flex items-center">
                <div className="flex-1">
                  <div className="w-full bg-gray-200 rounded-full h-8">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-green-500 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                      style={{ width: `${Math.min(analytics.avg_conversion_rate, 100)}%` }}
                    >
                      {analytics.avg_conversion_rate > 5 && `${analytics.avg_conversion_rate.toFixed(2)}%`}
                    </div>
                  </div>
                </div>
                <div className="ml-4 text-right">
                  <p className="text-3xl font-bold text-gray-900">{analytics.avg_conversion_rate.toFixed(2)}%</p>
                  <p className="text-sm text-gray-600">Views to Offers</p>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
