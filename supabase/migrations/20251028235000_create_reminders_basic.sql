/*
  # Create Basic Viewing Reminders System

  1. New Tables
    - `viewing_reminders`
      - Stores reminder records for confirmed viewings
      - Tracks when reminders should be sent

  2. Security
    - Enable RLS on `viewing_reminders` table
    - Add policies for agents to view their own reminders

  3. Functions
    - Function to create reminders when viewing is confirmed
    - Trigger to automatically create reminders
*/

-- Create viewing_reminders table if not exists
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_viewing_reminders_unsent
  ON viewing_reminders(sent, reminder_date)
  WHERE sent = false;

CREATE INDEX IF NOT EXISTS idx_viewing_reminders_agent
  ON viewing_reminders(agent_id);

CREATE INDEX IF NOT EXISTS idx_viewing_reminders_event
  ON viewing_reminders(event_id);
