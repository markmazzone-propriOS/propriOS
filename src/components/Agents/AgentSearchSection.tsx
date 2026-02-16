import { useState, useEffect } from 'react';
import { Search, MapPin, Star, Mail } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from '../Navigation/Router';
import { ContactAgentModal } from './ContactAgentModal';

type AgentProfile = {
  id: string;
  license_number: string;
  bio: string;
  star_rating: number;
  languages: string[];
  locations: string[];
  meet_in_person: boolean;
  video_chat: boolean;
  profile_photo_url: string | null;
  profile: {
    id: string;
    full_name: string;
    phone_number: string;
  };
};

export function AgentSearchSection() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [filteredAgents, setFilteredAgents] = useState<AgentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  useEffect(() => {
    loadAgents();
  }, []);

  useEffect(() => {
    filterAgents();
  }, [searchQuery, locationQuery, agents]);

  const loadAgents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('agent_profiles')
        .select(`
          *,
          profile:profiles!agent_profiles_id_fkey(id, full_name, phone_number)
        `)
        .order('star_rating', { ascending: false })
        .limit(6);

      if (error) throw error;

      const agentData = data || [];
      setAgents(agentData);
      setFilteredAgents(agentData);
    } catch (error) {
      console.error('Error loading agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterAgents = () => {
    let filtered = agents;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (agent) =>
          agent.profile.full_name.toLowerCase().includes(query) ||
          agent.license_number.toLowerCase().includes(query)
      );
    }

    if (locationQuery.trim()) {
      const query = locationQuery.toLowerCase();
      filtered = filtered.filter((agent) =>
        agent.locations?.some((area) => area.toLowerCase().includes(query))
      );
    }

    setFilteredAgents(filtered);
  };

  const handleContactAgent = (agentId: string, agentName: string) => {
    if (user) {
      navigate(`/agents/${agentId}`);
    } else {
      setSelectedAgent({ id: agentId, name: agentName });
      setContactModalOpen(true);
    }
  };

  const handleContactSuccess = () => {
    setContactModalOpen(false);
    setSelectedAgent(null);
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 5000);
  };

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-800 mb-4">
            Find an Agent
          </h2>
          <p className="text-xl text-gray-600">
            Connect with experienced real estate professionals in your area
          </p>
        </div>

        {showSuccessMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-center">
            Your message has been sent successfully! The agent will contact you soon.
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                size={20}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or license number..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="relative">
              <MapPin
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                size={20}
              />
              <input
                type="text"
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                placeholder="Enter city, state, or area..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading agents...</p>
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="text-center py-12 text-gray-600">
            <p className="text-lg">No agents found matching your criteria.</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setLocationQuery('');
              }}
              className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {filteredAgents.map((agent) => (
                <div
                  key={agent.id}
                  className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition"
                >
                  <button
                    onClick={() => navigate(`/agent-profile/${agent.id}`)}
                    className="w-full p-6 text-left hover:bg-gray-50 transition"
                  >
                    <div className="flex items-start gap-4 mb-4">
                      {agent.profile_photo_url ? (
                        <img
                          src={agent.profile_photo_url}
                          alt={agent.profile.full_name}
                          className="w-20 h-20 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                          <span className="text-2xl font-bold text-gray-500">
                            {agent.profile.full_name.charAt(0)}
                          </span>
                        </div>
                      )}
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-800 mb-1">
                          {agent.profile.full_name}
                        </h3>
                        <p className="text-sm text-gray-600 mb-2">
                          License: {agent.license_number}
                        </p>
                        <div className="flex items-center gap-1 mb-2">
                          <Star size={16} className="text-yellow-500 fill-current" />
                          <span className="text-sm font-medium text-gray-700">
                            {Number(agent.star_rating).toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-start gap-2">
                        <MapPin size={16} className="text-gray-400 flex-shrink-0 mt-1" />
                        <p className="text-sm text-gray-600">
                          {agent.locations?.slice(0, 2).join(', ')}
                          {agent.locations && agent.locations.length > 2 && (
                            <span className="text-gray-500">
                              {' '}
                              +{agent.locations.length - 2} more
                            </span>
                          )}
                        </p>
                      </div>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Languages:</span>{' '}
                        {agent.languages?.join(', ')}
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Available:</span>{' '}
                        {agent.meet_in_person && 'In-person'}
                        {agent.meet_in_person && agent.video_chat && ', '}
                        {agent.video_chat && 'Video chat'}
                      </p>
                    </div>

                    {agent.bio && (
                      <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                        {agent.bio}
                      </p>
                    )}
                  </button>

                  <div className="px-6 pb-6">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleContactAgent(agent.profile.id, agent.profile.full_name);
                      }}
                      className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition font-medium"
                    >
                      <Mail size={18} />
                      {user ? 'Contact Agent' : 'Contact'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center">
              <button
                onClick={() => navigate('/agents')}
                className="bg-blue-600 text-white px-8 py-3 rounded-md hover:bg-blue-700 transition font-medium"
              >
                View All Agents
              </button>
            </div>
          </>
        )}

        {contactModalOpen && selectedAgent && (
          <ContactAgentModal
            agentId={selectedAgent.id}
            agentName={selectedAgent.name}
            onClose={() => {
              setContactModalOpen(false);
              setSelectedAgent(null);
            }}
            onSuccess={handleContactSuccess}
          />
        )}
      </div>
    </section>
  );
}
