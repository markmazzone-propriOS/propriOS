/*
  # Create Service Provider Leads System

  ## Overview
  Creates a comprehensive leads management system for service providers to track potential clients through the sales funnel.

  ## New Tables
  1. `service_provider_leads`
    - `id` (uuid, primary key)
    - `service_provider_id` (uuid, references service_provider_profiles)
    - `name` (text) - Lead's full name
    - `email` (text) - Lead's email address
    - `phone` (text) - Lead's phone number
    - `source` (text) - How the lead was acquired (website, referral, etc.)
    - `status` (text) - Current stage in sales funnel
    - `priority` (text) - Lead priority (low, medium, high)
    - `estimated_value` (numeric) - Estimated project value
    - `project_description` (text) - Details about the project
    - `notes` (text) - Internal notes about the lead
    - `conversation_id` (uuid) - Link to conversation if exists
    - `last_contact_date` (timestamptz) - Last time provider contacted lead
    - `next_follow_up_date` (timestamptz) - Scheduled follow-up date
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  2. `lead_activities`
    - `id` (uuid, primary key)
    - `lead_id` (uuid, references service_provider_leads)
    - `activity_type` (text) - Type of activity (status_change, note, call, email, meeting)
    - `description` (text) - Activity description
    - `old_status` (text) - Previous status (for status changes)
    - `new_status` (text) - New status (for status changes)
    - `created_by` (uuid, references profiles)
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled on all tables
  - Service providers can only access their own leads
  - Activity tracking for audit trail
*/

-- Create service_provider_leads table
CREATE TABLE IF NOT EXISTS service_provider_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_provider_id uuid NOT NULL REFERENCES service_provider_profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  source text NOT NULL DEFAULT 'website',
  status text NOT NULL DEFAULT 'new',
  priority text NOT NULL DEFAULT 'medium',
  estimated_value numeric,
  project_description text,
  notes text,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  last_contact_date timestamptz,
  next_follow_up_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create lead_activities table
CREATE TABLE IF NOT EXISTS lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES service_provider_leads(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  description text NOT NULL,
  old_status text,
  new_status text,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_leads_provider ON service_provider_leads(service_provider_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON service_provider_leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_priority ON service_provider_leads(priority);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON service_provider_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead ON lead_activities(lead_id);

-- Enable RLS
ALTER TABLE service_provider_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for service_provider_leads

-- Service providers can view their own leads
CREATE POLICY "Service providers can view own leads"
  ON service_provider_leads FOR SELECT
  TO authenticated
  USING (auth.uid() = service_provider_id);

-- Service providers can create leads
CREATE POLICY "Service providers can create leads"
  ON service_provider_leads FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = service_provider_id);

-- Service providers can update their own leads
CREATE POLICY "Service providers can update own leads"
  ON service_provider_leads FOR UPDATE
  TO authenticated
  USING (auth.uid() = service_provider_id)
  WITH CHECK (auth.uid() = service_provider_id);

-- Service providers can delete their own leads
CREATE POLICY "Service providers can delete own leads"
  ON service_provider_leads FOR DELETE
  TO authenticated
  USING (auth.uid() = service_provider_id);

-- RLS Policies for lead_activities

-- Service providers can view activities for their leads
CREATE POLICY "Service providers can view lead activities"
  ON lead_activities FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_provider_leads
      WHERE id = lead_id AND service_provider_id = auth.uid()
    )
  );

-- Service providers can create activities for their leads
CREATE POLICY "Service providers can create lead activities"
  ON lead_activities FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM service_provider_leads
      WHERE id = lead_id AND service_provider_id = auth.uid()
    )
  );

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_lead_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS set_lead_updated_at ON service_provider_leads;
CREATE TRIGGER set_lead_updated_at
  BEFORE UPDATE ON service_provider_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_updated_at();

-- Create function to automatically log status changes
CREATE OR REPLACE FUNCTION log_lead_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO lead_activities (lead_id, activity_type, description, old_status, new_status, created_by)
    VALUES (
      NEW.id,
      'status_change',
      'Status changed from ' || OLD.status || ' to ' || NEW.status,
      OLD.status,
      NEW.status,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for status change logging
DROP TRIGGER IF EXISTS log_status_change ON service_provider_leads;
CREATE TRIGGER log_status_change
  AFTER UPDATE ON service_provider_leads
  FOR EACH ROW
  EXECUTE FUNCTION log_lead_status_change();
