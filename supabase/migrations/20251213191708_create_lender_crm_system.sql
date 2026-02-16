/*
  # Create Comprehensive Lender CRM System

  1. Enhanced Lead Tracking
    - Add priority, expected_close_date, contact_type, property_type fields to lender_leads
    - Add last_activity_at for sorting
    - Add assigned_to for team management

  2. New Tables
    - `lender_lead_activities` - Track all interactions with leads (calls, emails, meetings, notes)
    - `lender_lead_tags` - Categorize leads with custom tags
    - `lender_lead_tasks` - Follow-up tasks and reminders

  3. Security
    - Enable RLS on all new tables
    - Add policies for lenders to manage their CRM data
*/

-- Add new columns to lender_leads
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lender_leads' AND column_name = 'priority'
  ) THEN
    ALTER TABLE lender_leads ADD COLUMN priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lender_leads' AND column_name = 'expected_close_date'
  ) THEN
    ALTER TABLE lender_leads ADD COLUMN expected_close_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lender_leads' AND column_name = 'contact_type'
  ) THEN
    ALTER TABLE lender_leads ADD COLUMN contact_type text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lender_leads' AND column_name = 'property_type'
  ) THEN
    ALTER TABLE lender_leads ADD COLUMN property_type text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lender_leads' AND column_name = 'last_activity_at'
  ) THEN
    ALTER TABLE lender_leads ADD COLUMN last_activity_at timestamptz DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lender_leads' AND column_name = 'assigned_to'
  ) THEN
    ALTER TABLE lender_leads ADD COLUMN assigned_to uuid REFERENCES profiles(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lender_leads' AND column_name = 'lead_score'
  ) THEN
    ALTER TABLE lender_leads ADD COLUMN lead_score integer DEFAULT 0;
  END IF;
END $$;

-- Create lender_lead_activities table
CREATE TABLE IF NOT EXISTS lender_lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES lender_leads(id) ON DELETE CASCADE NOT NULL,
  lender_id uuid REFERENCES mortgage_lender_profiles(id) NOT NULL,
  activity_type text NOT NULL CHECK (activity_type IN ('call', 'email', 'meeting', 'note', 'task_completed', 'status_change')),
  subject text,
  description text NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id)
);

ALTER TABLE lender_lead_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lenders can view their lead activities"
  ON lender_lead_activities
  FOR SELECT
  TO authenticated
  USING (lender_id = auth.uid());

CREATE POLICY "Lenders can create lead activities"
  ON lender_lead_activities
  FOR INSERT
  TO authenticated
  WITH CHECK (lender_id = auth.uid());

CREATE POLICY "Lenders can update their lead activities"
  ON lender_lead_activities
  FOR UPDATE
  TO authenticated
  USING (lender_id = auth.uid());

CREATE POLICY "Lenders can delete their lead activities"
  ON lender_lead_activities
  FOR DELETE
  TO authenticated
  USING (lender_id = auth.uid());

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_lender_lead_activities_lead_id ON lender_lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_lender_lead_activities_created_at ON lender_lead_activities(created_at DESC);

-- Create lender_lead_tags table
CREATE TABLE IF NOT EXISTS lender_lead_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES lender_leads(id) ON DELETE CASCADE NOT NULL,
  tag text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE lender_lead_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lenders can manage tags for their leads"
  ON lender_lead_tags
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lender_leads
      WHERE lender_leads.id = lender_lead_tags.lead_id
      AND lender_leads.lender_id = auth.uid()
    )
  );

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_lender_lead_tags_lead_id ON lender_lead_tags(lead_id);

-- Create lender_lead_tasks table
CREATE TABLE IF NOT EXISTS lender_lead_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES lender_leads(id) ON DELETE CASCADE NOT NULL,
  lender_id uuid REFERENCES mortgage_lender_profiles(id) NOT NULL,
  title text NOT NULL,
  description text,
  due_date timestamptz NOT NULL,
  completed boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE lender_lead_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lenders can manage their lead tasks"
  ON lender_lead_tasks
  FOR ALL
  TO authenticated
  USING (lender_id = auth.uid());

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_lender_lead_tasks_lead_id ON lender_lead_tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_lender_lead_tasks_due_date ON lender_lead_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_lender_lead_tasks_completed ON lender_lead_tasks(completed);

-- Function to update last_activity_at when an activity is created
CREATE OR REPLACE FUNCTION update_lead_last_activity()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE lender_leads
  SET last_activity_at = NEW.created_at
  WHERE id = NEW.lead_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update last_activity_at
DROP TRIGGER IF EXISTS trigger_update_lead_last_activity ON lender_lead_activities;
CREATE TRIGGER trigger_update_lead_last_activity
  AFTER INSERT ON lender_lead_activities
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_last_activity();

-- Function to create activity when lead status changes
CREATE OR REPLACE FUNCTION log_lead_status_change()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO lender_lead_activities (
      lead_id,
      lender_id,
      activity_type,
      subject,
      description,
      created_by
    ) VALUES (
      NEW.id,
      NEW.lender_id,
      'status_change',
      'Status changed',
      'Status changed from ' || COALESCE(OLD.status, 'none') || ' to ' || NEW.status,
      auth.uid()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to log status changes
DROP TRIGGER IF EXISTS trigger_log_lead_status_change ON lender_leads;
CREATE TRIGGER trigger_log_lead_status_change
  AFTER UPDATE ON lender_leads
  FOR EACH ROW
  EXECUTE FUNCTION log_lead_status_change();
