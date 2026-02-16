import { useState, useEffect } from 'react';
import { Building2, MapPin, Phone, Mail, Award, Users, Home, ArrowLeft, ExternalLink, Star } from 'lucide-react';
import { supabase, Brokerage, AgentProfile, Property } from '../../lib/supabase';
import { useNavigate } from '../Navigation/Router';
import { PropertyCard } from '../Properties/PropertyCard';

type BrokerageWithAgents = Brokerage & {
  agents: Array<{
    agent_id: string;
    status: string;
    joined_at: string;
    agent_profile: AgentProfile & {
      profile: {
        full_name: string;
        phone_number: string;
      };
    };
  }>;
};

type PropertyWithPhotos = Property & {
  photos?: { photo_url: string }[];
  agent?: {
    profile: {
      full_name: string;
    };
  };
};

interface BrokeragePublicProfileProps {
  brokerageId: string;
}

export function BrokeragePublicProfile({ brokerageId }: BrokeragePublicProfileProps) {
  const navigate = useNavigate();
  const [brokerage, setBrokerage] = useState<BrokerageWithAgents | null>(null);
  const [listings, setListings] = useState<PropertyWithPhotos[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'listings' | 'agents'>('listings');

  useEffect(() => {
    loadBrokerageProfile();
  }, [brokerageId]);

  const loadBrokerageProfile = async () => {
    try {
      const { data: brokerageData, error: brokerageError } = await supabase
        .from('brokerages')
        .select('*')
        .eq('id', brokerageId)
        .maybeSingle();

      if (brokerageError) throw brokerageError;

      if (!brokerageData) {
        navigate('/');
        return;
      }

      const { data: agentsData, error: agentsError } = await supabase
        .from('brokerage_agents')
        .select(`
          agent_id,
          status,
          joined_at
        `)
        .eq('brokerage_id', brokerageId)
        .eq('status', 'active');

      if (agentsError) throw agentsError;

      const agentIds = (agentsData || []).map((a: any) => a.agent_id);

      let agentsWithProfiles = [];

      if (agentIds.length > 0) {
        const { data: agentProfilesData, error: profilesError } = await supabase
          .from('agent_profiles')
          .select(`
            id,
            license_number,
            star_rating,
            profile_photo_url,
            profile:profiles!agent_profiles_id_fkey(
              full_name,
              phone_number
            )
          `)
          .in('id', agentIds);

        if (profilesError) throw profilesError;

        agentsWithProfiles = (agentsData || []).map((agentData: any) => {
          const agentProfile = (agentProfilesData || []).find((p: any) => p.id === agentData.agent_id);
          return {
            agent_id: agentData.agent_id,
            status: agentData.status,
            joined_at: agentData.joined_at,
            agent_profile: agentProfile
          };
        }).filter((a: any) => a.agent_profile);
      }

      setBrokerage({ ...brokerageData, agents: agentsWithProfiles });

      if (agentIds.length > 0) {
        const { data: listingsData, error: listingsError } = await supabase
          .from('properties')
          .select(`
            *,
            photos:property_photos(photo_url),
            agent:agent_profiles!properties_agent_id_fkey(
              profile:profiles!agent_profiles_id_fkey(full_name)
            )
          `)
          .in('agent_id', agentIds)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(12);

        if (listingsError) throw listingsError;
        setListings(listingsData || []);
      }
    } catch (error) {
      console.error('Error loading brokerage profile:', error);
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

  if (!brokerage) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Building2 className="mx-auto text-gray-400 mb-4" size={64} />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Brokerage Not Found</h2>
          <p className="text-gray-600 mb-4">The brokerage you're looking for doesn't exist.</p>
          <button
            onClick={() => navigate('/')}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-white/90 hover:text-white mb-6 transition"
          >
            <ArrowLeft size={20} />
            Back
          </button>

          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="flex-shrink-0">
              {brokerage.logo_url ? (
                <img
                  src={brokerage.logo_url}
                  alt={brokerage.company_name}
                  className="w-32 h-32 rounded-lg object-cover border-4 border-white shadow-lg bg-white"
                />
              ) : (
                <div className="w-32 h-32 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center border-4 border-white shadow-lg">
                  <Building2 size={64} className="text-white" />
                </div>
              )}
            </div>

            <div className="flex-1">
              <h1 className="text-4xl font-bold mb-2">{brokerage.company_name}</h1>

              {brokerage.license_number && (
                <div className="flex items-center gap-2 text-white/90 mb-4">
                  <Award size={18} />
                  <span>License #{brokerage.license_number}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                {(brokerage.address_line1 || brokerage.city) && (
                  <div className="flex items-start gap-3">
                    <MapPin size={20} className="flex-shrink-0 mt-1" />
                    <div>
                      {brokerage.address_line1 && <div>{brokerage.address_line1}</div>}
                      {brokerage.address_line2 && <div>{brokerage.address_line2}</div>}
                      {(brokerage.city || brokerage.state || brokerage.zip_code) && (
                        <div>
                          {brokerage.city}, {brokerage.state} {brokerage.zip_code}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {brokerage.phone_number && (
                  <div className="flex items-center gap-3">
                    <Phone size={20} className="flex-shrink-0" />
                    <a href={`tel:${brokerage.phone_number}`} className="hover:underline">
                      {brokerage.phone_number}
                    </a>
                  </div>
                )}

                {brokerage.email && (
                  <div className="flex items-center gap-3">
                    <Mail size={20} className="flex-shrink-0" />
                    <a href={`mailto:${brokerage.email}`} className="hover:underline">
                      {brokerage.email}
                    </a>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Users size={20} className="flex-shrink-0" />
                  <span>{brokerage.agents.length} Active {brokerage.agents.length === 1 ? 'Agent' : 'Agents'}</span>
                </div>

                <div className="flex items-center gap-3">
                  <Home size={20} className="flex-shrink-0" />
                  <span>{listings.length} Active {listings.length === 1 ? 'Listing' : 'Listings'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow-md mb-8">
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
                  <span>Listings ({listings.length})</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('agents')}
                className={`px-6 py-4 font-medium border-b-2 transition ${
                  activeTab === 'agents'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Users size={20} />
                  <span>Agents ({brokerage.agents.length})</span>
                </div>
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'listings' && (
              <div>
                {listings.length === 0 ? (
                  <div className="text-center py-12">
                    <Home className="mx-auto text-gray-400 mb-4" size={48} />
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">No Active Listings</h3>
                    <p className="text-gray-600">This brokerage doesn't have any active listings at the moment.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {listings.map((listing) => (
                      <PropertyCard key={listing.id} property={listing} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'agents' && (
              <div>
                {brokerage.agents.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="mx-auto text-gray-400 mb-4" size={48} />
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">No Agents</h3>
                    <p className="text-gray-600">This brokerage doesn't have any agents yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {brokerage.agents.map((agent) => (
                      <div
                        key={agent.agent_id}
                        className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition cursor-pointer"
                        onClick={() => navigate(`/agents/${agent.agent_id}`)}
                      >
                        <div className="flex items-start gap-4 mb-4">
                          {agent.agent_profile.profile_photo_url ? (
                            <img
                              src={agent.agent_profile.profile_photo_url}
                              alt={agent.agent_profile.profile.full_name}
                              className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                            />
                          ) : (
                            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center border-2 border-gray-300">
                              <Users className="text-gray-500" size={28} />
                            </div>
                          )}
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-800">
                              {agent.agent_profile.profile.full_name}
                            </h3>
                            <div className="flex items-center gap-1 text-yellow-500 mb-2">
                              <Star size={16} fill="currentColor" />
                              <span className="text-sm text-gray-600">{agent.agent_profile.star_rating.toFixed(1)}</span>
                            </div>
                          </div>
                        </div>

                        {agent.agent_profile.license_number && (
                          <div className="text-sm text-gray-600 mb-2">
                            License #{agent.agent_profile.license_number}
                          </div>
                        )}

                        {agent.agent_profile.profile.phone_number && (
                          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                            <Phone size={16} />
                            <span>{agent.agent_profile.profile.phone_number}</span>
                          </div>
                        )}

                        <div className="text-xs text-gray-500 mt-4">
                          Joined {new Date(agent.joined_at).toLocaleDateString()}
                        </div>

                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <div className="flex items-center gap-2 text-blue-600 text-sm font-medium">
                            <span>View Profile</span>
                            <ExternalLink size={14} />
                          </div>
                        </div>
                      </div>
                    ))}
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
