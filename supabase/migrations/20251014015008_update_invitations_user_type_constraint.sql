/*
  # Update invitations user_type constraint

  ## Changes
  - Drop the old user_type check constraint that only allowed 'buyer' and 'seller'
  - Add a new constraint that includes 'buyer', 'seller', 'agent', and 'service_provider'

  ## Reason
  This allows agents to send invitations to service providers and other agents
*/

-- Drop the old constraint
ALTER TABLE invitations DROP CONSTRAINT IF EXISTS invitations_user_type_check;

-- Add the new constraint with all user types
ALTER TABLE invitations ADD CONSTRAINT invitations_user_type_check 
  CHECK (user_type IN ('buyer', 'seller', 'agent', 'service_provider'));