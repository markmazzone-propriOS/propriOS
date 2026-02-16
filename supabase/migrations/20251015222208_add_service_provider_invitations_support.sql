/*
  # Add Service Provider Invitations Support

  ## Overview
  Extends the invitations system to allow service providers to send invitations.

  ## Changes
  1. Add service_provider_id column to invitations table
  2. Update RLS policies to allow service providers to manage invitations
  3. Ensure backward compatibility with agent invitations

  ## Notes
  - Invitations can be sent by either agents or service providers
  - RLS policies check both agent_id and service_provider_id fields
  - Service providers can invite other service providers to join the platform
*/

-- Add service_provider_id column to invitations table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invitations' AND column_name = 'service_provider_id'
  ) THEN
    ALTER TABLE invitations ADD COLUMN service_provider_id uuid REFERENCES service_provider_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Drop existing restrictive policies for agents
DROP POLICY IF EXISTS "Agents can view own invitations" ON invitations;
DROP POLICY IF EXISTS "Agents can create invitations" ON invitations;
DROP POLICY IF EXISTS "Agents can cancel own invitations" ON invitations;
DROP POLICY IF EXISTS "Agents can delete cancelled or accepted invitations" ON invitations;

-- Create new policies that support both agents and service providers

-- View own invitations
CREATE POLICY "Users can view own invitations"
  ON invitations FOR SELECT
  TO authenticated
  USING (
    auth.uid() = agent_id OR 
    auth.uid() = service_provider_id
  );

-- Create invitations
CREATE POLICY "Users can create invitations"
  ON invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      auth.uid() = agent_id AND 
      EXISTS (SELECT 1 FROM agent_profiles WHERE id = auth.uid())
    ) OR
    (
      auth.uid() = service_provider_id AND 
      EXISTS (SELECT 1 FROM service_provider_profiles WHERE id = auth.uid())
    )
  );

-- Cancel own invitations
CREATE POLICY "Users can cancel own invitations"
  ON invitations FOR UPDATE
  TO authenticated
  USING (
    (auth.uid() = agent_id OR auth.uid() = service_provider_id) AND 
    status = 'pending'
  )
  WITH CHECK (
    (auth.uid() = agent_id OR auth.uid() = service_provider_id) AND 
    status IN ('pending', 'cancelled')
  );

-- Delete cancelled or accepted invitations
CREATE POLICY "Users can delete cancelled or accepted invitations"
  ON invitations FOR DELETE
  TO authenticated
  USING (
    (auth.uid() = agent_id OR auth.uid() = service_provider_id) AND 
    status IN ('cancelled', 'accepted')
  );