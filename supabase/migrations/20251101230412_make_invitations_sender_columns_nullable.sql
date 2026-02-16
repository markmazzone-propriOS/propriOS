/*
  # Make Invitations Sender Columns Nullable

  ## Overview
  Updates the invitations table to make sender ID columns nullable, since an invitation
  can be sent by either an agent, service provider, or property owner (but not all three).

  ## Changes
  1. Make agent_id column nullable
  2. Add constraint to ensure at least one sender ID is present
  3. Ensure backward compatibility with existing data

  ## Security
  - RLS policies remain unchanged and continue to protect data appropriately
  - Constraint ensures data integrity by requiring exactly one sender type
*/

-- Make agent_id nullable
ALTER TABLE invitations ALTER COLUMN agent_id DROP NOT NULL;

-- Add a check constraint to ensure at least one sender ID is present
ALTER TABLE invitations DROP CONSTRAINT IF EXISTS invitations_sender_check;

ALTER TABLE invitations ADD CONSTRAINT invitations_sender_check CHECK (
  (agent_id IS NOT NULL AND service_provider_id IS NULL AND property_owner_id IS NULL) OR
  (agent_id IS NULL AND service_provider_id IS NOT NULL AND property_owner_id IS NULL) OR
  (agent_id IS NULL AND service_provider_id IS NULL AND property_owner_id IS NOT NULL)
);
