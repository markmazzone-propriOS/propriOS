import { useState, useEffect } from 'react';
import { UserPlus, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface InviterInfo {
  name: string;
  type: string;
  photoUrl: string | null;
}

export function InvitationInfo() {
  const { user } = useAuth();
  const [inviterInfo, setInviterInfo] = useState<InviterInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadInviterInfo();
    }
  }, [user]);

  const loadInviterInfo = async () => {
    try {
      const { data: invitation, error } = await supabase
        .from('invitations')
        .select('agent_id, service_provider_id, property_owner_id, user_type')
        .eq('accepted_by', user!.id)
        .eq('status', 'accepted')
        .maybeSingle();

      if (error) {
        console.error('Error loading invitation:', error);
        return;
      }

      if (!invitation) {
        setInviterInfo(null);
        return;
      }

      let inviterId: string | null = null;
      let inviterType = '';

      if (invitation.agent_id) {
        inviterId = invitation.agent_id;
        inviterType = 'Agent';
      } else if (invitation.service_provider_id) {
        inviterId = invitation.service_provider_id;
        inviterType = 'Service Provider';
      } else if (invitation.property_owner_id) {
        inviterId = invitation.property_owner_id;
        inviterType = 'Property Owner';
      }

      if (inviterId) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name, profile_photo_url')
          .eq('id', inviterId)
          .maybeSingle();

        if (profileData) {
          let photoUrl = profileData.profile_photo_url;

          if (inviterType === 'Agent' && !photoUrl) {
            const { data: agentProfile } = await supabase
              .from('agent_profiles')
              .select('profile_photo_url')
              .eq('id', inviterId)
              .maybeSingle();

            photoUrl = agentProfile?.profile_photo_url || null;
          } else if (inviterType === 'Service Provider' && !photoUrl) {
            const { data: spProfile } = await supabase
              .from('service_provider_profiles')
              .select('logo_url')
              .eq('id', inviterId)
              .maybeSingle();

            photoUrl = spProfile?.logo_url || null;
          }

          setInviterInfo({
            name: profileData.full_name || 'Unknown',
            type: inviterType,
            photoUrl
          });
        }
      }
    } catch (error) {
      console.error('Error loading inviter info:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !inviterInfo) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 flex items-start space-x-3">
      {inviterInfo.photoUrl ? (
        <img
          src={inviterInfo.photoUrl}
          alt={inviterInfo.name}
          className="w-12 h-12 rounded-full object-cover border-2 border-blue-300"
        />
      ) : (
        <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
          <User size={24} className="text-white" />
        </div>
      )}
      <div className="flex-1">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <UserPlus size={16} className="text-blue-600" />
          Invited By
        </h3>
        <p className="text-sm text-gray-600">
          <span className="font-medium">{inviterInfo.name}</span>
          <span className="text-gray-500"> ({inviterInfo.type})</span>
        </p>
      </div>
    </div>
  );
}
