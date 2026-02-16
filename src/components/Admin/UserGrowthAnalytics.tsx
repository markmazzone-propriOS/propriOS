import { useState, useEffect } from 'react';
import { Users, Calendar, TrendingUp, ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from '../Navigation/Router';

type TimeFrame = 'month' | 'week';

type GrowthData = {
  period: string;
  agent: number;
  buyer: number;
  seller: number;
  renter: number;
  service_provider: number;
  property_owner: number;
  total: number;
};

export function UserGrowthAnalytics() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('month');
  const [growthData, setGrowthData] = useState<GrowthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminAccess();
  }, [user]);

  useEffect(() => {
    if (isAdmin) {
      loadGrowthData();
    }
  }, [isAdmin, timeFrame]);

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
    } catch (error) {
      console.error('Error checking admin access:', error);
      navigate('/dashboard');
    }
  };

  const loadGrowthData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('created_at, user_type');

      if (error) throw error;

      const grouped = groupDataByTimeFrame(data || []);
      setGrowthData(grouped);
    } catch (error) {
      console.error('Error loading growth data:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupDataByTimeFrame = (profiles: any[]): GrowthData[] => {
    const grouped: Record<string, GrowthData> = {};

    profiles.forEach((profile) => {
      const date = new Date(profile.created_at);
      let period: string;

      if (timeFrame === 'month') {
        period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else {
        const weekStart = getWeekStart(date);
        period = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
      }

      if (!grouped[period]) {
        grouped[period] = {
          period,
          agent: 0,
          buyer: 0,
          seller: 0,
          renter: 0,
          service_provider: 0,
          property_owner: 0,
          total: 0,
        };
      }

      const userType = profile.user_type as keyof Omit<GrowthData, 'period' | 'total'>;
      if (userType in grouped[period]) {
        grouped[period][userType]++;
      }
      grouped[period].total++;
    });

    return Object.values(grouped).sort((a, b) => b.period.localeCompare(a.period));
  };

  const getWeekStart = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  };

  const formatPeriod = (period: string): string => {
    if (timeFrame === 'month') {
      const [year, month] = period.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    } else {
      const date = new Date(period);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 6);
      return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
  };

  const getTotalNewUsers = (): number => {
    return growthData.reduce((sum, data) => sum + data.total, 0);
  };

  const getMaxValue = (): number => {
    return Math.max(...growthData.map(d => d.total), 1);
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
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-2 text-blue-100 hover:text-white mb-4 transition"
          >
            <ArrowLeft size={20} />
            Back to Dashboard
          </button>
          <h1 className="text-4xl font-bold mb-2">User Growth Analytics</h1>
          <p className="text-blue-100">Track new user registrations over time</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-1">Total New Users</h2>
              <p className="text-4xl font-bold text-blue-600">{getTotalNewUsers()}</p>
            </div>
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setTimeFrame('month')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  timeFrame === 'month' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Calendar size={16} className="inline mr-2" />
                Monthly
              </button>
              <button
                onClick={() => setTimeFrame('week')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  timeFrame === 'week' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Calendar size={16} className="inline mr-2" />
                Weekly
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                <p className="text-sm font-medium text-gray-600">Agents</p>
              </div>
              <p className="text-2xl font-bold text-gray-800">
                {growthData.reduce((sum, d) => sum + d.agent, 0)}
              </p>
            </div>

            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-green-600"></div>
                <p className="text-sm font-medium text-gray-600">Buyers</p>
              </div>
              <p className="text-2xl font-bold text-gray-800">
                {growthData.reduce((sum, d) => sum + d.buyer, 0)}
              </p>
            </div>

            <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-orange-600"></div>
                <p className="text-sm font-medium text-gray-600">Sellers</p>
              </div>
              <p className="text-2xl font-bold text-gray-800">
                {growthData.reduce((sum, d) => sum + d.seller, 0)}
              </p>
            </div>

            <div className="bg-cyan-50 rounded-lg p-4 border border-cyan-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-cyan-600"></div>
                <p className="text-sm font-medium text-gray-600">Renters</p>
              </div>
              <p className="text-2xl font-bold text-gray-800">
                {growthData.reduce((sum, d) => sum + d.renter, 0)}
              </p>
            </div>

            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-purple-600"></div>
                <p className="text-sm font-medium text-gray-600">Service Providers</p>
              </div>
              <p className="text-2xl font-bold text-gray-800">
                {growthData.reduce((sum, d) => sum + d.service_provider, 0)}
              </p>
            </div>

            <div className="bg-teal-50 rounded-lg p-4 border border-teal-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-teal-600"></div>
                <p className="text-sm font-medium text-gray-600">Property Owners</p>
              </div>
              <p className="text-2xl font-bold text-gray-800">
                {growthData.reduce((sum, d) => sum + d.property_owner, 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-6">
            New Users by {timeFrame === 'month' ? 'Month' : 'Week'}
          </h3>

          {growthData.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No user data available
            </div>
          ) : (
            <div className="space-y-4">
              {growthData.map((data) => {
                const maxValue = getMaxValue();
                return (
                  <div key={data.period} className="border-b border-gray-100 pb-4 last:border-0">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Calendar className="text-gray-400" size={20} />
                        <span className="font-semibold text-gray-700">{formatPeriod(data.period)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users size={18} className="text-gray-400" />
                        <span className="text-xl font-bold text-gray-800">{data.total}</span>
                        <span className="text-sm text-gray-500">new users</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-6 gap-2 mb-2">
                      {data.agent > 0 && (
                        <div
                          className="bg-blue-500 rounded h-8 flex items-center justify-center text-white text-xs font-semibold"
                          style={{ width: `${(data.agent / maxValue) * 100}%`, minWidth: '60px' }}
                        >
                          {data.agent} Agent{data.agent !== 1 ? 's' : ''}
                        </div>
                      )}
                      {data.buyer > 0 && (
                        <div
                          className="bg-green-500 rounded h-8 flex items-center justify-center text-white text-xs font-semibold"
                          style={{ width: `${(data.buyer / maxValue) * 100}%`, minWidth: '60px' }}
                        >
                          {data.buyer} Buyer{data.buyer !== 1 ? 's' : ''}
                        </div>
                      )}
                      {data.seller > 0 && (
                        <div
                          className="bg-orange-500 rounded h-8 flex items-center justify-center text-white text-xs font-semibold"
                          style={{ width: `${(data.seller / maxValue) * 100}%`, minWidth: '60px' }}
                        >
                          {data.seller} Seller{data.seller !== 1 ? 's' : ''}
                        </div>
                      )}
                      {data.renter > 0 && (
                        <div
                          className="bg-cyan-500 rounded h-8 flex items-center justify-center text-white text-xs font-semibold"
                          style={{ width: `${(data.renter / maxValue) * 100}%`, minWidth: '60px' }}
                        >
                          {data.renter} Renter{data.renter !== 1 ? 's' : ''}
                        </div>
                      )}
                      {data.service_provider > 0 && (
                        <div
                          className="bg-purple-500 rounded h-8 flex items-center justify-center text-white text-xs font-semibold"
                          style={{ width: `${(data.service_provider / maxValue) * 100}%`, minWidth: '60px' }}
                        >
                          {data.service_provider} Provider{data.service_provider !== 1 ? 's' : ''}
                        </div>
                      )}
                      {data.property_owner > 0 && (
                        <div
                          className="bg-teal-500 rounded h-8 flex items-center justify-center text-white text-xs font-semibold"
                          style={{ width: `${(data.property_owner / maxValue) * 100}%`, minWidth: '60px' }}
                        >
                          {data.property_owner} Owner{data.property_owner !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-500 mt-2 flex-wrap">
                      {data.agent > 0 && (
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                          <span>{data.agent} Agent{data.agent !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                      {data.buyer > 0 && (
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          <span>{data.buyer} Buyer{data.buyer !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                      {data.seller > 0 && (
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                          <span>{data.seller} Seller{data.seller !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                      {data.renter > 0 && (
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
                          <span>{data.renter} Renter{data.renter !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                      {data.service_provider > 0 && (
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                          <span>{data.service_provider} Provider{data.service_provider !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                      {data.property_owner > 0 && (
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-teal-500"></div>
                          <span>{data.property_owner} Owner{data.property_owner !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
