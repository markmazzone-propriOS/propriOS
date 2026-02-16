/*
  # Fix Reminder Notification Timezone

  1. Changes
    - Update the reminder notification to format date/time correctly
    - Use a simpler format that shows the date and time as stored

  2. Notes
    - The reminder_date is stored as timestamptz, so it maintains timezone info
    - We'll format it in a way that's clearer in the activity feed
*/

-- Update function to create activity feed entry when reminder is created
CREATE OR REPLACE FUNCTION notify_prospect_reminder_created() RETURNS TRIGGER AS $$
DECLARE
  v_prospect_name text;
  v_formatted_date text;
BEGIN
  SELECT full_name INTO v_prospect_name FROM prospects WHERE id = NEW.prospect_id;
  
  -- Format the date/time in a clear way
  v_formatted_date := to_char(NEW.reminder_date AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC';
  
  PERFORM create_activity(
    NEW.agent_id,
    NEW.agent_id,
    'prospect_reminder_set',
    'Reminder Set',
    'Reminder set to ' || NEW.reminder_type || ' ' || v_prospect_name || ' on ' || v_formatted_date,
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
