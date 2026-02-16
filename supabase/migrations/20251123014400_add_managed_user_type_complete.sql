/*
  # Add Managed User Type

  1. Changes
    - Add 'managed_user' to the user_type constraint in profiles table
    - This allows managed accounts to be a distinct user type rather than agents

  2. Notes
    - Managed users are regular users authorized to act on behalf of an agent
    - They can create/edit/delete listings for the agent they're assigned to
    - They do NOT have agent-specific features like client management
*/

-- Drop the existing constraint and add new one with managed_user type
DO $$
BEGIN
  -- Drop the old constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'profiles_user_type_check' 
    AND table_name = 'profiles'
  ) THEN
    ALTER TABLE profiles DROP CONSTRAINT profiles_user_type_check;
  END IF;

  -- Add new constraint with managed_user included
  ALTER TABLE profiles ADD CONSTRAINT profiles_user_type_check 
    CHECK (user_type IN ('buyer', 'seller', 'agent', 'renter', 'service_provider', 'property_owner', 'mortgage_lender', 'managed_user'));
END $$;

-- Update the existing managed user from agent to managed_user type
UPDATE profiles 
SET user_type = 'managed_user' 
WHERE managed_by_agent_id IS NOT NULL AND user_type = 'agent';
