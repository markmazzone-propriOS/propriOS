/*
  # Create Service Provider Appointment Reminders System

  1. New Tables
    - `service_provider_appointment_reminders`
      - `id` (uuid, primary key)
      - `service_provider_id` (uuid, references profiles)
      - `appointment_id` (uuid, references service_provider_appointments)
      - `reminder_time` (timestamptz) - when to send the reminder
      - `reminder_type` (text) - '15_minutes', '1_hour', '1_day', 'custom'
      - `message` (text) - optional custom message
      - `is_sent` (boolean) - whether reminder has been sent
      - `sent_at` (timestamptz) - when reminder was sent
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `service_provider_appointment_reminders` table
    - Add policies for service providers to manage their own reminders
*/

-- Create the appointment reminders table
CREATE TABLE IF NOT EXISTS service_provider_appointment_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_provider_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES service_provider_appointments(id) ON DELETE CASCADE,
  reminder_time timestamptz NOT NULL,
  reminder_type text NOT NULL CHECK (reminder_type IN ('15_minutes', '1_hour', '1_day', 'custom')),
  message text,
  is_sent boolean DEFAULT false,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_appointment_reminders_service_provider 
  ON service_provider_appointment_reminders(service_provider_id);
CREATE INDEX IF NOT EXISTS idx_appointment_reminders_appointment 
  ON service_provider_appointment_reminders(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_reminders_time 
  ON service_provider_appointment_reminders(reminder_time) WHERE is_sent = false;

-- Enable RLS
ALTER TABLE service_provider_appointment_reminders ENABLE ROW LEVEL SECURITY;

-- Service providers can view their own reminders
CREATE POLICY "Service providers can view own reminders"
  ON service_provider_appointment_reminders
  FOR SELECT
  TO authenticated
  USING (service_provider_id = auth.uid());

-- Service providers can create reminders for their appointments
CREATE POLICY "Service providers can create own reminders"
  ON service_provider_appointment_reminders
  FOR INSERT
  TO authenticated
  WITH CHECK (service_provider_id = auth.uid());

-- Service providers can update their own reminders
CREATE POLICY "Service providers can update own reminders"
  ON service_provider_appointment_reminders
  FOR UPDATE
  TO authenticated
  USING (service_provider_id = auth.uid())
  WITH CHECK (service_provider_id = auth.uid());

-- Service providers can delete their own reminders
CREATE POLICY "Service providers can delete own reminders"
  ON service_provider_appointment_reminders
  FOR DELETE
  TO authenticated
  USING (service_provider_id = auth.uid());

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_appointment_reminder_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_appointment_reminder_updated_at_trigger 
  ON service_provider_appointment_reminders;
CREATE TRIGGER update_appointment_reminder_updated_at_trigger
  BEFORE UPDATE ON service_provider_appointment_reminders
  FOR EACH ROW
  EXECUTE FUNCTION update_appointment_reminder_updated_at();
