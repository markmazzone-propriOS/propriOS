/*
  # Remove Mortgage Lender from Invitations

  1. Changes
    - Update invitations table user_type constraint to exclude 'mortgage_lender'
    - Only allow: buyer, seller, renter, agent, service_provider, property_owner

  2. Security
    - Maintains existing RLS policies
    - Only updates the check constraint on user_type field
*/

-- Update invitations table to remove mortgage_lender from allowed user types
DO $$
BEGIN
  -- Drop existing check constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'invitations' 
    AND constraint_name = 'invitations_user_type_check'
  ) THEN
    ALTER TABLE invitations DROP CONSTRAINT invitations_user_type_check;
  END IF;

  -- Add new check constraint without mortgage_lender
  ALTER TABLE invitations ADD CONSTRAINT invitations_user_type_check 
    CHECK (user_type IN ('buyer', 'seller', 'renter', 'agent', 'service_provider', 'property_owner'));
END $$;