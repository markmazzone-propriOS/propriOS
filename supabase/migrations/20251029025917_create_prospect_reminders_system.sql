/*
  # Create Prospect Reminders System

  1. New Tables
    - `prospect_reminders`
      - `id` (uuid, primary key)
      - `prospect_id` (uuid, references prospects) - The prospect to follow up with
      - `agent_id` (uuid, references profiles) - The agent who set the reminder
      - `reminder_date` (timestamptz) - When to send the reminder
      - `reminder_type` (text) - Type: follow_up, call, email, meeting
      - `notes` (text) - Optional notes about what to discuss
      - `completed` (boolean) - Whether the reminder has been completed
      - `completed_at` (timestamptz) - When marked as completed
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `prospect_reminders` table
    - Agents can view, create, update, and delete their own reminders

  3. Automation
    - Create activity feed entries when reminders are due
    - Track completed reminders
*/

-- Create prospect_reminders table
CREATE TABLE IF NOT EXISTS prospect_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reminder_date timestamptz NOT NULL,
  reminder_type text NOT NULL DEFAULT 'follow_up',
  notes text,
  completed boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_reminder_type CHECK (reminder_type IN ('follow_up', 'call', 'email', 'meeting'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_prospect_reminders_agent ON prospect_reminders(agent_id, reminder_date);
CREATE INDEX IF NOT EXISTS idx_prospect_reminders_prospect ON prospect_reminders(prospect_id);
CREATE INDEX IF NOT EXISTS idx_prospect_reminders_date ON prospect_reminders(reminder_date) WHERE completed = false;

-- Enable RLS
ALTER TABLE prospect_reminders ENABLE ROW LEVEL SECURITY;

-- Agents can view their own reminders
CREATE POLICY "Agents can view own prospect reminders"
  ON prospect_reminders FOR SELECT
  TO authenticated
  USING (agent_id = auth.uid());

-- Agents can create reminders for their prospects
CREATE POLICY "Agents can create prospect reminders"
  ON prospect_reminders FOR INSERT
  TO authenticated
  WITH CHECK (
    agent_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM prospects
      WHERE prospects.id = prospect_id
      AND prospects.agent_id = auth.uid()
    )
  );

-- Agents can update their own reminders
CREATE POLICY "Agents can update own prospect reminders"
  ON prospect_reminders FOR UPDATE
  TO authenticated
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

-- Agents can delete their own reminders
CREATE POLICY "Agents can delete own prospect reminders"
  ON prospect_reminders FOR DELETE
  TO authenticated
  USING (agent_id = auth.uid());

-- Function to mark reminder as completed
CREATE OR REPLACE FUNCTION complete_prospect_reminder(p_reminder_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE prospect_reminders
  SET completed = true,
      completed_at = now()
  WHERE id = p_reminder_id
    AND agent_id = auth.uid()
    AND completed = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create activity feed entry when reminder is created
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
    'Reminder set to ' || NEW.reminder_type || ' ' || v_prospect_name || ' on ' || to_char(NEW.reminder_date, 'Mon DD, YYYY at HH:MI AM'),
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

CREATE TRIGGER on_prospect_reminder_created
  AFTER INSERT ON prospect_reminders
  FOR EACH ROW
  EXECUTE FUNCTION notify_prospect_reminder_created();

-- Function to create activity feed entry when reminder is due (to be called by cron or app)
CREATE OR REPLACE FUNCTION check_due_prospect_reminders()
RETURNS void AS $$
DECLARE
  v_reminder record;
  v_prospect_name text;
BEGIN
  FOR v_reminder IN 
    SELECT * FROM prospect_reminders
    WHERE completed = false
      AND reminder_date <= now()
      AND reminder_date > now() - interval '1 hour'
  LOOP
    SELECT full_name INTO v_prospect_name FROM prospects WHERE id = v_reminder.prospect_id;
    
    PERFORM create_activity(
      v_reminder.agent_id,
      NULL,
      'prospect_reminder_due',
      'Reminder: Contact ' || v_prospect_name,
      'Time to ' || v_reminder.reminder_type || ' ' || v_prospect_name || 
        CASE WHEN v_reminder.notes IS NOT NULL THEN '. Notes: ' || v_reminder.notes ELSE '' END,
      v_reminder.prospect_id,
      'prospect',
      jsonb_build_object(
        'reminder_id', v_reminder.id,
        'reminder_type', v_reminder.reminder_type,
        'prospect_name', v_prospect_name,
        'notes', v_reminder.notes
      )
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
