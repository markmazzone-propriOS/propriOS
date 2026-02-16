/*
  # Add Property Owner to User Type Constraint

  1. Changes
    - Update the profiles table user_type check constraint to include 'property_owner'
    - This allows property owners to be created in the system

  2. Security
    - No security changes, existing RLS policies remain in place
*/

-- Drop the existing constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_user_type_check;

-- Add the updated constraint with property_owner included
ALTER TABLE profiles ADD CONSTRAINT profiles_user_type_check 
  CHECK (user_type IN ('buyer', 'seller', 'renter', 'property_owner', 'agent', 'service_provider', 'mortgage_lender'));
