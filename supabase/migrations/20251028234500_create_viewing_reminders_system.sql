/*
  # Create Viewing Reminders System

  1. New Tables
    - `viewing_reminders`
      - `id` (uuid, primary key)
      - `event_id` (uuid, foreign key to calendar_events)
      - `agent_id` (uuid, foreign key to auth.users)
      - `reminder_days` (int4) - Days before viewing (1, 7, 14, 30)
      - `reminder_date` (timestamptz) - When to send the reminder
      - `sent` (boolean) - Whether reminder has been sent
      - `sent_at` (timestamptz) - When the reminder was sent
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `viewing_reminders` table
    - Add policies for agents to view their own reminders

  3. Functions
    - Function to create reminders when viewing is scheduled
    - Function to check and send due reminders
    - Trigger to automatically create reminders on viewing confirmation

  4. Automation
    - Trigger on calendar_events to create reminders
*/

-- Create viewing_reminders table
CREATE TABLE IF NOT EXISTS viewing_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES calendar_events(id) ON DELETE CASCADE NOT NULL,
  agent_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reminder_days int4 NOT NULL CHECK (reminder_days IN (1, 7, 14, 30)),
  reminder_date timestamptz NOT NULL,
  sent boolean DEFAULT false NOT NULL,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(event_id, reminder_days)
);

ALTER TABLE viewing_reminders ENABLE ROW LEVEL SECURITY;

-- Policies for viewing_reminders
CREATE POLICY "Agents can view own reminders"
  ON viewing_reminders FOR SELECT
  TO authenticated
  USING (agent_id = auth.uid());

CREATE POLICY "System can insert reminders"
  ON viewing_reminders FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "System can update reminders"
  ON viewing_reminders FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Function to create reminders for a viewing
CREATE OR REPLACE FUNCTION create_viewing_reminders()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  viewing_start timestamptz;
  agent_user_id uuid;
  reminder_days_array int[] := ARRAY[1, 7, 14, 30];
  days int;
BEGIN
  -- Only create reminders for confirmed viewings with future dates
  IF NEW.status = 'confirmed' AND NEW.event_type = 'viewing' THEN
    viewing_start := NEW.start_time;

    -- Get the agent_id from the property
    SELECT agent_id INTO agent_user_id
    FROM properties
    WHERE id = NEW.property_id;

    -- If no agent found, skip reminder creation
    IF agent_user_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- Create reminders for each interval if the viewing is far enough in the future
    FOREACH days IN ARRAY reminder_days_array
    LOOP
      IF viewing_start > (now() + (days || ' days')::interval) THEN
        INSERT INTO viewing_reminders (
          event_id,
          agent_id,
          reminder_days,
          reminder_date
        )
        VALUES (
          NEW.id,
          agent_user_id,
          days,
          viewing_start - (days || ' days')::interval
        )
        ON CONFLICT (event_id, reminder_days) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger to create reminders when viewing is confirmed
DROP TRIGGER IF EXISTS create_viewing_reminders_trigger ON calendar_events;
CREATE TRIGGER create_viewing_reminders_trigger
  AFTER INSERT OR UPDATE OF status ON calendar_events
  FOR EACH ROW
  WHEN (NEW.status = 'confirmed' AND NEW.event_type = 'viewing')
  EXECUTE FUNCTION create_viewing_reminders();

-- Function to process and send due reminders
CREATE OR REPLACE FUNCTION process_viewing_reminders()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  reminder_record RECORD;
  property_address text;
  viewing_time text;
  agent_data RECORD;
  visitor_data RECORD;
  payload jsonb;
BEGIN
  -- Find all unsent reminders that are due
  FOR reminder_record IN
    SELECT vr.*, ce.start_time, ce.property_id, ce.requestor_name, ce.requestor_email, ce.requestor_phone
    FROM viewing_reminders vr
    JOIN calendar_events ce ON vr.event_id = ce.id
    WHERE vr.sent = false
      AND vr.reminder_date <= now()
      AND ce.status = 'confirmed'
      AND ce.start_time > now()
    ORDER BY vr.reminder_date ASC
    LIMIT 100
  LOOP
    BEGIN
      -- Get property address
      SELECT address_line1 || ', ' || city || ', ' || state
      INTO property_address
      FROM properties
      WHERE id = reminder_record.property_id;

      -- Get agent details
      SELECT p.full_name, p.phone_number, p.email
      INTO agent_data
      FROM profiles p
      WHERE p.id = reminder_record.agent_id;

      -- Format viewing time
      viewing_time := to_char(reminder_record.start_time, 'FMDay, Month DD, YYYY at HH12:MI AM');

      -- Create notification in activity_feed
      INSERT INTO activity_feed (
        user_id,
        activity_type,
        title,
        description,
        related_id,
        metadata
      )
      VALUES (
        reminder_record.agent_id,
        'viewing_reminder',
        'Upcoming Viewing Reminder',
        'You have a property viewing with ' || COALESCE(reminder_record.requestor_name, 'a client') ||
        ' in ' || reminder_record.reminder_days || ' day' ||
        (CASE WHEN reminder_record.reminder_days > 1 THEN 's' ELSE '' END) ||
        ' at ' || COALESCE(property_address, 'a property'),
        reminder_record.event_id,
        jsonb_build_object(
          'property_address', property_address,
          'viewing_time', viewing_time,
          'reminder_days', reminder_record.reminder_days,
          'visitor_name', reminder_record.requestor_name,
          'visitor_email', reminder_record.requestor_email
        )
      );

      -- Call edge function to send email
      IF reminder_record.requestor_email IS NOT NULL THEN
        SELECT net.http_post(
          url := current_setting('app.supabase_url') || '/functions/v1/send-viewing-reminder',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
          ),
          body := jsonb_build_object(
            'agentEmail', agent_data.email,
            'agentName', COALESCE(agent_data.full_name, 'Your Agent'),
            'agentPhone', agent_data.phone_number,
            'visitorEmail', reminder_record.requestor_email,
            'visitorName', COALESCE(reminder_record.requestor_name, 'Valued Client'),
            'propertyAddress', COALESCE(property_address, 'Property'),
            'viewingTime', viewing_time,
            'reminderDays', reminder_record.reminder_days
          )
        ) INTO payload;
      END IF;

      -- Mark reminder as sent
      UPDATE viewing_reminders
      SET sent = true, sent_at = now()
      WHERE id = reminder_record.id;

    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue processing other reminders
      RAISE WARNING 'Error processing reminder %: %', reminder_record.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_viewing_reminders_unsent
  ON viewing_reminders(sent, reminder_date)
  WHERE sent = false;

CREATE INDEX IF NOT EXISTS idx_viewing_reminders_agent
  ON viewing_reminders(agent_id);

CREATE INDEX IF NOT EXISTS idx_viewing_reminders_event
  ON viewing_reminders(event_id);
