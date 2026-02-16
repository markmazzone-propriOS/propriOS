/*
  # Create Property Owner Leads System

  1. New Tables
    - `property_owner_leads`
      - `id` (uuid, primary key)
      - `property_owner_id` (uuid, references profiles)
      - `property_id` (uuid, references properties) - optional, for property-specific inquiries
      - `lead_name` (text)
      - `lead_email` (text)
      - `lead_phone` (text) - optional
      - `message` (text)
      - `inquiry_type` (text) - 'general', 'viewing_request', 'application'
      - `status` (text) - 'new', 'contacted', 'qualified', 'viewing_scheduled', 'application_sent', 'closed_won', 'closed_lost'
      - `source` (text) - 'website', 'referral', 'direct'
      - `preferred_move_in_date` (date) - optional
      - `preferred_viewing_date` (timestamptz) - optional
      - `notes` (text) - optional, for property owner's internal notes
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `property_owner_lead_activities`
      - `id` (uuid, primary key)
      - `lead_id` (uuid, references property_owner_leads)
      - `property_owner_id` (uuid, references profiles)
      - `activity_type` (text) - 'email_sent', 'call_made', 'viewing_scheduled', 'note_added', 'status_changed'
      - `description` (text)
      - `metadata` (jsonb) - optional, for additional data
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Property owners can only access their own leads
    - Property owners can only access activities for their own leads

  3. Indexes
    - Add index on property_owner_id for faster queries
    - Add index on property_id for property-specific lead lookups
    - Add index on status for filtering
    - Add index on created_at for sorting
*/

-- Create property_owner_leads table
CREATE TABLE IF NOT EXISTS property_owner_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_owner_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  lead_name text NOT NULL,
  lead_email text NOT NULL,
  lead_phone text,
  message text NOT NULL,
  inquiry_type text NOT NULL DEFAULT 'general' CHECK (inquiry_type IN ('general', 'viewing_request', 'application')),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'viewing_scheduled', 'application_sent', 'closed_won', 'closed_lost')),
  source text NOT NULL DEFAULT 'website' CHECK (source IN ('website', 'referral', 'direct')),
  preferred_move_in_date date,
  preferred_viewing_date timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create property_owner_lead_activities table
CREATE TABLE IF NOT EXISTS property_owner_lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES property_owner_leads(id) ON DELETE CASCADE NOT NULL,
  property_owner_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  activity_type text NOT NULL CHECK (activity_type IN ('email_sent', 'call_made', 'viewing_scheduled', 'note_added', 'status_changed', 'application_received')),
  description text NOT NULL,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_property_owner_leads_owner ON property_owner_leads(property_owner_id);
CREATE INDEX IF NOT EXISTS idx_property_owner_leads_property ON property_owner_leads(property_id);
CREATE INDEX IF NOT EXISTS idx_property_owner_leads_status ON property_owner_leads(status);
CREATE INDEX IF NOT EXISTS idx_property_owner_leads_created ON property_owner_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_property_owner_lead_activities_lead ON property_owner_lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_property_owner_lead_activities_owner ON property_owner_lead_activities(property_owner_id);

-- Enable RLS
ALTER TABLE property_owner_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_owner_lead_activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for property_owner_leads

-- Property owners can view their own leads
CREATE POLICY "Property owners can view own leads"
  ON property_owner_leads
  FOR SELECT
  TO authenticated
  USING (property_owner_id = auth.uid());

-- Property owners can insert leads (when someone submits inquiry form)
-- Also allow authenticated users to create leads for property owners
CREATE POLICY "Users can create leads for property owners"
  ON property_owner_leads
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow anonymous users to create leads (for public inquiry forms)
CREATE POLICY "Anonymous users can create leads"
  ON property_owner_leads
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Property owners can update their own leads
CREATE POLICY "Property owners can update own leads"
  ON property_owner_leads
  FOR UPDATE
  TO authenticated
  USING (property_owner_id = auth.uid())
  WITH CHECK (property_owner_id = auth.uid());

-- Property owners can delete their own leads
CREATE POLICY "Property owners can delete own leads"
  ON property_owner_leads
  FOR DELETE
  TO authenticated
  USING (property_owner_id = auth.uid());

-- RLS Policies for property_owner_lead_activities

-- Property owners can view activities for their own leads
CREATE POLICY "Property owners can view own lead activities"
  ON property_owner_lead_activities
  FOR SELECT
  TO authenticated
  USING (property_owner_id = auth.uid());

-- Property owners can insert activities for their own leads
CREATE POLICY "Property owners can create lead activities"
  ON property_owner_lead_activities
  FOR INSERT
  TO authenticated
  WITH CHECK (property_owner_id = auth.uid());

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_property_owner_lead_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_property_owner_leads_updated_at ON property_owner_leads;
CREATE TRIGGER update_property_owner_leads_updated_at
  BEFORE UPDATE ON property_owner_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_property_owner_lead_updated_at();

-- Create function to log status changes as activities
CREATE OR REPLACE FUNCTION log_property_owner_lead_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO property_owner_lead_activities (
      lead_id,
      property_owner_id,
      activity_type,
      description,
      metadata
    ) VALUES (
      NEW.id,
      NEW.property_owner_id,
      'status_changed',
      'Status changed from ' || OLD.status || ' to ' || NEW.status,
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for status change logging
DROP TRIGGER IF EXISTS log_property_owner_lead_status_change_trigger ON property_owner_leads;
CREATE TRIGGER log_property_owner_lead_status_change_trigger
  AFTER UPDATE ON property_owner_leads
  FOR EACH ROW
  EXECUTE FUNCTION log_property_owner_lead_status_change();
