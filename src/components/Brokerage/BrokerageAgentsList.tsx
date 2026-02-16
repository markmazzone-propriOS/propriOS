import { useState, useEffect } from 'react';
import { User, Star, Home, Calendar, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from '../Navigation/Router';

type AgentWithProfile = {
  id: string;
  agent_id: string;
  joined_at: string;
  status: string;
  profile: {
    id: string;
    full_name: string;
    phone_number: string | null;
    profile_photo_url: string | null;
  };
  agent_profile: {
    id: string;
    license_number: string;
    star_rating: number;
    profile_photo_url: string | null;
  } | null;
  listing_count: number;
};

type BrokerageAgentsListProps = {
  brokerageId: string;
};

export function BrokerageAgentsList({ brokerageId }: BrokerageAgentsListProps) {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<AgentWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAgents();
  }, [brokerageId]);

  const loadAgents = async () => {
    try {
      const { data: brokerageAgents, error: agentsError } = await supabase
        .from('brokerage_agents')
        .select(`
          *,
          profile:profiles!brokerage_agents_agent_id_fkey(
            id,
            full_name,
            phone_number,
            profile_photo_url
          )
        `)
        .eq('brokerage_id', brokerageId)
        .eq('status', 'active')
        .order('joined_at', { ascending: false });

      if (agentsError) throw agentsError;

      const { data: agentProfiles } = await supabase
        .from('agent_profiles')
        .select('id, license_number, star_rating, profile_photo_url')
        .in('id', (brokerageAgents || []).map((a: any) => a.agent_id));

      const agentProfilesMap = new Map(
        (agentProfiles || []).map((ap: any) => [ap.id, ap])
      );

      const agentsWithProfiles = (brokerageAgents || []).map((agent: any) => ({
        ...agent,
        agent_profile: agentProfilesMap.get(agent.agent_id) || null,
      }));

      const agentsWithCounts = await Promise.all(
        agentsWithProfiles.map(async (agent: any) => {
          const { count } = await supabase
            .from('properties')
            .select('*', { count: 'exact', head: true })
            .eq('agent_id', agent.agent_id)
            .eq('status', 'active');

          return {
            ...agent,
            listing_count: count || 0,
          };
        })
      );

      setAgents(agentsWithCounts);
    } catch (error) {
      console.error('Error loading agents:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <User className="mx-auto text-gray-400 mb-4" size={48} />
        <h3 className="text-lg font-semibold text-gray-800 mb-2">No Agents Yet</h3>
        <p className="text-gray-600">Start by inviting agents to join your brokerage</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {agents.map((agent) => {
        const photoUrl = agent.agent_profile?.profile_photo_url || agent.profile.profile_photo_url;

        return (
          <div
            key={agent.id}
            className="bg-white rounded-lg shadow-md hover:shadow-lg transition p-6 cursor-pointer border border-gray-200"
            onClick={() => navigate(`/brokerage/agents/${agent.agent_id}`)}
          >
            <div className="flex items-start gap-4 mb-4">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={agent.profile.full_name}
                  className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-300">
                  <User className="text-gray-400" size={28} />
                </div>
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-gray-800 text-lg">{agent.profile.full_name}</h3>
                {agent.agent_profile && (
                  <div className="flex items-center gap-1 mt-1">
                    <Star className="text-yellow-400 fill-current" size={16} />
                    <span className="text-sm text-gray-600">{agent.agent_profile.star_rating.toFixed(1)}</span>
                  </div>
                )}
              </div>
            </div>

            {agent.agent_profile?.license_number && (
              <div className="text-sm text-gray-600 mb-3">
                License: {agent.agent_profile.license_number}
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-gray-200">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Home size={16} />
                <span>{agent.listing_count} Listings</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/brokerage/agents/${agent.agent_id}`);
                }}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
              >
                <TrendingUp size={16} />
                View Details
              </button>
            </div>

            <div className="text-xs text-gray-500 mt-3">
              Joined {new Date(agent.joined_at).toLocaleDateString()}
            </div>
          </div>
        );
      })}
    </div>
  );
}
