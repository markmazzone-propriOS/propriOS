/*
  # Add Renter and Service Provider User Types

  ## Overview
  This migration adds two new user types to the profiles table: 'renter' and 'service_provider'

  ## Changes
  - Updates the user_type check constraint to include 'renter' and 'service_provider'
  - Maintains backward compatibility with existing 'buyer', 'seller', and 'agent' types

  ## Important Notes
  - Existing data remains unchanged
  - New users can now sign up as renters or service providers
*/

-- Drop the existing constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_user_type_check;

-- Add the new constraint with all user types
ALTER TABLE profiles ADD CONSTRAINT profiles_user_type_check 
  CHECK (user_type IN ('buyer', 'seller', 'renter', 'agent', 'service_provider'));