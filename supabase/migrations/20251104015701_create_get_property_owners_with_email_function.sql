/*
  # Create function to get property owners with email
  
  1. Changes
    - Add RPC function to fetch property owners with their email addresses
    - Joins profiles with auth.users to get email information
    - Returns id, full_name, email, and phone_number
  
  2. Security
    - Function is security definer to access auth.users
    - Only returns property owner profiles
*/

CREATE OR REPLACE FUNCTION get_property_owners_with_email()
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  phone_number text
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    au.email::text,
    p.phone_number
  FROM profiles p
  JOIN auth.users au ON p.id = au.id
  WHERE p.user_type = 'property_owner'
  ORDER BY p.full_name;
END;
$$;
