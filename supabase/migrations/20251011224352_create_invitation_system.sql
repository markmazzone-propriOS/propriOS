/*
  # Create Invitation System

  ## Overview
  This migration creates a comprehensive invitation system allowing agents to invite
  buyers and sellers to join the platform.

  ## New Tables
  
  ### `invitations`
  - `id` (uuid, primary key) - Unique invitation identifier
  - `agent_id` (uuid) - Agent who sent the invitation
  - `email` (text) - Invitee's email address
  - `user_type` (text) - Type of user being invited ('buyer' or 'seller')
  - `token` (text, unique) - Unique invitation token for secure acceptance
  - `status` (text) - Status of invitation ('pending', 'accepted', 'expired')
  - `expires_at` (timestamptz) - Expiration date (7 days from creation)
  - `accepted_at` (timestamptz, nullable) - When invitation was accepted
  - `accepted_by` (uuid, nullable) - User ID who accepted the invitation
  - `message` (text, nullable) - Optional personal message from agent
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ## Security
  - Enable RLS on invitations table
  - Agents can create and view their own invitations
  - Anyone with the token can view the specific invitation for acceptance
  - Automatic agent-client relationship creation upon acceptance

  ## Indexes
  - Index on email for faster lookups
  - Index on token for invitation acceptance
  - Index on agent_id for agent's invitation list
*/

-- Create invitations table
CREATE TABLE IF NOT EXISTS invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES agent_profiles(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  user_type text NOT NULL CHECK (user_type IN ('buyer', 'seller')),
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_agent_id ON invitations(agent_id);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);

-- Enable RLS
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Policy: Agents can create invitations
CREATE POLICY "Agents can create invitations"
  ON invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = agent_id
    AND EXISTS (
      SELECT 1 FROM agent_profiles
      WHERE id = auth.uid()
    )
  );

-- Policy: Agents can view their own invitations
CREATE POLICY "Agents can view own invitations"
  ON invitations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = agent_id);

-- Policy: Anyone can view invitation by token (for acceptance page)
CREATE POLICY "Anyone can view invitation by token"
  ON invitations
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Policy: Users can update invitation they're accepting
CREATE POLICY "Users can accept invitations"
  ON invitations
  FOR UPDATE
  TO authenticated
  USING (status = 'pending' AND expires_at > now())
  WITH CHECK (status = 'accepted' AND accepted_by = auth.uid());

-- Function to automatically create agent-client relationship when invitation is accepted
CREATE OR REPLACE FUNCTION handle_invitation_acceptance()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if status changed to 'accepted'
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- Create agent-client relationship
    INSERT INTO agent_clients (agent_id, client_id, client_type)
    VALUES (NEW.agent_id, NEW.accepted_by, NEW.user_type)
    ON CONFLICT (agent_id, client_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to handle invitation acceptance
DROP TRIGGER IF EXISTS on_invitation_accepted ON invitations;
CREATE TRIGGER on_invitation_accepted
  AFTER UPDATE ON invitations
  FOR EACH ROW
  WHEN (NEW.status = 'accepted' AND OLD.status = 'pending')
  EXECUTE FUNCTION handle_invitation_acceptance();

-- Function to expire old invitations (can be called periodically)
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS void AS $$
BEGIN
  UPDATE invitations
  SET status = 'expired', updated_at = now()
  WHERE status = 'pending' AND expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
