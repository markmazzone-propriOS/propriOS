import { useState, useEffect } from 'react';
import { Building2, Users, UserPlus, Mail, X, CheckCircle, XCircle, Home, TrendingUp, Trash2, User, Pencil, MapPin, Phone, Globe, FileText } from 'lucide-react';
import { supabase, Brokerage, BrokerageInvitation } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from '../Navigation/Router';
import { InviteAgentModal } from './InviteAgentModal';
import { BrokerageAgentsList } from './BrokerageAgentsList';
import { BrokerageSharedCalendar } from './BrokerageSharedCalendar';
import { BrokerageProfileEdit } from './BrokerageProfileEdit';
import { BrokerageListings } from './BrokerageListings';
import { BrokerageDocumentManagement } from './BrokerageDocumentManagement';
import { BrokerageAnalytics } from './BrokerageAnalytics';

export function BrokerageDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [brokerage, setBrokerage] = useState<Brokerage | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [invitations, setInvitations] = useState<BrokerageInvitation[]>([]);
  const [agentCount, setAgentCount] = useState(0);
  const [totalListings, setTotalListings] = useState(0);
  const [activeTab, setActiveTab] = useState<'analytics' | 'agents' | 'listings' | 'calendar' | 'documents' | 'invitations'>('analytics');
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  useEffect(() => {
    loadBrokerage();
  }, [user]);

  const loadBrokerage = async () => {
    if (!user) return;

    try {
      const { data: brokerageData, error: brokerageError } = await supabase
        .from('brokerages')
        .select('*')
        .eq('super_admin_id', user.id)
        .maybeSingle();

      if (brokerageError) throw brokerageError;

      if (!brokerageData) {
        navigate('/brokerage/setup');
        return;
      }

      setBrokerage(brokerageData);

      const { count: agentsCount } = await supabase
        .from('brokerage_agents')
        .select('*', { count: 'exact', head: true })
        .eq('brokerage_id', brokerageData.id)
        .eq('status', 'active');

      setAgentCount(agentsCount || 0);

      const { data: agentIds } = await supabase
        .from('brokerage_agents')
        .select('agent_id')
        .eq('brokerage_id', brokerageData.id)
        .eq('status', 'active');

      if (agentIds && agentIds.length > 0) {
        const { count: listingsCount } = await supabase
          .from('properties')
          .select('*', { count: 'exact', head: true })
          .in('agent_id', agentIds.map(a => a.agent_id))
          .eq('status', 'active');

        setTotalListings(listingsCount || 0);
      }

      await loadInvitations(brokerageData.id);
    } catch (error) {
      console.error('Error loading brokerage:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadInvitations = async (brokerageId: string) => {
    try {
      const { data, error } = await supabase
        .from('brokerage_invitations')
        .select('*')
        .eq('brokerage_id', brokerageId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setInvitations(data || []);
    } catch (error) {
      console.error('Error loading invitations:', error);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from('brokerage_invitations')
        .update({ status: 'cancelled' })
        .eq('id', invitationId);

      if (error) throw error;

      setInvitations(invitations.map(inv =>
        inv.id === invitationId ? { ...inv, status: 'cancelled' } : inv
      ));
    } catch (error) {
      console.error('Error cancelling invitation:', error);
    }
  };

  const handleDeleteInvitation = async (invitationId: string) => {
    if (!confirm('Are you sure you want to delete this invitation? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('brokerage_invitations')
        .delete()
        .eq('id', invitationId);

      if (error) throw error;

      setInvitations(invitations.filter(inv => inv.id !== invitationId));
    } catch (error: any) {
      console.error('Error deleting invitation:', error);
      alert(error.message || 'Failed to delete invitation');
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
    return null;
  }

  const pendingInvitations = invitations.filter(inv => inv.status === 'pending');

  return (
    <div className="min-h-screen bg-gray-50">
      {showInviteModal && (
        <InviteAgentModal
          brokerageId={brokerage.id}
          onClose={() => setShowInviteModal(false)}
          onInviteSent={async (newInvitation) => {
            setInvitations(prev => [newInvitation, ...prev]);
            await loadInvitations(brokerage.id);
          }}
        />
      )}

      <div className="bg-white shadow-sm border-b mb-8">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {brokerage.logo_url ? (
                <img
                  src={brokerage.logo_url}
                  alt={brokerage.company_name}
                  className="w-16 h-16 rounded-lg object-cover border-2 border-gray-200"
                />
              ) : (
                <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center border-2 border-blue-200">
                  <Building2 className="text-blue-600" size={32} />
                </div>
              )}
              <div>
                <h1 className="text-3xl font-bold text-gray-800">{brokerage.company_name}</h1>
                <p className="text-gray-600">Brokerage Dashboard</p>
              </div>
            </div>
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition font-medium"
            >
              <UserPlus size={20} />
              Invite Agent
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-12">
        {isEditingProfile ? (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-800">Edit Profile</h2>
              <button
                onClick={() => setIsEditingProfile(false)}
                className="text-gray-600 hover:text-gray-800 transition"
              >
                <X size={24} />
              </button>
            </div>
            <BrokerageProfileEdit
              brokerage={brokerage}
              onUpdate={(updatedBrokerage) => {
                setBrokerage(updatedBrokerage);
                setIsEditingProfile(false);
              }}
            />
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
              <div className="flex items-start gap-6 mb-6">
                <div className="flex-shrink-0">
                  {brokerage.logo_url ? (
                    <img
                      src={brokerage.logo_url}
                      alt={brokerage.company_name}
                      className="w-24 h-24 rounded-lg object-cover border-4 border-gray-200"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-lg bg-blue-100 flex items-center justify-center border-4 border-blue-200">
                      <Building2 size={36} className="text-blue-600" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold text-gray-800">Brokerage Profile</h2>
                      <button
                        onClick={() => setIsEditingProfile(true)}
                        className="text-gray-400 hover:text-blue-600 transition"
                        title="Edit Profile"
                      >
                        <Pencil size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Company Name</p>
                      <p className="font-medium text-gray-800">{brokerage.company_name}</p>
                    </div>
                    {brokerage.license_number && (
                      <div>
                        <p className="text-sm text-gray-600">License Number</p>
                        <p className="font-medium text-gray-800">{brokerage.license_number}</p>
                      </div>
                    )}
                    {brokerage.phone_number && (
                      <div>
                        <p className="text-sm text-gray-600">Phone Number</p>
                        <p className="font-medium text-gray-800 flex items-center gap-2">
                          <Phone size={16} className="text-gray-400" />
                          {brokerage.phone_number}
                        </p>
                      </div>
                    )}
                    {brokerage.email && (
                      <div>
                        <p className="text-sm text-gray-600">Email Address</p>
                        <p className="font-medium text-gray-800">{brokerage.email}</p>
                      </div>
                    )}
                  </div>
                  {(brokerage.address_line1 || brokerage.city || brokerage.state || brokerage.zip_code) && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-sm text-gray-600 mb-2">Office Address</p>
                      <div className="flex items-start gap-2">
                        <MapPin size={16} className="text-gray-400 mt-1 flex-shrink-0" />
                        <div className="text-gray-700">
                          {brokerage.address_line1 && <div>{brokerage.address_line1}</div>}
                          {brokerage.address_line2 && <div>{brokerage.address_line2}</div>}
                          {(brokerage.city || brokerage.state || brokerage.zip_code) && (
                            <div>
                              {brokerage.city && `${brokerage.city}, `}
                              {brokerage.state && `${brokerage.state} `}
                              {brokerage.zip_code}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => navigate(`/brokerage/${brokerage.id}`)}
                      className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center gap-2"
                    >
                      <Globe size={16} />
                      View Public Profile
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <Users className="text-blue-500" size={24} />
              <span className="text-3xl font-bold text-gray-800">{agentCount}</span>
            </div>
            <p className="text-gray-600">Active Agents</p>
          </div>

          <div
            className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition"
            onClick={() => setActiveTab('listings')}
          >
            <div className="flex items-center justify-between mb-2">
              <Home className="text-green-500" size={24} />
              <span className="text-3xl font-bold text-gray-800">{totalListings}</span>
            </div>
            <p className="text-gray-600">Active Listings</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <Mail className="text-purple-500" size={24} />
              <span className="text-3xl font-bold text-gray-800">{pendingInvitations.length}</span>
            </div>
            <p className="text-gray-600">Pending Invitations</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="text-orange-500" size={24} />
              <span className="text-3xl font-bold text-gray-800">{agentCount > 0 ? Math.round(totalListings / agentCount) : 0}</span>
            </div>
            <p className="text-gray-600">Avg Listings/Agent</p>
          </div>
        </div>

            <div className="mb-8">
              <button
                onClick={() => navigate('/brokerage/agent-analytics')}
                className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-4 rounded-lg hover:from-green-700 hover:to-green-800 transition font-medium shadow-md flex items-center justify-center gap-2"
              >
                <Users size={20} />
                View Individual Agent Analytics
              </button>
            </div>

            <div className="bg-white rounded-lg shadow mb-8">
              <div className="border-b">
                <nav className="flex overflow-x-auto">
                  <button
                    onClick={() => setActiveTab('analytics')}
                    className={`px-6 py-4 font-medium border-b-2 transition whitespace-nowrap ${
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
                  <button
                    onClick={() => setActiveTab('agents')}
                    className={`px-6 py-4 font-medium border-b-2 transition whitespace-nowrap ${
                      activeTab === 'agents'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Users size={20} />
                      <span>Agents ({agentCount})</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab('listings')}
                    className={`px-6 py-4 font-medium border-b-2 transition whitespace-nowrap ${
                      activeTab === 'listings'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Home size={20} />
                      <span>Listings ({totalListings})</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab('calendar')}
                    className={`px-6 py-4 font-medium border-b-2 transition whitespace-nowrap ${
                      activeTab === 'calendar'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Building2 size={20} />
                      <span>Shared Calendar</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab('documents')}
                    className={`px-6 py-4 font-medium border-b-2 transition whitespace-nowrap ${
                      activeTab === 'documents'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FileText size={20} />
                      <span>Documents</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab('invitations')}
                    className={`px-6 py-4 font-medium border-b-2 transition whitespace-nowrap ${
                      activeTab === 'invitations'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Mail size={20} />
                      <span>Invitations ({invitations.length})</span>
                    </div>
                  </button>
                </nav>
              </div>

              <div className="p-6">
                {activeTab === 'analytics' && <BrokerageAnalytics brokerageId={brokerage.id} />}

                {activeTab === 'agents' && <BrokerageAgentsList brokerageId={brokerage.id} />}

                {activeTab === 'listings' && <BrokerageListings brokerageId={brokerage.id} />}

                {activeTab === 'calendar' && <BrokerageSharedCalendar brokerageId={brokerage.id} />}

                {activeTab === 'documents' && <BrokerageDocumentManagement brokerageId={brokerage.id} />}

                {activeTab === 'invitations' && (
              <div className="space-y-4">
                {invitations.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <Mail className="mx-auto text-gray-400 mb-4" size={48} />
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">No Invitations</h3>
                    <p className="text-gray-600 mb-4">You haven't invited any agents yet</p>
                    <button
                      onClick={() => setShowInviteModal(true)}
                      className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition"
                    >
                      Send First Invitation
                    </button>
                  </div>
                ) : (
                  invitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-gray-800">
                          {invitation.invitee_name || invitation.invitee_email}
                        </div>
                        {invitation.invitee_name && (
                          <div className="text-sm text-gray-600">{invitation.invitee_email}</div>
                        )}
                        <div className="text-sm text-gray-500 mt-1">
                          Sent {new Date(invitation.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {invitation.status === 'pending' && (
                          <>
                            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-medium rounded-full">
                              Pending
                            </span>
                            <button
                              onClick={() => handleCancelInvitation(invitation.id)}
                              className="text-red-600 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition"
                              title="Cancel invitation"
                            >
                              <X size={20} />
                            </button>
                          </>
                        )}
                        {invitation.status === 'accepted' && (
                          <>
                            <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full flex items-center gap-1">
                              <CheckCircle size={16} />
                              Accepted
                            </span>
                            <button
                              onClick={() => handleDeleteInvitation(invitation.id)}
                              className="text-gray-600 hover:text-gray-700 p-2 hover:bg-gray-50 rounded-lg transition"
                              title="Delete invitation"
                            >
                              <Trash2 size={20} />
                            </button>
                          </>
                        )}
                        {invitation.status === 'declined' && (
                          <>
                            <span className="px-3 py-1 bg-red-100 text-red-800 text-sm font-medium rounded-full flex items-center gap-1">
                              <XCircle size={16} />
                              Declined
                            </span>
                            <button
                              onClick={() => handleDeleteInvitation(invitation.id)}
                              className="text-red-600 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition"
                              title="Delete invitation"
                            >
                              <Trash2 size={20} />
                            </button>
                          </>
                        )}
                        {invitation.status === 'cancelled' && (
                          <>
                            <span className="px-3 py-1 bg-gray-100 text-gray-800 text-sm font-medium rounded-full">
                              Cancelled
                            </span>
                            <button
                              onClick={() => handleDeleteInvitation(invitation.id)}
                              className="text-red-600 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition"
                              title="Delete invitation"
                            >
                              <Trash2 size={20} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
