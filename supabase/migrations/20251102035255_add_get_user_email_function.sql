/*
  # Add function to get user email

  ## Overview
  Creates a secure function to retrieve user email addresses from auth.users
  for display purposes in the application.

  ## New Functions
  1. `get_user_email(user_id uuid)` - Returns the email address for a given user ID
     - Uses SECURITY DEFINER to access auth.users
     - Returns only email, no other sensitive data
     - Can be called by authenticated users

  ## Security
  - Function is SECURITY DEFINER to access auth schema
  - Only returns email address, no password hashes or sensitive data
  - Accessible to authenticated users only
*/

-- Function to get user email from auth.users
CREATE OR REPLACE FUNCTION get_user_email(user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  user_email text;
BEGIN
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = user_id;
  
  RETURN user_email;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_email(uuid) TO authenticated;
