/*
  # Add function to get agent clients with email

  ## Overview
  Creates a helper function that returns agent clients (buyers/sellers) with their email addresses
  by joining profiles with auth.users. This is needed because email is stored in auth.users, not profiles.

  ## Changes
  - Create get_agent_clients_with_email function
  - Returns profile data with email from auth.users
*/

-- Function to get agent clients with email addresses
CREATE OR REPLACE FUNCTION get_agent_clients_with_email(p_agent_id uuid)
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  user_type text,
  phone_number text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    COALESCE(au.email, '') as email,
    p.user_type,
    p.phone_number
  FROM profiles p
  LEFT JOIN auth.users au ON au.id = p.id
  WHERE (p.assigned_agent_id = p_agent_id OR p.managed_by_agent_id = p_agent_id)
    AND p.user_type IN ('buyer', 'seller')
  ORDER BY p.full_name;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_agent_clients_with_email(uuid) TO authenticated;
