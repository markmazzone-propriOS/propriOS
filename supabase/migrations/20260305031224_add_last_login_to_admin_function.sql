/*
  # Add last_login_at to admin_get_users_with_emails function

  ## Changes
  - Add last_login_at column to the admin_get_users_with_emails function return type
  
  ## Details
  The function was missing the last_login_at field that was added to profiles.
  This updates the function to include it in the results.
*/

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
  last_login_at timestamptz,
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
    p.last_login_at,
    au.email::text
  FROM public.profiles p
  LEFT JOIN auth.users au ON au.id = p.id
  ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_get_users_with_emails() TO authenticated;
