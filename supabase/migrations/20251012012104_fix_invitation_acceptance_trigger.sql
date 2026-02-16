/*
  # Fix Invitation Acceptance Trigger

  ## Changes
  This migration fixes the invitation acceptance trigger by removing the reference
  to the non-existent agent_clients table and only updating the profile's assigned_agent_id.

  ## Modified Functions
  - `handle_invitation_acceptance()` - Removes agent_clients insert, only updates profile

  ## Security
  - Function uses SECURITY DEFINER to allow profile updates
*/

-- Update function to only assign agent to buyer/seller profile
CREATE OR REPLACE FUNCTION handle_invitation_acceptance()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if status changed to 'accepted'
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- Update the buyer/seller profile to set assigned_agent_id
    UPDATE profiles
    SET assigned_agent_id = NEW.agent_id,
        updated_at = now()
    WHERE id = NEW.accepted_by;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
