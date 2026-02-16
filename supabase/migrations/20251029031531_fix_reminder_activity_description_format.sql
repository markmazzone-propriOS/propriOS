/*
  # Fix Reminder Activity Description Format

  1. Changes
    - Update the reminder notification to show a simpler description
    - Store the formatted date in metadata for frontend to display
    - The frontend will format dates in the user's local timezone

  2. Notes
    - Activity feed will show simpler text
    - The full reminder details are available in metadata
*/

-- Update function to create activity feed entry when reminder is created
CREATE OR REPLACE FUNCTION notify_prospect_reminder_created() RETURNS TRIGGER AS $$
DECLARE
  v_prospect_name text;
BEGIN
  SELECT full_name INTO v_prospect_name FROM prospects WHERE id = NEW.prospect_id;
  
  PERFORM create_activity(
    NEW.agent_id,
    NEW.agent_id,
    'prospect_reminder_set',
    'Reminder Set',
    'Reminder set to ' || NEW.reminder_type || ' ' || v_prospect_name,
    NEW.prospect_id,
    'prospect',
    jsonb_build_object(
      'reminder_type', NEW.reminder_type,
      'reminder_date', NEW.reminder_date,
      'prospect_name', v_prospect_name
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
