import { useState, useEffect } from 'react';
import { Users, Building2, TrendingUp, MessageSquare, User, DollarSign, ArrowLeft, Pencil, FileText, Send, Mail, CheckCircle, Clock, XCircle, X, Trash2, Copy, ExternalLink, Star, Plus, Globe, CreditCard } from 'lucide-react';
import { supabase, Property, Profile, AgentProfile } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PropertyCard } from '../Properties/PropertyCard';
import { useNavigate, useRouter } from '../Navigation/Router';
import { DocumentUpload } from './DocumentUpload';
import { DocumentList } from './DocumentList';
import { DocumentChecklistManager } from './DocumentChecklistManager';
import { SendInvitation } from './SendInvitation';
import { AgentCalendar } from './AgentCalendar';
import { TeamManagement } from './TeamManagement';
import { TeamInvitations } from './TeamInvitations';
import { UpdateSellerProgress } from './UpdateSellerProgress';
import { UpdateBuyerProgress } from './UpdateBuyerProgress';
import { TransactionPipeline } from './TransactionPipeline';
import { AgentAnalytics } from './AgentAnalytics';
import { UpcomingReminders } from './UpcomingReminders';
import AgentTutorial from './AgentTutorial';
import { ServiceRequestsTracking } from './ServiceRequestsTracking';
import { ManagedAccountsManagement } from './ManagedAccountsManagement';
import { ImportExternalReview } from './ImportExternalReview';
import { BrokerageInvitations } from './BrokerageInvitations';
import SignaturesManagement from './SignaturesManagement';
import { AgentChatbot } from './AgentChatbot';

type PropertyWithPhotos = Property & {
  photos?: { photo_url: string }[];
};

export function AgentDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { currentRoute } = useRouter();
  const [agentProfile, setAgentProfile] = useState<AgentProfile | null>(null);
  const [buyers, setBuyers] = useState<Profile[]>([]);
  const [sellers, setSellers] = useState<Profile[]>([]);
  const [activeListings, setActiveListings] = useState<PropertyWithPhotos[]>([]);
  const [soldListings, setSoldListings] = useState<PropertyWithPhotos[]>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'sold'>('active');
  const [documentTab, setDocumentTab] = useState<'documents' | 'checklists'>('documents');
  const [documentRefresh, setDocumentRefresh] = useState(0);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [showClientsExpanded, setShowClientsExpanded] = useState(false);
  const [activeSection, setActiveSection] = useState<'dashboard' | 'pipeline' | 'analytics' | 'teams' | 'calendar' | 'reviews' | 'services' | 'managed-accounts' | 'signatures'>('dashboard');
  const [showSellerProgressModal, setShowSellerProgressModal] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState<{ id: string; name: string } | null>(null);
  const [showBuyerProgressModal, setShowBuyerProgressModal] = useState(false);
  const [selectedBuyer, setSelectedBuyer] = useState<{ id: string; name: string } | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showImportReview, setShowImportReview] = useState(false);

  useEffect(() => {
    const sectionParam = currentRoute.params?.section;
    if (sectionParam && ['dashboard', 'pipeline', 'analytics', 'teams', 'calendar', 'reviews', 'services', 'managed-accounts', 'signatures'].includes(sectionParam)) {
      setActiveSection(sectionParam as any);
    }
  }, [currentRoute.params?.section]);

  useEffect(() => {
    if (user && profile) {
      loadDashboardData();

      const messagesChannel = supabase
        .channel('dashboard-messages')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
          },
          () => {
            loadUnreadMessages();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'conversation_participants',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            loadUnreadMessages();
          }
        )
        .subscribe();

      const handleVisibilityChange = () => {
        if (!document.hidden) {
          loadListings();
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        supabase.removeChannel(messagesChannel);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [user, profile, currentRoute.path]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadAgentProfile(),
        loadAssignedClients(),
        loadListings(),
        loadUnreadMessages(),
        loadInvitations(),
        loadReviews(),
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAgentProfile = async () => {
    const { data, error } = await supabase
      .from('agent_profiles')
      .select('*')
      .eq('id', user!.id)
      .maybeSingle();

    if (error) {
      console.error('Error loading agent profile:', error);
      return;
    }
    setAgentProfile(data);

    // Show tutorial if agent hasn't completed it yet
    if (data && !data.tutorial_completed) {
      setShowTutorial(true);
    }
  };

  const loadReviews = async () => {
    console.log('Loading reviews for agent_id:', user!.id);
    const { data, error } = await supabase
      .from('agent_reviews')
      .select('id, rating, comment, created_at, is_imported, external_source, external_url, external_reviewer_name')
      .eq('agent_id', user!.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading reviews:', error);
      return;
    }
    console.log('Loaded reviews:', data);
    setReviews(data || []);
  };

  const loadAssignedClients = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('assigned_agent_id', user!.id);

    if (error) throw error;

    const buyerList = data.filter((p) => p.user_type === 'buyer' || p.user_type === 'renter');
    const sellerList = data.filter((p) => p.user_type === 'seller');

    setBuyers(buyerList);
    setSellers(sellerList);
  };

  const loadListings = async () => {
    const { data: activeData, error: activeError } = await supabase
      .from('properties')
      .select(`
        *,
        photos:property_photos(photo_url),
        seller:profiles!properties_seller_id_fkey(*)
      `)
      .eq('agent_id', user!.id)
      .in('status', ['active', 'pending'])
      .order('created_at', { ascending: false });

    if (activeError) throw activeError;
    setActiveListings(activeData || []);

    const { data: soldData, error: soldError } = await supabase
      .from('properties')
      .select(`
        *,
        photos:property_photos(photo_url),
        seller:profiles!properties_seller_id_fkey(*)
      `)
      .eq('agent_id', user!.id)
      .in('status', ['sold', 'rented'])
      .order('updated_at', { ascending: false });

    if (soldError) throw soldError;
    setSoldListings(soldData || []);
  };

  const loadUnreadMessages = async () => {
    const { data: participantData, error: participantError } = await supabase
      .from('conversation_participants')
      .select('conversation_id, last_read_at')
      .eq('user_id', user!.id);

    if (participantError) throw participantError;

    let unreadCount = 0;
    for (const participant of participantData) {
      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .select('created_at')
        .eq('conversation_id', participant.conversation_id)
        .neq('sender_id', user!.id);

      if (messageError) continue;

      if (!participant.last_read_at) {
        unreadCount += messageData.length;
      } else {
        const unreadInConversation = messageData.filter(
          (msg) => new Date(msg.created_at) > new Date(participant.last_read_at!)
        );
        unreadCount += unreadInConversation.length;
      }
    }

    setUnreadMessages(unreadCount);
  };

  const loadInvitations = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('agent_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error && data) {
      setInvitations(data);
    }
  };


  const getInvitationStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted':
        return <CheckCircle size={16} className="text-green-600" />;
      case 'expired':
        return <XCircle size={16} className="text-red-600" />;
      default:
        return <Clock size={16} className="text-yellow-600" />;
    }
  };

  const getInvitationStatusText = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'Accepted';
      case 'expired':
        return 'Expired';
      case 'cancelled':
        return 'Cancelled';
      default:
        return 'Pending';
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!confirm('Are you sure you want to cancel this invitation?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('invitations')
        .update({ status: 'cancelled' })
        .eq('id', invitationId);

      if (error) throw error;

      await loadInvitations();
    } catch (error: any) {
      console.error('Error cancelling invitation:', error);
      alert('Failed to cancel invitation. Please try again.');
    }
  };

  const handleDeleteInvitation = async (invitationId: string) => {
    if (!confirm('Are you sure you want to delete this invitation? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('invitations')
        .delete()
        .eq('id', invitationId);

      if (error) throw error;

      await loadInvitations();
    } catch (error: any) {
      console.error('Error deleting invitation:', error);
      alert('Failed to delete invitation. Please try again.');
    }
  };

  const handleCopyInvitationLink = (token: string) => {
    const appUrl = window.location.origin;
    const invitationUrl = `${appUrl}#/invite/${token}`;
    navigator.clipboard.writeText(invitationUrl).then(() => {
      alert('Invitation link copied to clipboard!');
    }).catch(() => {
      alert('Failed to copy link. Please try again.');
    });
  };

  const handleOpenInvitation = (token: string) => {
    navigate(`/invite/${token}`);
  };

  const calculateTotalValue = (listings: Property[]) => {
    return listings.reduce((sum, prop) => sum + prop.price, 0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleUnassignSeller = async (sellerId: string, sellerName: string) => {
    try {
      // Unassign agent from all properties owned by this seller
      const { error: propertiesError } = await supabase
        .from('properties')
        .update({ agent_id: null, updated_at: new Date().toISOString() })
        .eq('seller_id', sellerId)
        .eq('agent_id', user!.id);

      if (propertiesError) throw propertiesError;

      // Update seller's assigned_agent to null
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ assigned_agent: null })
        .eq('id', sellerId);

      if (profileError) throw profileError;

      // Reload dashboard data
      await loadDashboardData();

      alert(`Successfully unassigned ${sellerName}. Their properties are now available for other agents to claim.`);
    } catch (error: any) {
      console.error('Error unassigning seller:', error);
      alert(error.message || 'Failed to unassign seller');
    }
  };

  const handleUnassignBuyer = async (buyerId: string, buyerName: string) => {
    try {
      // Update buyer's assigned_agent to null
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ assigned_agent: null })
        .eq('id', buyerId);

      if (profileError) throw profileError;

      // Reload dashboard data
      await loadDashboardData();

      alert(`Successfully unassigned ${buyerName}.`);
    } catch (error: any) {
      console.error('Error unassigning buyer:', error);
      alert(error.message || 'Failed to unassign buyer');
    }
  };

  const handleTutorialComplete = async () => {
    try {
      const { error } = await supabase
        .from('agent_profiles')
        .update({ tutorial_completed: true })
        .eq('id', user!.id);

      if (error) throw error;

      setShowTutorial(false);
      setAgentProfile({ ...agentProfile!, tutorial_completed: true });
    } catch (error) {
      console.error('Error marking tutorial as completed:', error);
    }
  };

  const handleTutorialSkip = async () => {
    try {
      const { error } = await supabase
        .from('agent_profiles')
        .update({ tutorial_completed: true })
        .eq('id', user!.id);

      if (error) throw error;

      setShowTutorial(false);
      setAgentProfile({ ...agentProfile!, tutorial_completed: true });
    } catch (error) {
      console.error('Error skipping tutorial:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-white shadow-sm border-b mb-8">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Agent Dashboard</h1>
          <p className="text-gray-600">Welcome back, {profile?.full_name}</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-12">
        <div className="flex gap-2 mb-8 border-b border-gray-200 overflow-x-auto">
          <button
            onClick={() => setActiveSection('dashboard')}
            className={`px-6 py-3 font-medium border-b-2 transition whitespace-nowrap ${
              activeSection === 'dashboard'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveSection('pipeline')}
            className={`px-6 py-3 font-medium border-b-2 transition whitespace-nowrap ${
              activeSection === 'pipeline'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            Pipeline
          </button>
          <button
            onClick={() => setActiveSection('analytics')}
            className={`px-6 py-3 font-medium border-b-2 transition whitespace-nowrap ${
              activeSection === 'analytics'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            Analytics
          </button>
          <button
            onClick={() => setActiveSection('teams')}
            className={`px-6 py-3 font-medium border-b-2 transition whitespace-nowrap ${
              activeSection === 'teams'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            Teams
          </button>
          <button
            onClick={() => setActiveSection('calendar')}
            className={`px-6 py-3 font-medium border-b-2 transition whitespace-nowrap ${
              activeSection === 'calendar'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            Calendar
          </button>
          <button
            onClick={() => setActiveSection('reviews')}
            className={`px-6 py-3 font-medium border-b-2 transition whitespace-nowrap ${
              activeSection === 'reviews'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            Reviews
          </button>
          <button
            onClick={() => setActiveSection('services')}
            className={`px-6 py-3 font-medium border-b-2 transition whitespace-nowrap ${
              activeSection === 'services'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            Services
          </button>
          <button
            onClick={() => setActiveSection('managed-accounts')}
            className={`px-6 py-3 font-medium border-b-2 transition whitespace-nowrap ${
              activeSection === 'managed-accounts'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            Managed Accounts
          </button>
          <button
            onClick={() => setActiveSection('signatures')}
            className={`px-6 py-3 font-medium border-b-2 transition whitespace-nowrap ${
              activeSection === 'signatures'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            E-Signatures
          </button>
        </div>

        {activeSection === 'pipeline' && <TransactionPipeline />}

        {activeSection === 'analytics' && <AgentAnalytics />}

        {activeSection === 'teams' && <TeamManagement />}

        {activeSection === 'calendar' && <AgentCalendar />}

        {activeSection === 'managed-accounts' && <ManagedAccountsManagement />}

        {activeSection === 'signatures' && <SignaturesManagement />}

        {activeSection === 'reviews' && (
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Client Reviews</h2>
              <button
                onClick={() => setShowImportReview(true)}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium"
              >
                <Plus size={20} />
                Import Review
              </button>
            </div>
            {reviews.length > 0 ? (
              <div className="space-y-6">
                {reviews.map((review: any) => (
                  <div key={review.id} className="border-b last:border-b-0 pb-6 last:pb-0">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                size={20}
                                className={i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                              />
                            ))}
                          </div>
                          <span className="text-gray-500 text-sm">
                            {new Date(review.created_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                        {review.is_imported && review.external_source && (
                          <div className="flex items-center gap-2 mb-2">
                            <Globe size={16} className="text-blue-600" />
                            <span className="text-sm text-gray-600">
                              Originally posted on <span className="font-medium text-blue-600">{review.external_source}</span>
                            </span>
                            {review.external_url && (
                              <a
                                href={review.external_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-700"
                              >
                                <ExternalLink size={16} />
                              </a>
                            )}
                          </div>
                        )}
                        {review.external_reviewer_name && (
                          <p className="text-sm text-gray-600 mb-1">
                            By {review.external_reviewer_name}
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="text-gray-700 leading-relaxed">{review.comment}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Star size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500 text-lg">No reviews yet</p>
                <p className="text-gray-400 text-sm mt-2 mb-4">Reviews from your clients will appear here</p>
                <button
                  onClick={() => setShowImportReview(true)}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Import your first review
                </button>
              </div>
            )}
          </div>
        )}

        {activeSection === 'services' && <ServiceRequestsTracking />}

        {activeSection === 'dashboard' && (
          <>
            <TeamInvitations />

            {agentProfile && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <div className="flex items-start gap-6 mb-6">
              <div className="flex-shrink-0">
                {agentProfile.profile_photo_url ? (
                  <img
                    src={agentProfile.profile_photo_url}
                    alt={profile?.full_name}
                    className="w-24 h-24 rounded-full object-cover border-4 border-gray-200"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center border-4 border-gray-200">
                    <User size={36} className="text-gray-400" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-gray-800">Agent Profile</h2>
                    <button
                      onClick={() => navigate('/agent/setup')}
                      className="text-gray-400 hover:text-blue-600 transition"
                      title="Edit Profile"
                    >
                      <Pencil size={18} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">License Number</p>
                    <p className="font-medium text-gray-800">{agentProfile.license_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Rating</p>
                    <div className="flex items-center gap-2">
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            size={16}
                            className={i < Math.floor(parseFloat(String(agentProfile.star_rating))) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                          />
                        ))}
                      </div>
                      <span className="font-medium text-gray-800">{parseFloat(String(agentProfile.star_rating)).toFixed(1)}</span>
                      {reviews.length > 0 && (
                        <span className="text-gray-500 text-sm">({reviews.length})</span>
                      )}
                    </div>
                  </div>
                  {(agentProfile as any).years_experience && (
                    <div>
                      <p className="text-sm text-gray-600">Years of Experience</p>
                      <p className="font-medium text-gray-800">{(agentProfile as any).years_experience} years</p>
                    </div>
                  )}
                  {(agentProfile as any).brokerage && (
                    <div>
                      <p className="text-sm text-gray-600">Brokerage</p>
                      <p className="font-medium text-gray-800">{(agentProfile as any).brokerage}</p>
                    </div>
                  )}
                  {(agentProfile as any).specialization && (
                    <div>
                      <p className="text-sm text-gray-600">Specialization</p>
                      <p className="font-medium text-gray-800">{(agentProfile as any).specialization}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-600">Languages</p>
                    <p className="font-medium text-gray-800">{agentProfile.languages.join(', ')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Service Areas</p>
                    <p className="font-medium text-gray-800">{agentProfile.locations.join(', ')}</p>
                  </div>
                </div>
                {agentProfile.bio && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-600 mb-2">Professional Bio</p>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-line">{agentProfile.bio}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}


        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <Building2 className="text-blue-500" size={24} />
              <span className="text-3xl font-bold text-gray-800">{activeListings.length}</span>
            </div>
            <p className="text-gray-600 mb-3">Active Listings</p>
            {activeListings.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {activeListings.slice(0, 8).map((property) => {
                  const firstPhoto = property.photos?.[0]?.photo_url;
                  return (
                    <button
                      key={property.id}
                      onClick={() => {
                        setActiveTab('active');
                        setTimeout(() => {
                          const element = document.getElementById(`property-${property.id}`);
                          element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }, 100);
                      }}
                      className="group relative"
                      title={property.address_line1}
                    >
                      {firstPhoto ? (
                        <img
                          src={firstPhoto}
                          alt={property.address_line1}
                          className="w-12 h-12 rounded-full object-cover border-2 border-gray-200 group-hover:border-blue-500 transition"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gray-200 border-2 border-gray-300 group-hover:border-blue-500 transition flex items-center justify-center">
                          <Building2 size={20} className="text-gray-500" />
                        </div>
                      )}
                    </button>
                  );
                })}
                {activeListings.length > 8 && (
                  <div className="w-12 h-12 rounded-full bg-gray-100 border-2 border-gray-300 flex items-center justify-center">
                    <span className="text-xs font-medium text-gray-600">+{activeListings.length - 8}</span>
                  </div>
                )}
              </div>
            )}
            <p className="text-sm text-gray-500">
              Total: {formatCurrency(calculateTotalValue(activeListings))}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="text-green-500" size={24} />
              <span className="text-3xl font-bold text-gray-800">{soldListings.length}</span>
            </div>
            <p className="text-gray-600">Sold/Rented</p>
            <p className="text-sm text-gray-500 mt-1">
              Total: {formatCurrency(calculateTotalValue(soldListings))}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <button
              onClick={() => setShowClientsExpanded(!showClientsExpanded)}
              className="w-full text-left hover:opacity-80 transition cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <Users className="text-purple-500" size={24} />
                <span className="text-3xl font-bold text-gray-800">
                  {buyers.length + sellers.length}
                </span>
              </div>
              <p className="text-gray-600">Total Clients</p>
              <p className="text-sm text-gray-500 mt-1">
                {buyers.length} Buyers, {sellers.length} Sellers
              </p>
            </button>
            {showClientsExpanded && (buyers.length > 0 || sellers.length > 0) && (
              <div className="mt-4 pt-4 border-t border-gray-200 space-y-2 max-h-80 overflow-y-auto">
                {buyers.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Buyers</p>
                    {buyers.map((buyer) => (
                      <div
                        key={buyer.id}
                        className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 rounded-md transition"
                      >
                        <div className="bg-blue-100 rounded-full p-1.5">
                          <User size={16} className="text-blue-600" />
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/profile/${buyer.id}`);
                          }}
                          className="flex-1 min-w-0 text-left"
                        >
                          <p className="font-medium text-gray-800 text-sm truncate">{buyer.full_name}</p>
                          <p className="text-xs text-gray-500 truncate">{buyer.phone_number || 'No phone'}</p>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBuyer({ id: buyer.id, name: buyer.full_name });
                            setShowBuyerProgressModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-700 p-1"
                          title="Track journey progress"
                        >
                          <TrendingUp size={16} />
                        </button>
                      </div>
                    ))}
                  </>
                )}
                {sellers.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2 mt-3">Sellers</p>
                    {sellers.map((seller) => (
                      <div
                        key={seller.id}
                        className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 rounded-md transition"
                      >
                        <div className="bg-green-100 rounded-full p-1.5">
                          <User size={16} className="text-green-600" />
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/profile/${seller.id}`);
                          }}
                          className="flex-1 min-w-0 text-left"
                        >
                          <p className="font-medium text-gray-800 text-sm truncate">{seller.full_name}</p>
                          <p className="text-xs text-gray-500 truncate">{seller.phone_number || 'No phone'}</p>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSeller({ id: seller.id, name: seller.full_name });
                            setShowSellerProgressModal(true);
                          }}
                          className="text-green-600 hover:text-green-700 p-1"
                          title="Track journey progress"
                        >
                          <TrendingUp size={16} />
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <MessageSquare className="text-orange-500" size={24} />
              <span className="text-3xl font-bold text-gray-800">{unreadMessages}</span>
            </div>
            <p className="text-gray-600">Unread Messages</p>
            <button
              onClick={() => navigate('/messages')}
              className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View Messages
            </button>
          </div>
        </div>

        <div className="mb-8">
          <UpcomingReminders />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Users size={24} className="text-blue-600" />
                Assigned Buyers
              </h2>
              <span className="text-sm text-gray-600">{buyers.length} total</span>
            </div>
            {buyers.length === 0 ? (
              <p className="text-gray-600 text-center py-8">No buyers assigned yet</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {buyers.map((buyer) => (
                  <div
                    key={buyer.id}
                    className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-md"
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-100 rounded-full p-2">
                        <User size={20} className="text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{buyer.full_name}</p>
                        <p className="text-sm text-gray-600 capitalize">{buyer.user_type}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedBuyer({ id: buyer.id, name: buyer.full_name });
                          setShowBuyerProgressModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-700 p-2 rounded-md hover:bg-blue-50 transition"
                        title="Track journey"
                      >
                        <TrendingUp size={18} />
                      </button>
                      <button
                        onClick={() => navigate(`/messages/new`)}
                        className="text-blue-600 hover:text-blue-700 p-2 rounded-md hover:bg-blue-50 transition"
                        title="Send message"
                      >
                        <MessageSquare size={18} />
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm(`Are you sure you want to unassign ${buyer.full_name}?`)) {
                            await handleUnassignBuyer(buyer.id, buyer.full_name);
                          }
                        }}
                        className="text-red-600 hover:text-red-700 p-2 rounded-md hover:bg-red-50 transition"
                        title="Unassign buyer"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <DollarSign size={24} className="text-green-600" />
                Assigned Sellers
              </h2>
              <span className="text-sm text-gray-600">{sellers.length} total</span>
            </div>
            {sellers.length === 0 ? (
              <p className="text-gray-600 text-center py-8">No sellers assigned yet</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {sellers.map((seller) => (
                  <div
                    key={seller.id}
                    className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-md"
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-green-100 rounded-full p-2">
                        <User size={20} className="text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{seller.full_name}</p>
                        <p className="text-sm text-gray-600 capitalize">{seller.user_type}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedSeller({ id: seller.id, name: seller.full_name });
                          setShowSellerProgressModal(true);
                        }}
                        className="text-green-600 hover:text-green-700 p-2 rounded-md hover:bg-green-50 transition"
                        title="Track journey"
                      >
                        <TrendingUp size={18} />
                      </button>
                      <button
                        onClick={() => navigate(`/messages/new`)}
                        className="text-blue-600 hover:text-blue-700 p-2 rounded-md hover:bg-blue-50 transition"
                        title="Send message"
                      >
                        <MessageSquare size={18} />
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm(`Are you sure you want to unassign ${seller.full_name}? Their properties will become unassigned.`)) {
                            await handleUnassignSeller(seller.id, seller.full_name);
                          }
                        }}
                        className="text-red-600 hover:text-red-700 p-2 rounded-md hover:bg-red-50 transition"
                        title="Unassign seller"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Mail size={24} className="text-blue-600" />
              Invitations & Referrals
            </h2>
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition font-medium"
            >
              <Send size={18} />
              Send Invitation
            </button>
          </div>

          {invitations.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">No invitations sent yet</p>
              <p className="text-sm text-gray-500">
                Invite buyers, sellers, and other agents to join your network
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-md border border-gray-200"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`rounded-full p-2 ${
                      invitation.user_type === 'buyer' ? 'bg-blue-100' :
                      invitation.user_type === 'seller' ? 'bg-green-100' : 'bg-purple-100'
                    }`}>
                      <User size={18} className={
                        invitation.user_type === 'buyer' ? 'text-blue-600' :
                        invitation.user_type === 'seller' ? 'text-green-600' : 'text-purple-600'
                      } />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">{invitation.email}</p>
                      <p className="text-sm text-gray-600 capitalize">
                        {invitation.user_type === 'agent' ? 'Agent Referral' : invitation.user_type}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="flex items-center gap-1 mb-1">
                        {getInvitationStatusIcon(invitation.status)}
                        <span className={`text-sm font-medium ${
                          invitation.status === 'accepted' ? 'text-green-600' :
                          invitation.status === 'expired' ? 'text-red-600' :
                          invitation.status === 'cancelled' ? 'text-gray-600' : 'text-yellow-600'
                        }`}>
                          {getInvitationStatusText(invitation.status)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {new Date(invitation.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {invitation.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleOpenInvitation(invitation.token)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition"
                            title="Open invitation page"
                          >
                            <ExternalLink size={18} />
                          </button>
                          <button
                            onClick={() => handleCopyInvitationLink(invitation.token)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-md transition"
                            title="Copy invitation link"
                          >
                            <Copy size={18} />
                          </button>
                          <button
                            onClick={() => handleCancelInvitation(invitation.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-md transition"
                            title="Cancel invitation"
                          >
                            <X size={18} />
                          </button>
                        </>
                      )}
                      {(invitation.status === 'cancelled' || invitation.status === 'accepted') && (
                        <button
                          onClick={() => handleDeleteInvitation(invitation.id)}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-md transition"
                          title="Delete invitation"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mb-8">
          <BrokerageInvitations />
        </div>

        <div className="mb-8">
          <AgentCalendar />
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <FileText className="text-blue-600" size={28} />
            <h2 className="text-2xl font-bold text-gray-800">Document Management</h2>
          </div>

          <div className="bg-white rounded-lg shadow mb-4">
            <div className="border-b">
              <div className="flex px-6">
                <button
                  onClick={() => setDocumentTab('documents')}
                  className={`px-6 py-3 font-medium border-b-2 transition ${
                    documentTab === 'documents'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Documents & Data Room
                </button>
                <button
                  onClick={() => setDocumentTab('checklists')}
                  className={`px-6 py-3 font-medium border-b-2 transition ${
                    documentTab === 'checklists'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Document Checklists
                </button>
              </div>
            </div>
          </div>

          {documentTab === 'documents' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <DocumentUpload onUploadComplete={() => setDocumentRefresh(prev => prev + 1)} />
              </div>
              <div className="lg:col-span-2">
                <DocumentList refreshTrigger={documentRefresh} />
              </div>
            </div>
          ) : (
            <DocumentChecklistManager />
          )}
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="border-b">
            <div className="flex items-center justify-between px-6 py-4">
              <nav className="flex">
                <button
                  onClick={() => setActiveTab('active')}
                  className={`px-6 py-2 font-medium border-b-2 transition ${
                    activeTab === 'active'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Building2 size={20} />
                    <span>Active Listings ({activeListings.length})</span>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('sold')}
                  className={`px-6 py-2 font-medium border-b-2 transition ${
                    activeTab === 'sold'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <TrendingUp size={20} />
                    <span>Sold/Rented ({soldListings.length})</span>
                  </div>
                </button>
              </nav>
              <button
                onClick={() => navigate('/properties/create')}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition font-medium"
              >
                New Listing
              </button>
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'active' && (
              <>
                {activeListings.length === 0 ? (
                  <div className="text-center py-12 text-gray-600">
                    <p>No active listings. Create your first listing to get started!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {activeListings.map((property) => (
                      <PropertyCard
                        key={property.id}
                        property={property}
                        onSellerAssigned={loadListings}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
            {activeTab === 'sold' && (
              <>
                {soldListings.length === 0 ? (
                  <div className="text-center py-12 text-gray-600">
                    <p>No sold or rented properties yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {soldListings.map((property) => (
                      <PropertyCard
                        key={property.id}
                        property={property}
                        onSellerAssigned={loadListings}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
          </>
        )}
      </div>

      {showInviteModal && (
        <SendInvitation
          onClose={() => setShowInviteModal(false)}
          onInvitationSent={() => {
            setShowInviteModal(false);
            loadInvitations();
            loadAssignedClients();
          }}
        />
      )}

      {showSellerProgressModal && selectedSeller && (
        <UpdateSellerProgress
          sellerId={selectedSeller.id}
          sellerName={selectedSeller.name}
          onClose={() => {
            setShowSellerProgressModal(false);
            setSelectedSeller(null);
          }}
        />
      )}

      {showBuyerProgressModal && selectedBuyer && (
        <UpdateBuyerProgress
          buyerId={selectedBuyer.id}
          buyerName={selectedBuyer.name}
          onClose={() => {
            setShowBuyerProgressModal(false);
            setSelectedBuyer(null);
          }}
          onUpdate={() => {}}
        />
      )}

      {showTutorial && (
        <AgentTutorial
          onComplete={handleTutorialComplete}
          onSkip={handleTutorialSkip}
        />
      )}

      {showImportReview && (
        <ImportExternalReview
          onClose={() => setShowImportReview(false)}
          onSuccess={() => {
            loadReviews();
            loadAgentProfile();
          }}
        />
      )}

      <AgentChatbot />
    </div>
  );
}
