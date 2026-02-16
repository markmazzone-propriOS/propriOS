/*
  # Fix Admin Delete User Activity Feed Issue

  ## Overview
  This migration fixes the issue where deleting a user causes errors due to triggers
  trying to create activity_feed entries during the cascade deletion process.

  ## Problem
  When a user is deleted, cascading deletions trigger functions that try to insert
  new activity_feed entries for users that are in the process of being deleted,
  causing foreign key constraint violations.

  ## Solution
  Update the admin_delete_user function to:
  1. First delete all activity_feed entries for the user
  2. Disable activity feed triggers during deletion
  3. Delete the user (cascades to all related tables)
  4. Re-enable activity feed triggers

  ## Changes
  - Replace admin_delete_user function with improved version
  - Add trigger management to prevent activity_feed inserts during deletion
*/

CREATE OR REPLACE FUNCTION admin_delete_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  calling_admin_id uuid;
  is_target_admin boolean;
  trigger_record record;
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

  -- Step 1: Delete all activity_feed entries for this user first
  -- This prevents cascade issues and foreign key violations
  DELETE FROM activity_feed WHERE user_id = target_user_id;
  DELETE FROM activity_feed WHERE actor_id = target_user_id;

  -- Step 2: Temporarily disable triggers that create activity_feed entries
  -- Store original trigger states so we can restore them
  CREATE TEMP TABLE IF NOT EXISTS disabled_triggers (
    trigger_name text,
    table_name text
  ) ON COMMIT DROP;

  -- Disable all triggers on tables that might create activity_feed entries
  FOR trigger_record IN 
    SELECT 
      t.tgname as trigger_name,
      c.relname as table_name
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
    AND t.tgname LIKE '%activity%'
    AND t.tgenabled = 'O'  -- Only enabled triggers
  LOOP
    EXECUTE format('ALTER TABLE %I DISABLE TRIGGER %I', 
      trigger_record.table_name, 
      trigger_record.trigger_name
    );
    
    INSERT INTO disabled_triggers VALUES (
      trigger_record.trigger_name,
      trigger_record.table_name
    );
  END LOOP;

  -- Step 3: Delete from auth.users (this will cascade to profiles and all related tables)
  DELETE FROM auth.users WHERE id = target_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Step 4: Re-enable all triggers that were disabled
  FOR trigger_record IN 
    SELECT trigger_name, table_name FROM disabled_triggers
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE TRIGGER %I', 
      trigger_record.table_name, 
      trigger_record.trigger_name
    );
  END LOOP;

  -- Clean up temp table (will happen automatically on commit, but explicit is good)
  DROP TABLE IF EXISTS disabled_triggers;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Re-enable triggers even if there's an error
    FOR trigger_record IN 
      SELECT trigger_name, table_name FROM disabled_triggers
    LOOP
      EXECUTE format('ALTER TABLE %I ENABLE TRIGGER %I', 
        trigger_record.table_name, 
        trigger_record.trigger_name
      );
    END LOOP;
    
    DROP TABLE IF EXISTS disabled_triggers;
    RAISE;
END;
$$;

-- Grant execute permission to authenticated users (function will check admin status internally)
GRANT EXECUTE ON FUNCTION admin_delete_user(uuid) TO authenticated;