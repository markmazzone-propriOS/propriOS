/*
  # Add Mortgage Lender to Invitations Check Constraint

  ## Overview
  Updates the invitations table check constraint to allow mortgage lenders to send invitations.

  ## Changes
  1. Drop existing check constraint
  2. Recreate constraint to include mortgage_lender_id as valid sender type

  ## Security
  - RLS policies remain unchanged
  - Ensures exactly one sender type is present per invitation
*/

-- Drop existing check constraint
ALTER TABLE invitations DROP CONSTRAINT IF EXISTS invitations_sender_check;

-- Recreate constraint to include mortgage_lender_id
ALTER TABLE invitations ADD CONSTRAINT invitations_sender_check CHECK (
  (agent_id IS NOT NULL AND service_provider_id IS NULL AND property_owner_id IS NULL AND mortgage_lender_id IS NULL) OR
  (agent_id IS NULL AND service_provider_id IS NOT NULL AND property_owner_id IS NULL AND mortgage_lender_id IS NULL) OR
  (agent_id IS NULL AND service_provider_id IS NULL AND property_owner_id IS NOT NULL AND mortgage_lender_id IS NULL) OR
  (agent_id IS NULL AND service_provider_id IS NULL AND property_owner_id IS NULL AND mortgage_lender_id IS NOT NULL)
);
