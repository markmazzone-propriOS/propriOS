/*
  # Update Invitation Acceptance to Assign Agent

  ## Changes
  This migration updates the invitation acceptance trigger to also set the
  `assigned_agent_id` field in the buyer/seller profile when they accept
  an invitation.

  ## Modified Functions
  - `handle_invitation_acceptance()` - Now also updates the profile's assigned_agent_id

  ## Security
  - Function uses SECURITY DEFINER to allow profile updates
  - Only updates the profile of the user who accepted the invitation
*/

-- Update function to also assign agent to buyer/seller profile
CREATE OR REPLACE FUNCTION handle_invitation_acceptance()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if status changed to 'accepted'
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- Create agent-client relationship
    INSERT INTO agent_clients (agent_id, client_id, client_type)
    VALUES (NEW.agent_id, NEW.accepted_by, NEW.user_type)
    ON CONFLICT (agent_id, client_id) DO NOTHING;
    
    -- Update the buyer/seller profile to set assigned_agent_id
    UPDATE profiles
    SET assigned_agent_id = NEW.agent_id,
        updated_at = now()
    WHERE id = NEW.accepted_by;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
