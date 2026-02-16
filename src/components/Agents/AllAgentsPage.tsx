import { useState, useEffect } from 'react';
import { Search, MapPin, Star, Mail, ArrowLeft, SlidersHorizontal, X, Video, Users } from 'lucide-react';
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
  years_experience: number | null;
  profile: {
    id: string;
    full_name: string;
    phone_number: string;
  };
  reviews: { id: string }[];
};

export function AllAgentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [filteredAgents, setFilteredAgents] = useState<AgentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const [filters, setFilters] = useState({
    minRating: '',
    minYearsExperience: '',
    languages: [] as string[],
    meetInPerson: false,
    videoChat: false,
  });

  useEffect(() => {
    loadAgents();
  }, []);

  useEffect(() => {
    filterAgents();
  }, [searchQuery, locationQuery, filters, agents]);

  const loadAgents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('agent_profiles')
        .select(`
          *,
          profile:profiles!agent_profiles_id_fkey(id, full_name, phone_number),
          reviews:agent_reviews(id)
        `)
        .order('star_rating', { ascending: false });

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

    if (filters.minRating) {
      filtered = filtered.filter((agent) => agent.star_rating >= parseFloat(filters.minRating));
    }

    if (filters.minYearsExperience) {
      filtered = filtered.filter(
        (agent) =>
          agent.years_experience !== null &&
          agent.years_experience >= parseInt(filters.minYearsExperience)
      );
    }

    if (filters.languages.length > 0) {
      filtered = filtered.filter((agent) =>
        filters.languages.some((lang) => agent.languages?.includes(lang))
      );
    }

    if (filters.meetInPerson) {
      filtered = filtered.filter((agent) => agent.meet_in_person);
    }

    if (filters.videoChat) {
      filtered = filtered.filter((agent) => agent.video_chat);
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

  const clearFilters = () => {
    setFilters({
      minRating: '',
      minYearsExperience: '',
      languages: [],
      meetInPerson: false,
      videoChat: false,
    });
  };

  const hasActiveFilters =
    filters.minRating !== '' ||
    filters.minYearsExperience !== '' ||
    filters.languages.length > 0 ||
    filters.meetInPerson ||
    filters.videoChat;

  const allLanguages = Array.from(
    new Set(agents.flatMap((agent) => agent.languages || []))
  ).sort();

  const toggleLanguage = (language: string) => {
    setFilters((prev) => ({
      ...prev,
      languages: prev.languages.includes(language)
        ? prev.languages.filter((l) => l !== language)
        : [...prev.languages, language],
    }));
  };

  return (
    <div>
      <div className="bg-white shadow-sm border-b mb-8">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(user ? '/dashboard' : '/')}
              className="text-gray-600 hover:text-blue-600 transition"
              title={user ? 'Back to Dashboard' : 'Back to Home'}
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-3xl font-bold text-gray-800">Find an Agent</h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4">
        {showSuccessMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-center">
            Your message has been sent successfully! The agent will contact you soon.
          </div>
        )}

        <div className="mb-6 flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or license number..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1 relative">
            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
              placeholder="Enter city, state, or area..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-3 rounded-md border transition ${
              showFilters || hasActiveFilters
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <SlidersHorizontal size={20} />
            Filters
            {hasActiveFilters && (
              <span className="bg-white text-blue-600 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                {[
                  filters.minRating !== '',
                  filters.minYearsExperience !== '',
                  filters.languages.length > 0,
                  filters.meetInPerson,
                  filters.videoChat,
                ].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="mb-6 bg-white rounded-lg border border-gray-300 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Advanced Filters</h3>
              <div className="flex items-center gap-3">
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Clear All
                  </button>
                )}
                <button onClick={() => setShowFilters(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Rating</label>
                <input
                  type="number"
                  min="0"
                  max="5"
                  step="0.5"
                  placeholder="e.g., 4.0"
                  value={filters.minRating}
                  onChange={(e) => setFilters({ ...filters, minRating: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Years Experience</label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g., 5"
                  value={filters.minYearsExperience}
                  onChange={(e) => setFilters({ ...filters, minYearsExperience: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Meeting Options</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.meetInPerson}
                      onChange={(e) => setFilters({ ...filters, meetInPerson: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">In-person meetings</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.videoChat}
                      onChange={(e) => setFilters({ ...filters, videoChat: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Video chat available</span>
                  </label>
                </div>
              </div>

              {allLanguages.length > 0 && (
                <div className="md:col-span-2 lg:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Languages Spoken</label>
                  <div className="flex flex-wrap gap-2">
                    {allLanguages.map((language) => (
                      <button
                        key={language}
                        onClick={() => toggleLanguage(language)}
                        className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                          filters.languages.includes(language)
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {language}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 text-sm text-gray-600">
              Showing <span className="font-semibold text-gray-800">{filteredAgents.length}</span> of{' '}
              <span className="font-semibold text-gray-800">{agents.length}</span> agents
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading agents...</p>
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="text-center py-12 text-gray-600">
            <p className="text-lg mb-4">No agents found matching your criteria.</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setLocationQuery('');
                clearFilters();
              }}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
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
                      <h3 className="text-xl font-bold text-gray-800 mb-1">{agent.profile.full_name}</h3>
                      <p className="text-sm text-gray-600 mb-2">License: {agent.license_number}</p>
                      <div className="flex items-center gap-1 mb-2">
                        <Star size={16} className="text-yellow-500 fill-current" />
                        <span className="text-sm font-medium text-gray-700">
                          {Number(agent.star_rating).toFixed(1)}
                        </span>
                        {agent.reviews && agent.reviews.length > 0 && (
                          <span className="text-xs text-gray-500 ml-1">({agent.reviews.length} reviews)</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    {agent.years_experience !== null && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Experience:</span> {agent.years_experience} years
                      </p>
                    )}

                    <div className="flex items-start gap-2">
                      <MapPin size={16} className="text-gray-400 flex-shrink-0 mt-1" />
                      <p className="text-sm text-gray-600">
                        {agent.locations?.slice(0, 2).join(', ')}
                        {agent.locations && agent.locations.length > 2 && (
                          <span className="text-gray-500"> +{agent.locations.length - 2} more</span>
                        )}
                      </p>
                    </div>

                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Languages:</span> {agent.languages?.join(', ')}
                    </p>

                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="font-medium">Available:</span>
                      <div className="flex items-center gap-3">
                        {agent.meet_in_person && (
                          <span className="flex items-center gap-1">
                            <Users size={14} />
                            In-person
                          </span>
                        )}
                        {agent.video_chat && (
                          <span className="flex items-center gap-1">
                            <Video size={14} />
                            Video
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {agent.bio && <p className="text-sm text-gray-600 line-clamp-3">{agent.bio}</p>}
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
    </div>
  );
}
