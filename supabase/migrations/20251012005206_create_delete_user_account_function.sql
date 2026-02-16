/*
  # Create User Account Deletion Function

  ## Overview
  This migration creates a secure function for users to delete their own accounts
  and all associated data.

  ## New Functions
  
  ### `delete_user_account()`
  Allows authenticated users to permanently delete their own account and all associated data:
  - Deletes from profiles table (cascades to related tables via foreign keys)
  - Deletes agent_profiles if user is an agent (cascades to properties, invitations, etc.)
  - Deletes from auth.users table
  
  ## Security
  - Function uses SECURITY DEFINER to allow deletion from auth.users
  - Only the authenticated user can delete their own account
  - All related data is automatically cleaned up via CASCADE constraints

  ## Data Deletion
  The following data will be deleted (via CASCADE or direct deletion):
  - User profile
  - Agent profile (if applicable)
  - Property listings (if agent)
  - Property favorites
  - Property views
  - Property rejections
  - Conversation participants
  - Messages
  - Documents and document shares
  - Invitations (sent and received)
  - Agent-client relationships
*/

-- Function to delete user account and all associated data
CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS void AS $$
DECLARE
  user_id uuid;
BEGIN
  -- Get the current user's ID
  user_id := auth.uid();
  
  IF user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Delete agent profile if exists (this will cascade to properties, invitations, etc.)
  DELETE FROM agent_profiles WHERE id = user_id;

  -- Delete profile (this will cascade to most related tables)
  DELETE FROM profiles WHERE id = user_id;

  -- Delete from auth.users (this requires SECURITY DEFINER)
  DELETE FROM auth.users WHERE id = user_id;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
