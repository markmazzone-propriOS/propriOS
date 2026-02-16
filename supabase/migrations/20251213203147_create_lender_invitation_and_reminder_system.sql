/*
  # Create Lender Lead Invitation and Reminder System

  1. Changes to Existing Tables
    - Add `mortgage_lender_id` to `invitations` table to support lender invitations
    - Update user_type constraint to include mortgage_lender

  2. New Tables
    - `lender_lead_reminders`
      - `id` (uuid, primary key)
      - `lead_id` (uuid, references lender_leads) - The lead to follow up with
      - `lender_id` (uuid, references mortgage_lender_profiles) - The lender who set the reminder
      - `reminder_date` (timestamptz) - When to send the reminder
      - `reminder_type` (text) - Type: follow_up, call, email, meeting
      - `notes` (text) - Optional notes about what to discuss
      - `completed` (boolean) - Whether the reminder has been completed
      - `completed_at` (timestamptz) - When marked as completed
      - `created_at` (timestamptz)

  3. Security
    - Enable RLS on `lender_lead_reminders` table
    - Lenders can view, create, update, and delete their own reminders
    - Add policies for lenders to send invitations

  4. Automation
    - Create activity feed entries when reminders are due
    - Track completed reminders
*/

-- Add mortgage_lender_id column to invitations if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invitations' AND column_name = 'mortgage_lender_id'
  ) THEN
    ALTER TABLE invitations ADD COLUMN mortgage_lender_id uuid REFERENCES mortgage_lender_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create lender_lead_reminders table
CREATE TABLE IF NOT EXISTS lender_lead_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES lender_leads(id) ON DELETE CASCADE,
  lender_id uuid NOT NULL REFERENCES mortgage_lender_profiles(id) ON DELETE CASCADE,
  reminder_date timestamptz NOT NULL,
  reminder_type text NOT NULL DEFAULT 'follow_up',
  notes text,
  completed boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_reminder_type CHECK (reminder_type IN ('follow_up', 'call', 'email', 'meeting'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_lender_lead_reminders_lender ON lender_lead_reminders(lender_id, reminder_date);
CREATE INDEX IF NOT EXISTS idx_lender_lead_reminders_lead ON lender_lead_reminders(lead_id);
CREATE INDEX IF NOT EXISTS idx_lender_lead_reminders_date ON lender_lead_reminders(reminder_date) WHERE completed = false;

-- Enable RLS
ALTER TABLE lender_lead_reminders ENABLE ROW LEVEL SECURITY;

-- Lenders can view their own reminders
CREATE POLICY "Lenders can view own lead reminders"
  ON lender_lead_reminders FOR SELECT
  TO authenticated
  USING (lender_id = auth.uid());

-- Lenders can create reminders for their leads
CREATE POLICY "Lenders can create lead reminders"
  ON lender_lead_reminders FOR INSERT
  TO authenticated
  WITH CHECK (
    lender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM lender_leads
      WHERE lender_leads.id = lead_id
      AND lender_leads.lender_id = auth.uid()
    )
  );

-- Lenders can update their own reminders
CREATE POLICY "Lenders can update own lead reminders"
  ON lender_lead_reminders FOR UPDATE
  TO authenticated
  USING (lender_id = auth.uid())
  WITH CHECK (lender_id = auth.uid());

-- Lenders can delete their own reminders
CREATE POLICY "Lenders can delete own lead reminders"
  ON lender_lead_reminders FOR DELETE
  TO authenticated
  USING (lender_id = auth.uid());

-- Update invitations policies to support mortgage lenders
DROP POLICY IF EXISTS "Lenders can view invitations they sent" ON invitations;
CREATE POLICY "Lenders can view invitations they sent"
  ON invitations FOR SELECT
  TO authenticated
  USING (mortgage_lender_id = auth.uid());

DROP POLICY IF EXISTS "Lenders can create invitations" ON invitations;
CREATE POLICY "Lenders can create invitations"
  ON invitations FOR INSERT
  TO authenticated
  WITH CHECK (mortgage_lender_id = auth.uid());

DROP POLICY IF EXISTS "Lenders can update their invitations" ON invitations;
CREATE POLICY "Lenders can update their invitations"
  ON invitations FOR UPDATE
  TO authenticated
  USING (mortgage_lender_id = auth.uid())
  WITH CHECK (mortgage_lender_id = auth.uid());

DROP POLICY IF EXISTS "Lenders can delete their invitations" ON invitations;
CREATE POLICY "Lenders can delete their invitations"
  ON invitations FOR DELETE
  TO authenticated
  USING (mortgage_lender_id = auth.uid());

-- Function to mark reminder as completed
CREATE OR REPLACE FUNCTION complete_lender_lead_reminder(p_reminder_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE lender_lead_reminders
  SET completed = true,
      completed_at = now()
  WHERE id = p_reminder_id
    AND lender_id = auth.uid()
    AND completed = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create activity feed entry when reminder is created
CREATE OR REPLACE FUNCTION notify_lender_lead_reminder_created() 
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_name text;
BEGIN
  SELECT name INTO v_lead_name FROM lender_leads WHERE id = NEW.lead_id;
  
  -- Create activity in lender_lead_activities
  INSERT INTO lender_lead_activities (
    lead_id,
    lender_id,
    activity_type,
    subject,
    description
  ) VALUES (
    NEW.lead_id,
    NEW.lender_id,
    'note',
    'Reminder Set',
    'Reminder set to ' || NEW.reminder_type || ' ' || v_lead_name || ' on ' || to_char(NEW.reminder_date, 'Mon DD, YYYY at HH:MI AM')
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_lender_lead_reminder_created ON lender_lead_reminders;
CREATE TRIGGER on_lender_lead_reminder_created
  AFTER INSERT ON lender_lead_reminders
  FOR EACH ROW
  EXECUTE FUNCTION notify_lender_lead_reminder_created();

-- Function to check for due lender lead reminders
CREATE OR REPLACE FUNCTION check_due_lender_lead_reminders()
RETURNS void 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reminder record;
  v_lead_name text;
BEGIN
  FOR v_reminder IN 
    SELECT * FROM lender_lead_reminders
    WHERE completed = false
      AND reminder_date <= now()
      AND reminder_date > now() - interval '1 hour'
  LOOP
    SELECT name INTO v_lead_name FROM lender_leads WHERE id = v_reminder.lead_id;
    
    -- Create activity in lender_lead_activities
    INSERT INTO lender_lead_activities (
      lead_id,
      lender_id,
      activity_type,
      subject,
      description
    ) VALUES (
      v_reminder.lead_id,
      v_reminder.lender_id,
      'note',
      'Reminder: Contact ' || v_lead_name,
      'Time to ' || v_reminder.reminder_type || ' ' || v_lead_name || 
        CASE WHEN v_reminder.notes IS NOT NULL THEN '. Notes: ' || v_reminder.notes ELSE '' END
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;
