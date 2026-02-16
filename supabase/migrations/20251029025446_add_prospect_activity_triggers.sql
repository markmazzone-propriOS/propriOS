/*
  # Add Activity Feed Triggers for Prospects

  1. Changes
    - Add trigger for prospect creation (notify agent)
    - Add trigger for prospect status updates (notify agent)
    - Add trigger for prospect deletion (notify agent)
    - Add trigger for invitation sent from prospect (notify agent)

  2. Activity Types
    - prospect_created: When a new prospect/lead is created
    - prospect_status_updated: When prospect status changes
    - prospect_deleted: When a prospect is removed
    - prospect_invitation_sent: When invitation is sent to a prospect

  3. Security
    - All triggers use SECURITY DEFINER to ensure they can create activities
    - Activity feed policies already handle read access
*/

-- Trigger for new prospect creation (notify agent)
CREATE OR REPLACE FUNCTION notify_prospect_created() RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_activity(
    NEW.agent_id,
    NULL,
    'prospect_created',
    'New Prospect',
    'New lead from ' || NEW.full_name || ' via ' || NEW.source,
    NEW.id,
    'prospect',
    jsonb_build_object(
      'prospect_name', NEW.full_name,
      'email', NEW.email,
      'source', NEW.source
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_prospect_created
  AFTER INSERT ON prospects
  FOR EACH ROW
  EXECUTE FUNCTION notify_prospect_created();

-- Trigger for prospect status updates (notify agent)
CREATE OR REPLACE FUNCTION notify_prospect_status_updated() RETURNS TRIGGER AS $$
DECLARE
  v_title text;
  v_description text;
BEGIN
  IF OLD.status != NEW.status THEN
    v_title := 'Prospect Status Updated';
    v_description := NEW.full_name || '''s status changed from ' || OLD.status || ' to ' || NEW.status;
    
    PERFORM create_activity(
      NEW.agent_id,
      NEW.agent_id,
      'prospect_status_updated',
      v_title,
      v_description,
      NEW.id,
      'prospect',
      jsonb_build_object(
        'prospect_name', NEW.full_name,
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_prospect_status_updated
  AFTER UPDATE ON prospects
  FOR EACH ROW
  EXECUTE FUNCTION notify_prospect_status_updated();

-- Trigger for prospect deletion (notify agent)
CREATE OR REPLACE FUNCTION notify_prospect_deleted() RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_activity(
    OLD.agent_id,
    OLD.agent_id,
    'prospect_deleted',
    'Prospect Removed',
    'Prospect ' || OLD.full_name || ' was removed from your leads',
    OLD.id,
    'prospect',
    jsonb_build_object(
      'prospect_name', OLD.full_name,
      'email', OLD.email
    )
  );
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_prospect_deleted
  BEFORE DELETE ON prospects
  FOR EACH ROW
  EXECUTE FUNCTION notify_prospect_deleted();

-- Trigger for invitation sent to prospect (notify agent when invitation relates to prospect)
CREATE OR REPLACE FUNCTION notify_prospect_invitation_sent() RETURNS TRIGGER AS $$
DECLARE
  v_prospect_id uuid;
BEGIN
  -- Check if this invitation email matches any prospect
  SELECT id INTO v_prospect_id
  FROM prospects
  WHERE email = NEW.invitee_email
    AND agent_id = NEW.sender_id
  LIMIT 1;
  
  IF v_prospect_id IS NOT NULL THEN
    PERFORM create_activity(
      NEW.sender_id,
      NEW.sender_id,
      'prospect_invitation_sent',
      'Invitation Sent',
      'Invitation sent to ' || NEW.invitee_name || ' (' || NEW.invitee_type || ')',
      v_prospect_id,
      'prospect',
      jsonb_build_object(
        'invitee_name', NEW.invitee_name,
        'invitee_type', NEW.invitee_type,
        'invitee_email', NEW.invitee_email
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_prospect_invitation_sent
  AFTER INSERT ON invitations
  FOR EACH ROW
  EXECUTE FUNCTION notify_prospect_invitation_sent();
