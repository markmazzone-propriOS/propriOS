/*
  # Fix get_agent_clients_with_email function type mismatch

  ## Overview
  Fixes the type mismatch error by properly casting the email from auth.users
  which is varchar to text.

  ## Changes
  - Drop and recreate function with proper type casting
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS get_agent_clients_with_email(uuid);

-- Recreate function with proper type casting
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
    COALESCE(au.email::text, '') as email,
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
