/*
  # Fix Invitation Triggers Field Names

  ## Overview
  Updates invitation-related triggers to use correct field names from the invitations table.

  ## Changes
  1. Fix notify_prospect_invitation_sent() to use correct field names
  2. Fix notify_invitation_received() to use correct field names
  3. Handle multiple sender types (agent, service_provider, property_owner)

  ## Notes
  - Invitations table has: agent_id, service_provider_id, property_owner_id, email, invitee_name, user_type
  - Not: sender_id, invitee_email, invitee_type
*/

-- Fix the prospect invitation sent trigger
CREATE OR REPLACE FUNCTION notify_prospect_invitation_sent() RETURNS TRIGGER AS $$
DECLARE
  v_prospect_id uuid;
  v_sender_id uuid;
BEGIN
  -- Determine the sender ID
  v_sender_id := COALESCE(NEW.agent_id, NEW.service_provider_id, NEW.property_owner_id);
  
  -- Only process if sender is an agent (prospects are agent-specific)
  IF NEW.agent_id IS NOT NULL THEN
    -- Check if this invitation email matches any prospect
    SELECT id INTO v_prospect_id
    FROM prospects
    WHERE email = NEW.email
      AND agent_id = NEW.agent_id
    LIMIT 1;
    
    IF v_prospect_id IS NOT NULL THEN
      PERFORM create_activity(
        NEW.agent_id,
        NEW.agent_id,
        'prospect_invitation_sent',
        'Invitation Sent',
        'Invitation sent to ' || COALESCE(NEW.invitee_name, NEW.email) || ' (' || NEW.user_type || ')',
        v_prospect_id,
        'prospect',
        jsonb_build_object(
          'invitee_name', NEW.invitee_name,
          'invitee_type', NEW.user_type,
          'invitee_email', NEW.email
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix the invitation received trigger
CREATE OR REPLACE FUNCTION notify_invitation_received() RETURNS TRIGGER AS $$
DECLARE
  v_sender_name text;
  v_sender_id uuid;
BEGIN
  -- Determine the sender ID
  v_sender_id := COALESCE(NEW.agent_id, NEW.service_provider_id, NEW.property_owner_id);
  
  -- Get sender's name
  SELECT full_name INTO v_sender_name FROM profiles WHERE id = v_sender_id;
  
  -- Only create activity if email matches a user
  IF EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND email = NEW.email) THEN
    PERFORM create_activity(
      auth.uid(),
      v_sender_id,
      'invitation_received',
      'New Invitation',
      v_sender_name || ' invited you to join as their ' || NEW.user_type,
      NEW.id,
      'invitation',
      jsonb_build_object('invitee_type', NEW.user_type)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
