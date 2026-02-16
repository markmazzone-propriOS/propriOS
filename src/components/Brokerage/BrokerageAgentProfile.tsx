import { useState, useEffect } from 'react';
import { ArrowLeft, User, Star, Home, Users, TrendingUp, Calendar, Phone, Mail } from 'lucide-react';
import { supabase, Property } from '../../lib/supabase';
import { useNavigate, useRouter } from '../Navigation/Router';
import { PropertyCard } from '../Properties/PropertyCard';

type AgentDetails = {
  id: string;
  full_name: string;
  phone_number: string | null;
  profile_photo_url: string | null;
  agent_profile: {
    license_number: string;
    star_rating: number;
    bio: string;
    languages: string[];
    locations: string[];
    profile_photo_url: string | null;
  } | null;
};

type TeamInfo = {
  id: string;
  name: string;
  role: string;
  member_count: number;
};

type PropertyWithPhotos = Property & {
  photos?: { photo_url: string }[];
};

export function BrokerageAgentProfile() {
  const navigate = useNavigate();
  const { currentRoute } = useRouter();
  const agentId = currentRoute.path.split('/').pop();

  const [agent, setAgent] = useState<AgentDetails | null>(null);
  const [properties, setProperties] = useState<PropertyWithPhotos[]>([]);
  const [teams, setTeams] = useState<TeamInfo[]>([]);
  const [analytics, setAnalytics] = useState({
    totalListings: 0,
    activeListings: 0,
    soldProperties: 0,
    totalViews: 0,
    averagePrice: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'listings' | 'teams' | 'analytics'>('listings');

  useEffect(() => {
    if (agentId) {
      loadAgentProfile();
    }
  }, [agentId]);

  const loadAgentProfile = async () => {
    if (!agentId) return;

    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select(`
          *,
          agent_profile:agent_profiles!agent_profiles_id_fkey(
            license_number,
            star_rating,
            bio,
            languages,
            locations,
            profile_photo_url
          )
        `)
        .eq('id', agentId)
        .single();

      if (profileError) throw profileError;

      setAgent(profileData);

      const { data: propertiesData } = await supabase
        .from('properties')
        .select(`
          *,
          photos:property_photos(photo_url)
        `)
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false });

      setProperties(propertiesData || []);

      const { data: teamsData } = await supabase
        .from('team_members')
        .select(`
          role,
          team:teams(id, name)
        `)
        .eq('agent_id', agentId);

      const teamsWithCounts = await Promise.all(
        (teamsData || []).map(async (tm: any) => {
          const { count } = await supabase
            .from('team_members')
            .select('*', { count: 'exact', head: true })
            .eq('team_id', tm.team.id);

          return {
            id: tm.team.id,
            name: tm.team.name,
            role: tm.role,
            member_count: count || 0,
          };
        })
      );

      setTeams(teamsWithCounts);

      const totalListings = propertiesData?.length || 0;
      const activeListings = propertiesData?.filter(p => p.status === 'active').length || 0;
      const soldProperties = propertiesData?.filter(p => p.status === 'sold' || p.status === 'rented').length || 0;

      const avgPrice = propertiesData && propertiesData.length > 0
        ? propertiesData.reduce((sum, p) => sum + p.price, 0) / propertiesData.length
        : 0;

      const { data: viewsData } = await supabase
        .from('property_views')
        .select('property_id')
        .in('property_id', (propertiesData || []).map(p => p.id));

      setAnalytics({
        totalListings,
        activeListings,
        soldProperties,
        totalViews: viewsData?.length || 0,
        averagePrice: avgPrice,
      });
    } catch (error) {
      console.error('Error loading agent profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Agent Not Found</h2>
          <button
            onClick={() => navigate('/brokerage/dashboard')}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const photoUrl = agent.agent_profile?.profile_photo_url || agent.profile_photo_url;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b mb-8">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <button
            onClick={() => navigate('/brokerage/dashboard')}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-4"
          >
            <ArrowLeft size={20} />
            Back to Dashboard
          </button>

          <div className="flex items-start gap-6">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={agent.full_name}
                className="w-24 h-24 rounded-full object-cover border-4 border-gray-200"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center border-4 border-gray-300">
                <User className="text-gray-400" size={40} />
              </div>
            )}

            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-800 mb-2">{agent.full_name}</h1>
              {agent.agent_profile && (
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-1">
                    <Star className="text-yellow-400 fill-current" size={20} />
                    <span className="font-semibold text-gray-700">{agent.agent_profile.star_rating.toFixed(1)}</span>
                  </div>
                  <span className="text-gray-600">License: {agent.agent_profile.license_number}</span>
                </div>
              )}
              <div className="flex gap-4 text-sm text-gray-600">
                {agent.phone_number && (
                  <div className="flex items-center gap-1">
                    <Phone size={16} />
                    <span>{agent.phone_number}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Mail size={16} />
                  <span>Contact via messages</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <Home className="text-blue-500" size={24} />
              <span className="text-3xl font-bold text-gray-800">{analytics.totalListings}</span>
            </div>
            <p className="text-gray-600">Total Listings</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="text-green-500" size={24} />
              <span className="text-3xl font-bold text-gray-800">{analytics.activeListings}</span>
            </div>
            <p className="text-gray-600">Active Listings</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <Star className="text-orange-500" size={24} />
              <span className="text-3xl font-bold text-gray-800">{analytics.soldProperties}</span>
            </div>
            <p className="text-gray-600">Sold/Rented</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <Calendar className="text-purple-500" size={24} />
              <span className="text-3xl font-bold text-gray-800">{analytics.totalViews}</span>
            </div>
            <p className="text-gray-600">Total Views</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow mb-8">
          <div className="border-b">
            <nav className="flex">
              <button
                onClick={() => setActiveTab('listings')}
                className={`px-6 py-4 font-medium border-b-2 transition ${
                  activeTab === 'listings'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Home size={20} />
                  <span>Listings ({properties.length})</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('teams')}
                className={`px-6 py-4 font-medium border-b-2 transition ${
                  activeTab === 'teams'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Users size={20} />
                  <span>Teams ({teams.length})</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`px-6 py-4 font-medium border-b-2 transition ${
                  activeTab === 'analytics'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <TrendingUp size={20} />
                  <span>Analytics</span>
                </div>
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'listings' && (
              <div>
                {properties.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <Home className="mx-auto text-gray-400 mb-4" size={48} />
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">No Listings Yet</h3>
                    <p className="text-gray-600">This agent hasn't created any listings</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {properties.map((property) => (
                      <PropertyCard key={property.id} property={property} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'teams' && (
              <div>
                {teams.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <Users className="mx-auto text-gray-400 mb-4" size={48} />
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">No Teams</h3>
                    <p className="text-gray-600">This agent is not part of any teams</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {teams.map((team) => (
                      <div key={team.id} className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                        <h3 className="font-semibold text-gray-800 text-lg mb-2">{team.name}</h3>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Role: {team.role}</span>
                          <span className="text-gray-600">{team.member_count} members</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'analytics' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Performance Metrics</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                      <div className="text-sm text-gray-600 mb-1">Average Listing Price</div>
                      <div className="text-3xl font-bold text-gray-800">
                        ${analytics.averagePrice.toLocaleString()}
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                      <div className="text-sm text-gray-600 mb-1">Success Rate</div>
                      <div className="text-3xl font-bold text-gray-800">
                        {analytics.totalListings > 0
                          ? ((analytics.soldProperties / analytics.totalListings) * 100).toFixed(1)
                          : 0}%
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                      <div className="text-sm text-gray-600 mb-1">Average Views per Listing</div>
                      <div className="text-3xl font-bold text-gray-800">
                        {analytics.totalListings > 0
                          ? Math.round(analytics.totalViews / analytics.totalListings)
                          : 0}
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                      <div className="text-sm text-gray-600 mb-1">Portfolio Size</div>
                      <div className="text-3xl font-bold text-gray-800">
                        {analytics.totalListings}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {analytics.activeListings} active, {analytics.soldProperties} closed
                      </div>
                    </div>
                  </div>
                </div>

                {agent.agent_profile && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Agent Information</h3>
                    <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                      {agent.agent_profile.bio && (
                        <div className="mb-4">
                          <div className="text-sm font-medium text-gray-700 mb-2">Bio</div>
                          <p className="text-gray-600">{agent.agent_profile.bio}</p>
                        </div>
                      )}

                      {agent.agent_profile.languages.length > 0 && (
                        <div className="mb-4">
                          <div className="text-sm font-medium text-gray-700 mb-2">Languages</div>
                          <div className="flex flex-wrap gap-2">
                            {agent.agent_profile.languages.map((lang, index) => (
                              <span
                                key={index}
                                className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                              >
                                {lang}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {agent.agent_profile.locations.length > 0 && (
                        <div>
                          <div className="text-sm font-medium text-gray-700 mb-2">Service Areas</div>
                          <div className="flex flex-wrap gap-2">
                            {agent.agent_profile.locations.map((location, index) => (
                              <span
                                key={index}
                                className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full"
                              >
                                {location}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
