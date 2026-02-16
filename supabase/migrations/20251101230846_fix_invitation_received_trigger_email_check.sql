/*
  # Fix Invitation Received Trigger Email Check

  ## Overview
  Fixes the notify_invitation_received() trigger to properly check if the invitation
  email matches an existing user. The profiles table doesn't have an email column,
  so we need to check auth.users instead.

  ## Changes
  1. Update notify_invitation_received() to check auth.users for email match
  2. Ensure trigger works correctly for all sender types

  ## Notes
  - Email is stored in auth.users, not profiles
  - Profiles are linked to auth.users via the id column
*/

-- Fix the invitation received trigger to check auth.users for email
CREATE OR REPLACE FUNCTION notify_invitation_received() RETURNS TRIGGER AS $$
DECLARE
  v_sender_name text;
  v_sender_id uuid;
  v_user_id uuid;
BEGIN
  -- Determine the sender ID
  v_sender_id := COALESCE(NEW.agent_id, NEW.service_provider_id, NEW.property_owner_id);
  
  -- Get sender's name
  SELECT full_name INTO v_sender_name FROM profiles WHERE id = v_sender_id;
  
  -- Check if the invitation email matches an existing user in auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = NEW.email
  LIMIT 1;
  
  -- Only create activity if user exists and is the current authenticated user
  IF v_user_id IS NOT NULL AND v_user_id = auth.uid() THEN
    PERFORM create_activity(
      auth.uid(),
      v_sender_id,
      'invitation_received',
      'New Invitation',
      COALESCE(v_sender_name, 'Someone') || ' invited you to join as their ' || NEW.user_type,
      NEW.id,
      'invitation',
      jsonb_build_object('invitee_type', NEW.user_type)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
