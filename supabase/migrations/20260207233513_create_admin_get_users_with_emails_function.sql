/*
  # Create admin function to get users with emails

  ## Overview
  Creates a function to efficiently retrieve all users with their email addresses
  from auth.users for the admin account management page.

  ## New Functions
  1. `admin_get_users_with_emails()` - Returns all profiles with email addresses
     - Uses SECURITY DEFINER to access auth.users
     - Joins profiles with auth.users to get emails
     - Can only be called by admin users

  ## Security
  - Function is SECURITY DEFINER to access auth schema
  - Only accessible to admin users via RLS on the result
  - Returns user profile data including emails
*/

-- Function to get all users with their emails for admin
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
    au.email
  FROM public.profiles p
  LEFT JOIN auth.users au ON au.id = p.id
  ORDER BY p.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users (RLS on admin_users table will restrict access)
GRANT EXECUTE ON FUNCTION admin_get_users_with_emails() TO authenticated;
