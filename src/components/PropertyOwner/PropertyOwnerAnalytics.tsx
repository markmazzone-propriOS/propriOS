import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Eye,
  Heart,
  Users,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Target,
  Award,
  DollarSign,
  Flame,
  Mail
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from '../Navigation/Router';

interface PropertyOwnerAnalyticsProps {
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

interface LeadData {
  total: number;
  new: number;
  contacted: number;
  qualified: number;
}

export function PropertyOwnerAnalytics({ propertyId, propertyAddress }: PropertyOwnerAnalyticsProps) {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [funnel, setFunnel] = useState<ConversionFunnel | null>(null);
  const [trend, setTrend] = useState<TrendData[]>([]);
  const [hotProspects, setHotProspects] = useState<HotProspect[]>([]);
  const [qualityScore, setQualityScore] = useState<QualityScore | null>(null);
  const [leads, setLeads] = useState<LeadData | null>(null);
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
        leadsData,
        propertyData
      ] = await Promise.all([
        supabase.rpc('get_property_analytics', { property_uuid: propertyId }),
        supabase.rpc('get_property_conversion_funnel', { property_uuid: propertyId }),
        supabase.rpc('get_engagement_trend', { property_uuid: propertyId, days: 30 }),
        supabase.rpc('get_hot_prospects', { property_uuid: propertyId }),
        supabase.rpc('calculate_listing_quality_score', { property_uuid: propertyId }),
        supabase
          .from('property_owner_leads')
          .select('status')
          .eq('property_id', propertyId),
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

      if (leadsData.data) {
        const leadStats = {
          total: leadsData.data.length,
          new: leadsData.data.filter(l => l.status === 'new').length,
          contacted: leadsData.data.filter(l => l.status === 'contacted').length,
          qualified: leadsData.data.filter(l => l.status === 'qualified').length
        };
        setLeads(leadStats);
      }

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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error || !analytics || !funnel) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Failed to load analytics'}</p>
          <button
            onClick={() => navigate(-1)}
            className="text-blue-600 hover:text-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const uniqueViewers = analytics.views.unique_viewers_authenticated + analytics.views.unique_viewers_anonymous;
  const maxTrendValue = Math.max(...trend.map(d => Math.max(d.views, d.favorites, d.viewings)));

  const calculateTrend = () => {
    if (trend.length < 2) return 'neutral';
    const recent = trend.slice(-7);
    const older = trend.slice(0, 7);
    const recentAvg = recent.reduce((sum, d) => sum + d.views, 0) / recent.length;
    const olderAvg = older.length > 0 ? older.reduce((sum, d) => sum + d.views, 0) / older.length : 0;
    return recentAvg > olderAvg ? 'up' : recentAvg < olderAvg ? 'down' : 'neutral';
  };

  const interestTrend = calculateTrend();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate('/property-owner/listings')}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-6 transition"
        >
          <ArrowLeft size={20} />
          Back to Listings
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Listing Analytics</h1>
          <p className="text-gray-600 text-lg">{propertyAddress}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Eye className="text-blue-600" size={24} />
              </div>
              {interestTrend === 'up' && <TrendingUp className="text-green-500" size={20} />}
              {interestTrend === 'down' && <TrendingDown className="text-red-500" size={20} />}
            </div>
            <p className="text-3xl font-bold text-gray-800">{analytics.views.total}</p>
            <p className="text-gray-600 text-sm mt-1">Total Views</p>
            <p className="text-xs text-gray-500 mt-2">{uniqueViewers} unique viewers</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center">
                <Heart className="text-pink-600" size={24} />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-800">{analytics.favorites.total}</p>
            <p className="text-gray-600 text-sm mt-1">Favorites</p>
            <p className="text-xs text-gray-500 mt-2">
              {analytics.views.total > 0
                ? ((analytics.favorites.total / analytics.views.total) * 100).toFixed(1)
                : '0'}% of viewers
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                <Mail className="text-emerald-600" size={24} />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-800">{leads?.total || 0}</p>
            <p className="text-gray-600 text-sm mt-1">Inquiries</p>
            <p className="text-xs text-gray-500 mt-2">
              {leads?.new || 0} new, {leads?.contacted || 0} contacted
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center">
                <DollarSign className="text-teal-600" size={24} />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-800">{daysOnMarket}</p>
            <p className="text-gray-600 text-sm mt-1">Days Listed</p>
            <p className="text-xs text-gray-500 mt-2">
              {qualityScore ? `${qualityScore.percentage}% listing quality` : 'Calculating...'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <div className="lg:col-span-2 bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">Engagement Trend (30 Days)</h2>
            </div>
            {trend.length > 0 ? (
              <div className="space-y-4">
                {trend.slice().reverse().slice(0, 10).map((day, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 font-medium">
                        {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      <div className="flex items-center gap-4">
                        <span className="text-blue-600">{day.views} views</span>
                        <span className="text-pink-600">{day.favorites} favorites</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-blue-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${maxTrendValue > 0 ? (day.views / maxTrendValue) * 100 : 0}%` }}
                        />
                      </div>
                      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-pink-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${maxTrendValue > 0 ? (day.favorites / maxTrendValue) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No engagement data yet</p>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-6">Listing Quality</h2>
            {qualityScore && (
              <div className="space-y-4">
                <div className="relative">
                  <div className="flex items-center justify-center">
                    <div className="relative w-32 h-32">
                      <svg className="transform -rotate-90 w-32 h-32">
                        <circle
                          cx="64"
                          cy="64"
                          r="56"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="transparent"
                          className="text-gray-200"
                        />
                        <circle
                          cx="64"
                          cy="64"
                          r="56"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="transparent"
                          strokeDasharray={`${2 * Math.PI * 56}`}
                          strokeDashoffset={`${2 * Math.PI * 56 * (1 - qualityScore.percentage / 100)}`}
                          className={`${
                            qualityScore.percentage >= 80
                              ? 'text-green-500'
                              : qualityScore.percentage >= 60
                              ? 'text-yellow-500'
                              : 'text-red-500'
                          } transition-all duration-1000`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-gray-800">{qualityScore.percentage}%</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Award size={16} className="text-blue-600" />
                    Recommendations:
                  </p>
                  {qualityScore.recommendations.length > 0 ? (
                    <ul className="space-y-2">
                      {qualityScore.recommendations.map((rec, index) => (
                        <li key={index} className="text-sm text-gray-600 flex items-start gap-2">
                          <AlertCircle size={14} className="text-orange-500 flex-shrink-0 mt-0.5" />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-green-600 flex items-center gap-2">
                      <Target size={14} />
                      Your listing looks great!
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-6">Renter Journey</h2>
            <div className="space-y-4">
              {funnel.stages.map((stage, index) => (
                <div key={index}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">{stage.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-800">{stage.count}</span>
                      <span className="text-xs text-gray-500">({stage.percentage.toFixed(1)}%)</span>
                    </div>
                  </div>
                  <div className="bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        index === 0 ? 'bg-blue-500' :
                        index === 1 ? 'bg-pink-500' :
                        index === 2 ? 'bg-emerald-500' :
                        'bg-teal-500'
                      }`}
                      style={{ width: `${stage.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-600 mb-2">Conversion Rates:</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-gray-600 mb-1">Views → Favorites</p>
                  <p className="text-lg font-bold text-blue-600">
                    {(funnel.conversion_rates.view_to_favorite * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3">
                  <p className="text-xs text-gray-600 mb-1">Favorites → Inquiries</p>
                  <p className="text-lg font-bold text-emerald-600">
                    {(funnel.conversion_rates.favorite_to_viewing * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-6">
              <Flame className="text-orange-500" size={24} />
              <h2 className="text-xl font-bold text-gray-800">Hot Prospects</h2>
            </div>
            {hotProspects.length > 0 ? (
              <div className="space-y-3">
                {hotProspects.slice(0, 5).map((prospect, index) => (
                  <div
                    key={index}
                    className="p-4 border border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-md transition"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800">
                          {prospect.full_name || 'Anonymous User'}
                        </p>
                        {prospect.email && (
                          <p className="text-sm text-gray-600">{prospect.email}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 bg-orange-100 px-2 py-1 rounded-full">
                        <Flame size={14} className="text-orange-500" />
                        <span className="text-xs font-bold text-orange-700">{prospect.score}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        {prospect.view_count} views
                      </span>
                      {prospect.favorited && (
                        <span className="bg-pink-100 text-pink-700 px-2 py-1 rounded">Favorited</span>
                      )}
                      {prospect.viewing_requested && (
                        <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded">Inquired</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="mx-auto text-gray-400 mb-2" size={48} />
                <p className="text-gray-500">No prospects yet</p>
                <p className="text-sm text-gray-400 mt-1">Keep your listing active to attract renters</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
