import { useState, useEffect } from 'react';
import { Heart, Eye, X, User, MessageSquare, TrendingUp, FileText, Sliders, Calendar, CreditCard, ClipboardCheck, DollarSign, CheckSquare } from 'lucide-react';
import { supabase, Property, Profile } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PropertyCard } from '../Properties/PropertyCard';
import { useNavigate } from '../Navigation/Router';
import { BuyerJourneyTracker } from './BuyerJourneyTracker';
import { SellerJourneyTracker } from '../Seller/SellerJourneyTracker';
import { RentalApplications } from './RentalApplications';
import { InvitationInfo } from '../shared/InvitationInfo';
import { BuyerTutorial } from './BuyerTutorial';

type PropertyWithPhotos = Property & {
  photos?: { photo_url: string }[];
};

export function BuyerDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<PropertyWithPhotos[]>([]);
  const [viewedProperties, setViewedProperties] = useState<PropertyWithPhotos[]>([]);
  const [rejectedProperties, setRejectedProperties] = useState<PropertyWithPhotos[]>([]);
  const [assignedAgent, setAssignedAgent] = useState<Profile | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [documentCount, setDocumentCount] = useState(0);
  const [pendingSignatures, setPendingSignatures] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'favorites' | 'viewed' | 'rejected'>('favorites');
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
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'favorites',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            loadFavorites();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'property_views',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            loadViewedProperties();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(messagesChannel);
      };
    }
  }, [user, profile]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadFavorites(),
        loadViewedProperties(),
        loadRejectedProperties(),
        loadAssignedAgent(),
        loadUnreadMessages(),
        loadDocumentCount(),
        loadPendingSignatures(),
        checkTutorialStatus(),
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkTutorialStatus = async () => {
    if (!user || !profile) return;

    if (profile.user_type === 'buyer' || profile.user_type === 'renter') {
      const tutorialCompleted = profile.tutorial_completed ?? false;
      setShowTutorial(!tutorialCompleted);
    }
  };

  const loadFavorites = async () => {
    const { data: favoriteData, error: favoriteError } = await supabase
      .from('favorites')
      .select('property_id')
      .eq('user_id', user!.id);

    if (favoriteError) throw favoriteError;

    if (favoriteData.length === 0) {
      setFavorites([]);
      return;
    }

    const propertyIds = favoriteData.map((f) => f.property_id);

    const { data: properties, error: propertiesError } = await supabase
      .from('properties')
      .select(`
        *,
        photos:property_photos(photo_url)
      `)
      .in('id', propertyIds);

    if (propertiesError) throw propertiesError;
    setFavorites(properties || []);
  };

  const loadViewedProperties = async () => {
    const { data: viewData, error: viewError } = await supabase
      .from('property_views')
      .select('property_id, viewed_at')
      .eq('user_id', user!.id)
      .order('viewed_at', { ascending: false })
      .limit(10);

    if (viewError) throw viewError;

    if (viewData.length === 0) {
      setViewedProperties([]);
      return;
    }

    const propertyIds = viewData.map((v) => v.property_id);

    const { data: properties, error: propertiesError } = await supabase
      .from('properties')
      .select(`
        *,
        photos:property_photos(photo_url)
      `)
      .in('id', propertyIds);

    if (propertiesError) throw propertiesError;

    const sortedProperties = propertyIds
      .map(id => properties?.find(p => p.id === id))
      .filter(p => p !== undefined);

    setViewedProperties(sortedProperties);
  };

  const loadRejectedProperties = async () => {
    const { data: rejectionData, error: rejectionError } = await supabase
      .from('property_rejections')
      .select('property_id')
      .eq('user_id', user!.id);

    if (rejectionError) throw rejectionError;

    if (rejectionData.length === 0) {
      setRejectedProperties([]);
      return;
    }

    const propertyIds = rejectionData.map((r) => r.property_id);

    const { data: properties, error: propertiesError } = await supabase
      .from('properties')
      .select(`
        *,
        photos:property_photos(photo_url)
      `)
      .in('id', propertyIds);

    if (propertiesError) throw propertiesError;
    setRejectedProperties(properties || []);
  };

  const loadAssignedAgent = async () => {
    if (!profile?.assigned_agent_id) {
      setAssignedAgent(null);
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profile.assigned_agent_id)
      .maybeSingle();

    if (error) throw error;

    if (data && data.user_type === 'agent' && !data.profile_photo_url) {
      const { data: agentProfile } = await supabase
        .from('agent_profiles')
        .select('profile_photo_url')
        .eq('id', profile.assigned_agent_id)
        .maybeSingle();

      if (agentProfile?.profile_photo_url) {
        data.profile_photo_url = agentProfile.profile_photo_url;
      }
    }

    setAssignedAgent(data);
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

  const loadDocumentCount = async () => {
    const { data: ownedDocs, error: ownedError } = await supabase
      .from('documents')
      .select('id')
      .eq('owner_id', user!.id);

    if (ownedError) {
      console.error('Error loading owned documents:', ownedError);
      return;
    }

    setDocumentCount(ownedDocs?.length || 0);
  };

  const loadPendingSignatures = async () => {
    const { count, error } = await supabase
      .from('document_signatures')
      .select('*', { count: 'exact', head: true })
      .eq('signer_id', user?.id)
      .eq('status', 'pending');

    if (error) {
      console.error('Error loading pending signatures:', error);
      return;
    }

    setPendingSignatures(count || 0);
  };


  const renderProperties = (properties: PropertyWithPhotos[], emptyMessage: string) => {
    if (properties.length === 0) {
      return (
        <div className="text-center py-12 text-gray-600">
          <p>{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {properties.map((property) => (
          <PropertyCard key={property.id} property={property} />
        ))}
      </div>
    );
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
      {showTutorial && <BuyerTutorial onClose={() => setShowTutorial(false)} />}

      <div className="bg-white shadow-sm border-b mb-8">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              {profile?.user_type === 'seller' && (
                <div>
                  {profile.profile_photo_url ? (
                    <img
                      src={profile.profile_photo_url}
                      alt={profile.full_name}
                      className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-300">
                      <User size={28} className="text-gray-400" />
                    </div>
                  )}
                </div>
              )}
              <div>
                <h1 className="text-3xl font-bold text-gray-800 mb-2">My Dashboard</h1>
                <p className="text-gray-600">Welcome back, {profile?.full_name}</p>
              </div>
            </div>
            {assignedAgent && (
              <div className="bg-gray-50 rounded-lg px-6 py-4 border border-gray-200">
                <div className="flex items-center gap-3">
                  {assignedAgent.profile_photo_url ? (
                    <img
                      src={assignedAgent.profile_photo_url}
                      alt={assignedAgent.full_name}
                      className="w-16 h-16 rounded-full object-cover border-2 border-gray-300"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center border-2 border-blue-200">
                      <User className="text-blue-600" size={28} />
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Your Agent</p>
                    <p className="font-semibold text-gray-800 text-lg">{assignedAgent.full_name}</p>
                    <button
                      onClick={() => navigate(`/agents/${assignedAgent.id}`)}
                      className="mt-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      View Profile
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-12">
        <div className="mb-8">
          <InvitationInfo />
        </div>

        {profile?.user_type === 'seller' ? (
          <SellerJourneyTracker />
        ) : profile?.user_type === 'buyer' ? (
          <BuyerJourneyTracker />
        ) : null}

        {profile?.user_type === 'renter' && (
          <div className="mb-8">
            <RentalApplications />
          </div>
        )}

        {profile?.user_type === 'buyer' && (
          <div className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <button
              onClick={() => navigate('/preferences')}
              className="flex items-center gap-3 bg-white rounded-lg shadow p-4 hover:shadow-md transition border-2 border-transparent hover:border-blue-500"
            >
              <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg">
                <Sliders className="text-blue-600" size={24} />
              </div>
              <div className="text-left flex-1">
                <h3 className="font-semibold text-gray-800">Search Preferences</h3>
                <p className="text-sm text-gray-600">Set your property search criteria and filters</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/buyer/calendar')}
              className="flex items-center gap-3 bg-white rounded-lg shadow p-4 hover:shadow-md transition border-2 border-transparent hover:border-green-500"
            >
              <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg">
                <Calendar className="text-green-600" size={24} />
              </div>
              <div className="text-left flex-1">
                <h3 className="font-semibold text-gray-800">My Viewings</h3>
                <p className="text-sm text-gray-600">View and manage your scheduled property viewings</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/buyer/pre-approvals')}
              className="flex items-center gap-3 bg-white rounded-lg shadow p-4 hover:shadow-md transition border-2 border-transparent hover:border-orange-500"
            >
              <div className="flex items-center justify-center w-12 h-12 bg-orange-100 rounded-lg">
                <CreditCard className="text-orange-600" size={24} />
              </div>
              <div className="text-left flex-1">
                <h3 className="font-semibold text-gray-800">Pre-Approvals</h3>
                <p className="text-sm text-gray-600">Request and track mortgage pre-approvals</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/buyer/loan-applications')}
              className="flex items-center gap-3 bg-white rounded-lg shadow p-4 hover:shadow-md transition border-2 border-transparent hover:border-blue-500"
            >
              <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg">
                <FileText className="text-blue-600" size={24} />
              </div>
              <div className="text-left flex-1">
                <h3 className="font-semibold text-gray-800">Loan Applications</h3>
                <p className="text-sm text-gray-600">Review and complete loan applications from your lender</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/buyer/inspections')}
              className="flex items-center gap-3 bg-white rounded-lg shadow p-4 hover:shadow-md transition border-2 border-transparent hover:border-purple-500"
            >
              <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg">
                <ClipboardCheck className="text-purple-600" size={24} />
              </div>
              <div className="text-left flex-1">
                <h3 className="font-semibold text-gray-800">Inspections</h3>
                <p className="text-sm text-gray-600">Schedule and track property inspections</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/buyer/appraisals')}
              className="flex items-center gap-3 bg-white rounded-lg shadow p-4 hover:shadow-md transition border-2 border-transparent hover:border-indigo-500"
            >
              <div className="flex items-center justify-center w-12 h-12 bg-indigo-100 rounded-lg">
                <DollarSign className="text-indigo-600" size={24} />
              </div>
              <div className="text-left flex-1">
                <h3 className="font-semibold text-gray-800">Appraisals</h3>
                <p className="text-sm text-gray-600">Schedule and track property appraisals</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/buyer/closing-checklist')}
              className="flex items-center gap-3 bg-white rounded-lg shadow p-4 hover:shadow-md transition border-2 border-transparent hover:border-emerald-500"
            >
              <div className="flex items-center justify-center w-12 h-12 bg-emerald-100 rounded-lg">
                <CheckSquare className="text-emerald-600" size={24} />
              </div>
              <div className="text-left flex-1">
                <h3 className="font-semibold text-gray-800">Closing Checklist</h3>
                <p className="text-sm text-gray-600">Complete all required tasks before closing</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/buyer/service-reports')}
              className="flex items-center gap-3 bg-white rounded-lg shadow p-4 hover:shadow-md transition border-2 border-transparent hover:border-teal-500"
            >
              <div className="flex items-center justify-center w-12 h-12 bg-teal-100 rounded-lg">
                <FileText className="text-teal-600" size={24} />
              </div>
              <div className="text-left flex-1">
                <h3 className="font-semibold text-gray-800">Service Reports</h3>
                <p className="text-sm text-gray-600">View completed inspection and service reports</p>
              </div>
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <Heart className="text-red-500" size={24} />
              <span className="text-3xl font-bold text-gray-800">{favorites.length}</span>
            </div>
            <p className="text-gray-600">Favorite Listings</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <Eye className="text-blue-500" size={24} />
              <span className="text-3xl font-bold text-gray-800">{viewedProperties.length}</span>
            </div>
            <p className="text-gray-600">Recently Viewed</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <MessageSquare className="text-green-500" size={24} />
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

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <FileText className="text-orange-500" size={24} />
              <span className="text-3xl font-bold text-gray-800">{documentCount}</span>
            </div>
            <p className="text-gray-600">Documents</p>
            <button
              onClick={() => navigate('/documents')}
              className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Manage Documents
            </button>
          </div>

          {pendingSignatures > 0 && (
            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg shadow p-6 border-2 border-yellow-300">
              <div className="flex items-center justify-between mb-2">
                <FileText className="text-yellow-600" size={24} />
                <span className="text-3xl font-bold text-yellow-800">{pendingSignatures}</span>
              </div>
              <p className="text-yellow-800 font-medium">Pending Signatures</p>
              <button
                onClick={() => navigate('/pending-signatures')}
                className="mt-3 text-sm text-yellow-700 hover:text-yellow-900 font-semibold underline"
              >
                Sign Documents →
              </button>
            </div>
          )}

        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="border-b">
            <nav className="flex">
              <button
                onClick={() => setActiveTab('favorites')}
                className={`px-6 py-4 font-medium border-b-2 transition ${
                  activeTab === 'favorites'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Heart size={20} />
                  <span>Favorites ({favorites.length})</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('viewed')}
                className={`px-6 py-4 font-medium border-b-2 transition ${
                  activeTab === 'viewed'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Eye size={20} />
                  <span>Recently Viewed ({viewedProperties.length})</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('rejected')}
                className={`px-6 py-4 font-medium border-b-2 transition ${
                  activeTab === 'rejected'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <X size={20} />
                  <span>Rejected ({rejectedProperties.length})</span>
                </div>
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'favorites' &&
              renderProperties(favorites, 'No favorite listings yet. Start exploring properties!')}
            {activeTab === 'viewed' &&
              renderProperties(viewedProperties, 'No viewed properties yet.')}
            {activeTab === 'rejected' &&
              renderProperties(rejectedProperties, 'No rejected properties.')}
          </div>
        </div>
      </div>
    </div>
  );
}
