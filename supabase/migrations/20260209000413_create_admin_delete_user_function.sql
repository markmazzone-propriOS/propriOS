/*
  # Create Admin Delete User Function

  1. Purpose
    - Allow admins to delete users completely from the system
    - Deletes from auth.users which cascades to profiles and all related data

  2. Security
    - SECURITY DEFINER to allow access to auth schema
    - Function checks that caller is an admin before proceeding
    - Prevents admins from deleting other admins
*/

-- Create function to allow admins to delete users
CREATE OR REPLACE FUNCTION admin_delete_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  calling_admin_id uuid;
  is_target_admin boolean;
BEGIN
  -- Get the ID of the admin making the request
  calling_admin_id := auth.uid();
  
  IF calling_admin_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify the caller is an admin
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users WHERE id = calling_admin_id
  ) THEN
    RAISE EXCEPTION 'Not authorized - admin access required';
  END IF;

  -- Check if target user is an admin
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users WHERE id = target_user_id
  ) INTO is_target_admin;

  -- Prevent deletion of admin accounts
  IF is_target_admin THEN
    RAISE EXCEPTION 'Cannot delete admin accounts';
  END IF;

  -- Delete from auth.users (this will cascade to profiles and all related tables)
  DELETE FROM auth.users WHERE id = target_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$$;

-- Grant execute permission to authenticated users (function will check admin status internally)
GRANT EXECUTE ON FUNCTION admin_delete_user(uuid) TO authenticated;
