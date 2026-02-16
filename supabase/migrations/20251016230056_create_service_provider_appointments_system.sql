/*
  # Create Service Provider Appointments System

  1. New Tables
    - `service_provider_appointments`
      - `id` (uuid, primary key)
      - `service_provider_id` (uuid, references profiles) - The service provider
      - `lead_id` (uuid, references service_provider_leads, nullable) - Associated lead if applicable
      - `client_name` (text) - Client's name
      - `client_email` (text) - Client's email for calendar invitations
      - `client_phone` (text, nullable) - Client's phone number
      - `title` (text) - Appointment title
      - `description` (text, nullable) - Appointment description
      - `location` (text, nullable) - Appointment location/address
      - `start_time` (timestamptz) - Appointment start time
      - `end_time` (timestamptz) - Appointment end time
      - `status` (text) - Status: 'scheduled', 'confirmed', 'cancelled', 'completed'
      - `calendar_invitation_sent` (boolean) - Whether calendar invitation was sent
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on appointments table
    - Service providers can view and manage their own appointments
    - Calendar invitations include .ics file for Google Calendar and iOS compatibility
*/

-- Create service_provider_appointments table
CREATE TABLE IF NOT EXISTS service_provider_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_provider_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  lead_id uuid REFERENCES service_provider_leads(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  client_email text NOT NULL,
  client_phone text,
  title text NOT NULL,
  description text,
  location text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  calendar_invitation_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_appointment_status CHECK (status IN ('scheduled', 'confirmed', 'cancelled', 'completed')),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_appointments_service_provider_id ON service_provider_appointments(service_provider_id);
CREATE INDEX IF NOT EXISTS idx_appointments_lead_id ON service_provider_appointments(lead_id);
CREATE INDEX IF NOT EXISTS idx_appointments_start_time ON service_provider_appointments(start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON service_provider_appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_client_email ON service_provider_appointments(client_email);

-- Enable RLS
ALTER TABLE service_provider_appointments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for service_provider_appointments

-- Service providers can view their own appointments
CREATE POLICY "Service providers can view own appointments"
  ON service_provider_appointments FOR SELECT
  TO authenticated
  USING (
    service_provider_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'service_provider'
    )
  );

-- Service providers can create their own appointments
CREATE POLICY "Service providers can create own appointments"
  ON service_provider_appointments FOR INSERT
  TO authenticated
  WITH CHECK (
    service_provider_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'service_provider'
    )
  );

-- Service providers can update their own appointments
CREATE POLICY "Service providers can update own appointments"
  ON service_provider_appointments FOR UPDATE
  TO authenticated
  USING (service_provider_id = auth.uid())
  WITH CHECK (service_provider_id = auth.uid());

-- Service providers can delete their own appointments
CREATE POLICY "Service providers can delete own appointments"
  ON service_provider_appointments FOR DELETE
  TO authenticated
  USING (service_provider_id = auth.uid());

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_service_provider_appointment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER service_provider_appointments_updated_at
  BEFORE UPDATE ON service_provider_appointments
  FOR EACH ROW
  EXECUTE FUNCTION update_service_provider_appointment_updated_at();
