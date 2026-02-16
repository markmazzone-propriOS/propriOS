/*
  # Fix Property Owner Notification Trigger
  
  1. Changes
    - Drop trigger first, then function
    - Remove automatic notification that was causing null URL errors
  
  2. Notes
    - Database functions cannot access environment variables properly
    - Will handle notifications in application layer
*/

-- Drop the trigger first
DROP TRIGGER IF EXISTS notify_property_owner_of_appointment_trigger ON service_provider_appointments;

-- Now drop the function
DROP FUNCTION IF EXISTS notify_property_owner_of_appointment();
