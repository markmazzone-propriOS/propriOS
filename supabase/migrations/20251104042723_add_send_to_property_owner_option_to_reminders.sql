/*
  # Add Property Owner Notification to Appointment Reminders

  1. Changes
    - Add `send_to_property_owner` (boolean) column to track if reminder should be sent to property owner
    - Add `property_owner_notified` (boolean) column to track if property owner was notified
    - Add `property_owner_notified_at` (timestamptz) column to track when property owner was notified

  2. Notes
    - Service providers can now choose to send appointment reminders to property owners
    - This allows service providers to notify property owners about upcoming appointments
    - The reminder message can be customized for property owner communication
*/

-- Add columns to track property owner notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_provider_appointment_reminders' 
    AND column_name = 'send_to_property_owner'
  ) THEN
    ALTER TABLE service_provider_appointment_reminders 
    ADD COLUMN send_to_property_owner boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_provider_appointment_reminders' 
    AND column_name = 'property_owner_notified'
  ) THEN
    ALTER TABLE service_provider_appointment_reminders 
    ADD COLUMN property_owner_notified boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_provider_appointment_reminders' 
    AND column_name = 'property_owner_notified_at'
  ) THEN
    ALTER TABLE service_provider_appointment_reminders 
    ADD COLUMN property_owner_notified_at timestamptz;
  END IF;
END $$;
