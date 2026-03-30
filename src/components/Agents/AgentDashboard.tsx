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
  const [activeSection, setActiveSection] = useState<'dashboard' | 'pipeline' | 'documents'>('dashboard');
  const [showTutorial, setShowTutorial] = useState(false);

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

    if (data && !data.tutorial_completed) {
      setShowTutorial(true);
    }
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
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ assigned_agent: null })
        .eq('id', buyerId);

      if (profileError) throw profileError;

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
            Dashboard
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
            onClick={() => setActiveSection('documents')}
            className={`px-6 py-3 font-medium border-b-2 transition whitespace-nowrap ${
              activeSection === 'documents'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            Documents
          </button>
        </div>

        {activeSection === 'pipeline' && <TransactionPipeline />}

        {activeSection === 'documents' && (
          <div>
            <div className="bg-white rounded-lg shadow mb-8">
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

            <div className="mt-8">
              <SignaturesManagement />
            </div>
          </div>
        )}

        {activeSection === 'dashboard' && (
          <>
            <TeamInvitations />


        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <button
            onClick={() => navigate('/agent/listings')}
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition text-left"
          >
            <div className="flex items-center justify-between mb-2">
              <Building2 className="text-blue-500" size={24} />
              <span className="text-3xl font-bold text-gray-800">{activeListings.length}</span>
            </div>
            <p className="text-gray-600 mb-1">Active Listings</p>
            <p className="text-sm text-gray-500">
              {formatCurrency(calculateTotalValue(activeListings))}
            </p>
          </button>

          <button
            onClick={() => navigate('/agent/listings')}
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition text-left"
          >
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="text-green-500" size={24} />
              <span className="text-3xl font-bold text-gray-800">{soldListings.length}</span>
            </div>
            <p className="text-gray-600 mb-1">Sold/Rented</p>
            <p className="text-sm text-gray-500">
              {formatCurrency(calculateTotalValue(soldListings))}
            </p>
          </button>

          <button
            onClick={() => navigate('/agent/clients')}
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition text-left"
          >
            <div className="flex items-center justify-between mb-2">
              <Users className="text-indigo-500" size={24} />
              <span className="text-3xl font-bold text-gray-800">
                {buyers.length + sellers.length}
              </span>
            </div>
            <p className="text-gray-600 mb-1">Total Clients</p>
            <p className="text-sm text-gray-500">
              {buyers.length} Buyers, {sellers.length} Sellers
            </p>
          </button>

          <button
            onClick={() => navigate('/messages')}
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition text-left"
          >
            <div className="flex items-center justify-between mb-2">
              <MessageSquare className="text-orange-500" size={24} />
              <span className="text-3xl font-bold text-gray-800">{unreadMessages}</span>
            </div>
            <p className="text-gray-600 mb-1">Unread Messages</p>
            <p className="text-sm text-blue-600 font-medium">View all →</p>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <UpcomingReminders />
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">Quick Actions</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => navigate('/properties/create')}
                className="p-4 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition font-medium text-sm"
              >
                <Building2 size={20} className="mx-auto mb-2" />
                New Listing
              </button>
              <button
                onClick={() => setShowInviteModal(true)}
                className="p-4 border-2 border-green-600 text-green-600 rounded-lg hover:bg-green-50 transition font-medium text-sm"
              >
                <Send size={20} className="mx-auto mb-2" />
                Invite Client
              </button>
              <button
                onClick={() => navigate('/agent/calendar')}
                className="p-4 border-2 border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 transition font-medium text-sm"
              >
                <User size={20} className="mx-auto mb-2" />
                Schedule
              </button>
              <button
                onClick={() => navigate('/prospects')}
                className="p-4 border-2 border-orange-600 text-orange-600 rounded-lg hover:bg-orange-50 transition font-medium text-sm"
              >
                <Users size={20} className="mx-auto mb-2" />
                Prospects
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">Recent Activity</h2>
              <button
                onClick={() => navigate('/agent/calendar')}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View Calendar →
              </button>
            </div>
            <AgentCalendar />
          </div>

          <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">Recent Invitations</h2>
              <button
                onClick={() => setShowInviteModal(true)}
                className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 transition font-medium"
              >
                Send Invitation
              </button>
            </div>

            {invitations.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600 mb-2">No invitations sent yet</p>
                <p className="text-sm text-gray-500">
                  Invite buyers, sellers, and other agents to join your network
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {invitations.slice(0, 5).map((invitation) => (
                  <div
                    key={invitation.id}
                    className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-md border border-gray-200"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`rounded-full p-2 ${
                        invitation.user_type === 'buyer' ? 'bg-blue-100' :
                        invitation.user_type === 'seller' ? 'bg-green-100' : 'bg-indigo-100'
                      }`}>
                        <User size={18} className={
                          invitation.user_type === 'buyer' ? 'text-blue-600' :
                          invitation.user_type === 'seller' ? 'text-green-600' : 'text-indigo-600'
                        } />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 truncate">{invitation.email}</p>
                        <p className="text-sm text-gray-600 capitalize">
                          {invitation.user_type}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        {getInvitationStatusIcon(invitation.status)}
                        <span className={`text-xs font-medium ${
                          invitation.status === 'accepted' ? 'text-green-600' :
                          invitation.status === 'expired' ? 'text-red-600' :
                          invitation.status === 'cancelled' ? 'text-gray-600' : 'text-yellow-600'
                        }`}>
                          {getInvitationStatusText(invitation.status)}
                        </span>
                      </div>
                      {invitation.status === 'pending' && (
                        <button
                          onClick={() => handleCopyInvitationLink(invitation.token)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition"
                          title="Copy link"
                        >
                          <Copy size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mb-8">
          <BrokerageInvitations />
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800">Recent Listings</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/agent/listings')}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View All →
              </button>
              <button
                onClick={() => navigate('/properties/create')}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition font-medium text-sm"
              >
                New Listing
              </button>
            </div>
          </div>

          {activeListings.length === 0 ? (
            <div className="text-center py-12 text-gray-600">
              <Building2 size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="mb-4">No active listings yet</p>
              <button
                onClick={() => navigate('/properties/create')}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Create your first listing
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeListings.slice(0, 6).map((property) => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  onSellerAssigned={loadListings}
                />
              ))}
            </div>
          )}
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

      {showTutorial && (
        <AgentTutorial
          onComplete={handleTutorialComplete}
        />
      )}
    </div>
  );
}
