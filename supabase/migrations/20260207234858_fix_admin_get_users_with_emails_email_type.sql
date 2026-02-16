/*
  # Fix admin_get_users_with_emails function email type

  ## Changes
  - Cast the email column to text to match the function's return type
  
  ## Details
  The auth.users.email column is varchar(255), but the function expects text.
  We cast it to text to avoid type mismatch errors.
*/

-- Drop and recreate the function with proper type casting
DROP FUNCTION IF EXISTS admin_get_users_with_emails();

CREATE OR REPLACE FUNCTION admin_get_users_with_emails()
RETURNS TABLE (
  id uuid,
  full_name text,
  phone_number text,
  user_type text,
  profile_photo_url text,
  is_suspended boolean,
  suspended_at timestamptz,
  suspension_reason text,
  created_at timestamptz,
  updated_at timestamptz,
  email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    p.phone_number,
    p.user_type,
    p.profile_photo_url,
    p.is_suspended,
    p.suspended_at,
    p.suspension_reason,
    p.created_at,
    p.updated_at,
    au.email::text
  FROM public.profiles p
  LEFT JOIN auth.users au ON au.id = p.id
  ORDER BY p.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION admin_get_users_with_emails() TO authenticated;
