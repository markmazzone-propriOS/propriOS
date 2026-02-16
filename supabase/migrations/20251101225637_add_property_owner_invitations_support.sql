/*
  # Add Property Owner Invitations Support

  ## Overview
  Extends the invitations system to allow property owners to send invitations.

  ## Changes
  1. Add property_owner_id column to invitations table
  2. Update RLS policies to allow property owners to manage invitations
  3. Ensure backward compatibility with agent and service provider invitations

  ## Notes
  - Invitations can be sent by agents, service providers, or property owners
  - RLS policies check agent_id, service_provider_id, and property_owner_id fields
  - Property owners can invite renters and other users to join the platform
*/

-- Add property_owner_id column to invitations table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invitations' AND column_name = 'property_owner_id'
  ) THEN
    ALTER TABLE invitations ADD COLUMN property_owner_id uuid REFERENCES property_owner_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own invitations" ON invitations;
DROP POLICY IF EXISTS "Users can create invitations" ON invitations;
DROP POLICY IF EXISTS "Users can cancel own invitations" ON invitations;
DROP POLICY IF EXISTS "Users can delete cancelled or accepted invitations" ON invitations;

-- Create new policies that support agents, service providers, and property owners

-- View own invitations
CREATE POLICY "Users can view own invitations"
  ON invitations FOR SELECT
  TO authenticated
  USING (
    auth.uid() = agent_id OR 
    auth.uid() = service_provider_id OR
    auth.uid() = property_owner_id
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
    ) OR
    (
      auth.uid() = property_owner_id AND 
      EXISTS (SELECT 1 FROM property_owner_profiles WHERE id = auth.uid())
    )
  );

-- Cancel own invitations
CREATE POLICY "Users can cancel own invitations"
  ON invitations FOR UPDATE
  TO authenticated
  USING (
    (auth.uid() = agent_id OR auth.uid() = service_provider_id OR auth.uid() = property_owner_id) AND 
    status = 'pending'
  )
  WITH CHECK (
    (auth.uid() = agent_id OR auth.uid() = service_provider_id OR auth.uid() = property_owner_id) AND 
    status IN ('pending', 'cancelled')
  );

-- Delete cancelled or accepted invitations
CREATE POLICY "Users can delete cancelled or accepted invitations"
  ON invitations FOR DELETE
  TO authenticated
  USING (
    (auth.uid() = agent_id OR auth.uid() = service_provider_id OR auth.uid() = property_owner_id) AND 
    status IN ('cancelled', 'accepted')
  );
