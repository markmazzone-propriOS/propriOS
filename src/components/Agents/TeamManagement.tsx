import { useState, useEffect } from 'react';
import { Users, Plus, Mail, Trash2, Crown, Shield, User, Clock, CheckCircle, XCircle, Ban } from 'lucide-react';
import { supabase, Team, TeamMember, Profile, TeamInvitation } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CreateTeamModal } from './CreateTeamModal';
import { InviteTeamMemberModal } from './InviteTeamMemberModal';

type TeamWithMembers = Team & {
  members: (TeamMember & { profile: Profile })[];
  memberCount: number;
  invitations: TeamInvitation[];
  ownerProfile?: Profile;
};

export function TeamManagement() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  useEffect(() => {
    loadTeams();
  }, [user]);

  const loadTeams = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .order('created_at', { ascending: false });

      if (teamsError) {
        console.error('Error loading teams:', teamsError);
        throw teamsError;
      }

      const teamsWithMembers = await Promise.all(
        (teamsData || []).map(async (team) => {
          const { data: membersData, error: membersError } = await supabase
            .from('team_members')
            .select('*, profile:profiles!team_members_agent_id_fkey(*)')
            .eq('team_id', team.id);

          if (membersError) {
            console.error('Error loading members for team:', team.id, membersError);
            throw membersError;
          }

          const { data: invitationsData, error: invitationsError } = await supabase
            .from('team_invitations')
            .select('*')
            .eq('team_id', team.id)
            .order('created_at', { ascending: false });

          if (invitationsError) {
            console.error('Error loading invitations for team:', team.id, invitationsError);
          }

          // Get owner profile
          const { data: ownerData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', team.owner_id)
            .maybeSingle();

          return {
            ...team,
            members: membersData || [],
            memberCount: membersData?.length || 0,
            invitations: invitationsData || [],
            ownerProfile: ownerData || undefined,
          };
        })
      );

      setTeams(teamsWithMembers);
    } catch (error) {
      console.error('Error loading teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm('Are you sure you want to delete this team? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase.from('teams').delete().eq('id', teamId);

      if (error) throw error;

      await loadTeams();
    } catch (error) {
      console.error('Error deleting team:', error);
      alert('Failed to delete team');
    }
  };

  const handleRemoveMember = async (teamId: string, memberId: string) => {
    if (!confirm('Are you sure you want to remove this member from the team?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      await loadTeams();
    } catch (error) {
      console.error('Error removing member:', error);
      alert('Failed to remove member');
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: 'admin' | 'member') => {
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;

      await loadTeams();
    } catch (error) {
      console.error('Error updating role:', error);
      alert('Failed to update member role');
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown size={16} className="text-yellow-600" />;
      case 'admin':
        return <Shield size={16} className="text-blue-600" />;
      default:
        return <User size={16} className="text-gray-600" />;
    }
  };

  const getInvitationStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock size={16} className="text-yellow-600" />;
      case 'accepted':
        return <CheckCircle size={16} className="text-green-600" />;
      case 'declined':
        return <XCircle size={16} className="text-red-600" />;
      case 'cancelled':
        return <Ban size={16} className="text-gray-600" />;
      default:
        return null;
    }
  };

  const getInvitationStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'accepted':
        return 'bg-green-100 text-green-800';
      case 'declined':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!confirm('Are you sure you want to cancel this invitation?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('team_invitations')
        .update({ status: 'cancelled' })
        .eq('id', invitationId);

      if (error) throw error;

      await loadTeams();
    } catch (error) {
      console.error('Error cancelling invitation:', error);
      alert('Failed to cancel invitation');
    }
  };

  const handleDeleteInvitation = async (invitationId: string) => {
    if (!confirm('Are you sure you want to delete this invitation? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('team_invitations')
        .delete()
        .eq('id', invitationId);

      if (error) throw error;

      await loadTeams();
    } catch (error) {
      console.error('Error deleting invitation:', error);
      alert('Failed to delete invitation');
    }
  };

  const canManageTeam = (team: TeamWithMembers) => {
    const member = team.members.find((m) => m.agent_id === user!.id);
    return team.owner_id === user!.id || member?.role === 'admin';
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Loading teams...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users size={32} className="text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Team Management</h2>
            <p className="text-gray-600">Create and manage your agent teams</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
        >
          <Plus size={20} />
          Create Team
        </button>
      </div>

      {teams.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Users size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 mb-2">No Teams Yet</h3>
          <p className="text-gray-600 mb-6">Create your first team to collaborate with other agents</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition"
          >
            Create Your First Team
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {teams.map((team) => (
            <div key={team.id} className="bg-white rounded-lg shadow">
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-gray-800">{team.name}</h3>
                      {team.owner_id === user!.id && (
                        <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                          You are Owner
                        </span>
                      )}
                    </div>
                    {team.description && (
                      <p className="text-gray-600 mb-3">{team.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      {team.ownerProfile && team.owner_id !== user!.id && (
                        <span className="flex items-center gap-1 font-medium text-gray-700">
                          <Crown size={14} className="text-yellow-600" />
                          Owner: {team.ownerProfile.full_name}
                        </span>
                      )}
                      <span>{team.memberCount} member{team.memberCount !== 1 ? 's' : ''}</span>
                      {team.invitations.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Mail size={14} />
                          {team.invitations.length} invitation{team.invitations.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      <span>Created {new Date(team.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {canManageTeam(team) && (
                      <>
                        <button
                          onClick={() => {
                            setSelectedTeam(team);
                            setShowInviteModal(true);
                          }}
                          className="flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50 transition"
                        >
                          <Mail size={16} />
                          Invite
                        </button>
                        {team.owner_id === user!.id && (
                          <button
                            onClick={() => handleDeleteTeam(team.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-md transition"
                            title="Delete Team"
                          >
                            <Trash2 size={20} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 p-6 bg-gray-50 space-y-6">
                <div>
                  <h4 className="font-semibold text-gray-800 mb-4">Team Members</h4>
                  <div className="space-y-3">
                    {team.members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between bg-white p-4 rounded-md"
                      >
                        <div className="flex items-center gap-3">
                          {getRoleIcon(member.role)}
                          <div>
                            <p className="font-medium text-gray-800">
                              {member.profile.full_name}
                            </p>
                            <p className="text-sm text-gray-600 capitalize">{member.role}</p>
                          </div>
                        </div>

                        {canManageTeam(team) && member.agent_id !== user!.id && member.role !== 'owner' && (
                          <div className="flex gap-2">
                            {member.role === 'member' ? (
                              <button
                                onClick={() => handleUpdateRole(member.id, 'admin')}
                                className="text-sm px-3 py-1 border border-blue-600 text-blue-600 rounded hover:bg-blue-50 transition"
                              >
                                Make Admin
                              </button>
                            ) : (
                              <button
                                onClick={() => handleUpdateRole(member.id, 'member')}
                                className="text-sm px-3 py-1 border border-gray-600 text-gray-600 rounded hover:bg-gray-50 transition"
                              >
                                Remove Admin
                              </button>
                            )}
                            <button
                              onClick={() => handleRemoveMember(team.id, member.id)}
                              className="text-sm px-3 py-1 text-red-600 hover:bg-red-50 rounded transition"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {team.invitations.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-4">Pending Invitations</h4>
                    <div className="space-y-3">
                      {team.invitations.map((invitation) => (
                        <div
                          key={invitation.id}
                          className="flex items-center justify-between bg-white p-4 rounded-md"
                        >
                          <div className="flex items-center gap-3">
                            {getInvitationStatusIcon(invitation.status)}
                            <div>
                              <p className="font-medium text-gray-800">
                                {invitation.invitee_name}
                              </p>
                              <p className="text-sm text-gray-600">{invitation.invitee_email}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                Sent {new Date(invitation.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className={`text-xs px-3 py-1 rounded-full font-medium capitalize ${getInvitationStatusColor(invitation.status)}`}>
                              {invitation.status}
                            </span>
                            {canManageTeam(team) && (
                              <>
                                {invitation.status === 'pending' && (
                                  <button
                                    onClick={() => handleCancelInvitation(invitation.id)}
                                    className="text-sm px-3 py-1 text-orange-600 hover:bg-orange-50 rounded transition"
                                  >
                                    Cancel
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteInvitation(invitation.id)}
                                  className="text-sm px-3 py-1 text-red-600 hover:bg-red-50 rounded transition"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateTeamModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={loadTeams}
        />
      )}

      {showInviteModal && selectedTeam && (
        <InviteTeamMemberModal
          team={selectedTeam}
          onClose={() => {
            setShowInviteModal(false);
            setSelectedTeam(null);
          }}
          onSuccess={loadTeams}
        />
      )}
    </div>
  );
}
