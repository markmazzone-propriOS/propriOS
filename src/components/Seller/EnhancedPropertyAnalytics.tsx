import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Eye,
  Heart,
  Calendar,
  Users,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Target,
  Award,
  DollarSign,
  Flame
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from '../Navigation/Router';

interface EnhancedPropertyAnalyticsProps {
  propertyId: string;
  propertyAddress: string;
}

interface AnalyticsData {
  views: {
    total: number;
    authenticated: number;
    anonymous: number;
    unique_viewers_authenticated: number;
    unique_viewers_anonymous: number;
  };
  favorites: {
    total: number;
  };
  viewing_requests: {
    total: number;
    authenticated: number;
    anonymous: number;
    pending: number;
    confirmed: number;
    completed: number;
  };
}

interface ConversionFunnel {
  stages: Array<{
    stage: string;
    count: number;
    label: string;
    percentage: number;
  }>;
  conversion_rates: {
    view_to_favorite: number;
    favorite_to_viewing: number;
    viewing_to_offer: number;
    overall: number;
  };
}

interface TrendData {
  date: string;
  views: number;
  favorites: number;
  viewings: number;
  offers: number;
}

interface HotProspect {
  user_id: string | null;
  session_id: string | null;
  email: string | null;
  full_name: string | null;
  score: number;
  view_count: number;
  favorited: boolean;
  viewing_requested: boolean;
  offer_made: boolean;
  last_activity: string;
}

interface QualityScore {
  score: number;
  max_score: number;
  percentage: number;
  recommendations: string[];
}

interface PriceHistory {
  old_price: number | null;
  new_price: number;
  changed_at: string;
}

export function EnhancedPropertyAnalytics({ propertyId, propertyAddress }: EnhancedPropertyAnalyticsProps) {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [funnel, setFunnel] = useState<ConversionFunnel | null>(null);
  const [trend, setTrend] = useState<TrendData[]>([]);
  const [hotProspects, setHotProspects] = useState<HotProspect[]>([]);
  const [qualityScore, setQualityScore] = useState<QualityScore | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [daysOnMarket, setDaysOnMarket] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAllAnalytics();
  }, [propertyId]);

  const loadAllAnalytics = async () => {
    try {
      setLoading(true);
      setError('');

      const [
        basicAnalytics,
        funnelData,
        trendData,
        prospectsData,
        qualityData,
        priceData,
        propertyData
      ] = await Promise.all([
        supabase.rpc('get_property_analytics', { property_uuid: propertyId }),
        supabase.rpc('get_property_conversion_funnel', { property_uuid: propertyId }),
        supabase.rpc('get_engagement_trend', { property_uuid: propertyId, days: 30 }),
        supabase.rpc('get_hot_prospects', { property_uuid: propertyId }),
        supabase.rpc('calculate_listing_quality_score', { property_uuid: propertyId }),
        supabase
          .from('property_price_history')
          .select('old_price, new_price, changed_at')
          .eq('property_id', propertyId)
          .order('changed_at', { ascending: false })
          .limit(5),
        supabase
          .from('properties')
          .select('created_at')
          .eq('id', propertyId)
          .single()
      ]);

      if (basicAnalytics.error) throw basicAnalytics.error;
      if (funnelData.error) throw funnelData.error;
      if (trendData.error) throw trendData.error;
      if (prospectsData.error) throw prospectsData.error;
      if (qualityData.error) throw qualityData.error;

      setAnalytics(basicAnalytics.data as AnalyticsData);
      setFunnel(funnelData.data as ConversionFunnel);
      setTrend(trendData.data as TrendData[]);
      setHotProspects(prospectsData.data as HotProspect[]);
      setQualityScore(qualityData.data as QualityScore);
      setPriceHistory(priceData.data || []);

      if (propertyData.data) {
        const created = new Date(propertyData.data.created_at);
        const days = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
        setDaysOnMarket(days);
      }
    } catch (err) {
      console.error('Error loading analytics:', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading enhanced analytics...</p>
        </div>
      </div>
    );
  }

  if (error || !analytics || !funnel) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Failed to load analytics'}</p>
          <button
            onClick={() => navigate(-1)}
            className="text-emerald-600 hover:text-emerald-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const uniqueViewers = analytics.views.unique_viewers_authenticated + analytics.views.unique_viewers_anonymous;
  const maxTrendValue = Math.max(...trend.map(d => Math.max(d.views, d.favorites, d.viewings, d.offers)));

  const calculateTrend = () => {
    if (trend.length < 2) return 'neutral';
    const recent = trend.slice(-7);
    const earlier = trend.slice(-14, -7);
    const recentViews = recent.reduce((sum, d) => sum + d.views, 0);
    const earlierViews = earlier.reduce((sum, d) => sum + d.views, 0);
    if (recentViews > earlierViews * 1.1) return 'up';
    if (recentViews < earlierViews * 0.9) return 'down';
    return 'neutral';
  };

  const trendDirection = calculateTrend();

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-emerald-600 transition mb-6 group"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Back</span>
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Listing Analytics</h1>
          <p className="text-gray-600">{propertyAddress}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
            <div className="flex items-center gap-3 mb-2">
              <Eye className="text-blue-600" size={24} />
              <span className="text-sm font-medium text-gray-600">Total Views</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{analytics.views.total}</p>
            <p className="text-sm text-gray-500 mt-1">{uniqueViewers} unique viewers</p>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-red-500">
            <div className="flex items-center gap-3 mb-2">
              <Heart className="text-red-600" size={24} />
              <span className="text-sm font-medium text-gray-600">Favorites</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{analytics.favorites.total}</p>
            <p className="text-sm text-gray-500 mt-1">
              {uniqueViewers > 0 ? ((analytics.favorites.total / uniqueViewers) * 100).toFixed(1) : '0'}% of viewers
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-emerald-500">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="text-emerald-600" size={24} />
              <span className="text-sm font-medium text-gray-600">Viewings</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{analytics.viewing_requests.total}</p>
            <p className="text-sm text-gray-500 mt-1">{analytics.viewing_requests.pending} pending</p>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-amber-500">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="text-amber-600" size={24} />
              <span className="text-sm font-medium text-gray-600">Engagement</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{funnel.conversion_rates.overall}%</p>
            <p className="text-sm text-gray-500 mt-1">View to offer rate</p>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-slate-500">
            <div className="flex items-center gap-3 mb-2">
              <Users className="text-slate-600" size={24} />
              <span className="text-sm font-medium text-gray-600">Days on Market</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{daysOnMarket}</p>
            <p className="text-sm text-gray-500 mt-1">Since listing</p>
          </div>
        </div>

        {trendDirection !== 'neutral' && (
          <div className={`mb-8 rounded-xl p-4 ${trendDirection === 'up' ? 'bg-emerald-100 border border-emerald-300' : 'bg-amber-100 border border-amber-300'}`}>
            <div className="flex items-center gap-3">
              {trendDirection === 'up' ? (
                <>
                  <TrendingUp className="text-emerald-700" size={24} />
                  <div>
                    <p className="font-bold text-emerald-900">Trending Up!</p>
                    <p className="text-sm text-emerald-700">Your listing engagement has increased over the past week</p>
                  </div>
                </>
              ) : (
                <>
                  <TrendingDown className="text-amber-700" size={24} />
                  <div>
                    <p className="font-bold text-amber-900">Engagement Declining</p>
                    <p className="text-sm text-amber-700">Consider updating photos or adjusting price to boost interest</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <div className="lg:col-span-2 bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp size={20} className="text-emerald-600" />
              30-Day Engagement Trend
            </h3>
            <div className="relative h-64">
              {trend.length > 0 ? (
                <div className="flex items-end justify-between h-full gap-1">
                  {trend.map((data, index) => {
                    const date = new Date(data.date);
                    const day = date.getDate();
                    const total = data.views + data.favorites + data.viewings + data.offers;
                    const height = maxTrendValue > 0 ? (total / maxTrendValue) * 100 : 0;

                    return (
                      <div key={index} className="flex-1 flex flex-col items-center group relative">
                        <div
                          className="w-full bg-gradient-to-t from-emerald-500 to-emerald-400 rounded-t hover:from-emerald-600 hover:to-emerald-500 transition-all cursor-pointer"
                          style={{ height: `${Math.max(height, 2)}%` }}
                        >
                          <div className="hidden group-hover:block absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs rounded py-2 px-3 whitespace-nowrap z-10">
                            <div className="font-bold mb-1">{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                            <div>Views: {data.views}</div>
                            <div>Favorites: {data.favorites}</div>
                            <div>Viewings: {data.viewings}</div>
                            <div>Offers: {data.offers}</div>
                          </div>
                        </div>
                        {index % 5 === 0 && (
                          <span className="text-xs text-gray-500 mt-2">{day}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <p>No trend data available yet</p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-center gap-6 mt-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-emerald-500 rounded"></div>
                <span className="text-gray-600">Total Engagement</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Target size={20} className="text-blue-600" />
              Conversion Funnel
            </h3>
            <div className="space-y-4">
              {funnel.stages.map((stage, index) => (
                <div key={index}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-700">{stage.label}</span>
                    <span className="text-sm font-bold text-gray-900">{stage.count}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all"
                      style={{ width: `${stage.percentage}%` }}
                    ></div>
                  </div>
                  {index < funnel.stages.length - 1 && (
                    <div className="flex items-center justify-center py-1">
                      <div className="text-xs text-gray-500">↓</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-6 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600 mb-2">Key Conversion Rates:</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">View → Favorite:</span>
                  <span className="font-semibold">{funnel.conversion_rates.view_to_favorite}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Favorite → Viewing:</span>
                  <span className="font-semibold">{funnel.conversion_rates.favorite_to_viewing}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Viewing → Offer:</span>
                  <span className="font-semibold">{funnel.conversion_rates.viewing_to_offer}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Flame size={20} className="text-orange-600" />
              Hot Prospects ({hotProspects.length})
            </h3>
            {hotProspects.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {hotProspects.map((prospect, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">
                          {prospect.full_name || prospect.email || `Anonymous (${prospect.session_id?.slice(0, 8)}...)`}
                        </p>
                        {prospect.email && <p className="text-sm text-gray-600">{prospect.email}</p>}
                      </div>
                      <div className="flex items-center gap-1 bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-bold">
                        <Flame size={14} />
                        {prospect.score}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>{prospect.view_count} views</span>
                      {prospect.favorited && <span className="flex items-center gap-1"><Heart size={14} className="text-red-500" />Favorited</span>}
                      {prospect.viewing_requested && <span className="flex items-center gap-1"><Calendar size={14} className="text-emerald-500" />Viewing</span>}
                      {prospect.offer_made && <span className="flex items-center gap-1"><DollarSign size={14} className="text-amber-500" />Offered</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Last active: {new Date(prospect.last_activity).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Flame size={48} className="mx-auto mb-2 opacity-30" />
                <p>No hot prospects yet</p>
                <p className="text-sm mt-1">Prospects with multiple views or favorites will appear here</p>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {qualityScore && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Award size={20} className="text-emerald-600" />
                  Listing Quality Score
                </h3>
                <div className="flex items-center justify-center mb-4">
                  <div className="relative w-32 h-32">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="#e5e7eb"
                        strokeWidth="12"
                        fill="none"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="#10b981"
                        strokeWidth="12"
                        fill="none"
                        strokeDasharray={`${(qualityScore.percentage / 100) * 351.86} 351.86`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-3xl font-bold text-gray-900">{qualityScore.percentage}%</span>
                    </div>
                  </div>
                </div>
                <p className="text-center text-sm text-gray-600 mb-4">
                  {qualityScore.score} out of {qualityScore.max_score} points
                </p>
                {qualityScore.recommendations.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-gray-700">Recommendations:</p>
                    {qualityScore.recommendations.map((rec, index) => (
                      <div key={index} className="flex items-start gap-2 text-sm text-gray-600">
                        <AlertCircle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
                        <span>{rec}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {priceHistory.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <DollarSign size={20} className="text-emerald-600" />
                  Price History
                </h3>
                <div className="space-y-3">
                  {priceHistory.map((change, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">
                          ${change.new_price.toLocaleString()}
                        </p>
                        {change.old_price && (
                          <p className={`text-xs ${change.new_price < change.old_price ? 'text-emerald-600' : 'text-red-600'}`}>
                            {change.new_price < change.old_price ? '↓' : '↑'} ${Math.abs(change.new_price - change.old_price).toLocaleString()}
                            {' '}from ${change.old_price.toLocaleString()}
                          </p>
                        )}
                      </div>
                      <span className="text-gray-500 text-xs">
                        {new Date(change.changed_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
