import { useState, useEffect } from 'react';
import { Star, Phone, MapPin, Search, ArrowLeft } from 'lucide-react';
import { supabase, AgentProfile } from '../../lib/supabase';
import { useNavigate } from '../Navigation/Router';

type AgentWithProfile = AgentProfile & {
  profile: {
    full_name: string;
    phone_number: string | null;
  };
};

export function AgentList() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<AgentWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      const { data, error } = await supabase
        .from('agent_profiles')
        .select(`
          *,
          profile:profiles(full_name, phone_number)
        `)
        .order('star_rating', { ascending: false });

      if (error) throw error;
      setAgents(data || []);
    } catch (error) {
      console.error('Error loading agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAgents = agents.filter((agent) => {
    const query = searchQuery.toLowerCase();
    return (
      agent.profile.full_name.toLowerCase().includes(query) ||
      agent.locations.some(loc => loc.toLowerCase().includes(query)) ||
      agent.languages.some(lang => lang.toLowerCase().includes(query))
    );
  });

  return (
    <div>
      <div className="bg-white shadow-sm border-b mb-8">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => window.history.back()}
              className="text-gray-600 hover:text-blue-600 transition"
              title="Back"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-3xl font-bold text-gray-800">Real Estate Agents</h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search agents by name, location, or language..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading agents...</p>
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">No agents found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
            {filteredAgents.map((agent) => (
              <div
                key={agent.id}
                onClick={() => navigate(`/agents/${agent.id}`)}
                className="bg-white rounded-lg shadow-md p-6 cursor-pointer transition-transform hover:scale-[1.02] hover:shadow-lg"
              >
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-gray-800 mb-2">
                    {agent.profile.full_name}
                  </h3>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex items-center">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          size={16}
                          className={i < Math.floor(agent.star_rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                        />
                      ))}
                    </div>
                    <span className="text-gray-700 text-sm font-medium">{agent.star_rating.toFixed(1)}</span>
                  </div>
                  <p className="text-gray-600 text-sm">License #{agent.license_number}</p>
                </div>

                {agent.profile.phone_number && (
                  <div className="flex items-center gap-2 text-gray-700 text-sm mb-2">
                    <Phone size={16} />
                    <span>{agent.profile.phone_number}</span>
                  </div>
                )}

                {agent.languages.length > 0 && (
                  <div className="mb-3">
                    <p className="text-gray-600 text-sm">
                      <span className="font-medium">Languages:</span> {agent.languages.join(', ')}
                    </p>
                  </div>
                )}

                {agent.locations.length > 0 && (
                  <div className="mb-3">
                    <div className="flex items-start gap-2">
                      <MapPin size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
                      <div className="flex flex-wrap gap-1">
                        {agent.locations.slice(0, 3).map((location, index) => (
                          <span
                            key={index}
                            className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs"
                          >
                            {location}
                          </span>
                        ))}
                        {agent.locations.length > 3 && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                            +{agent.locations.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 text-xs text-gray-600 pt-3 border-t">
                  {agent.meet_in_person && <span className="px-2 py-1 bg-gray-100 rounded">In-person</span>}
                  {agent.video_chat && <span className="px-2 py-1 bg-gray-100 rounded">Video chat</span>}
                </div>

                {agent.bio && (
                  <p className="mt-3 text-gray-600 text-sm line-clamp-2">{agent.bio}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
