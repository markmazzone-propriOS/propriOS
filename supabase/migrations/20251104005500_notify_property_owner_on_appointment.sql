/*
  # Notify Property Owner on Appointment Creation
  
  1. Changes
    - Add trigger to send email notification to property owner when appointment is created
    - Only sends when property_owner_id is set
    - Includes calendar invitation and job information
  
  2. Notes
    - Uses the send-property-owner-appointment-notification edge function
    - Runs asynchronously after appointment creation
*/

-- Function to notify property owner of new appointment
CREATE OR REPLACE FUNCTION notify_property_owner_of_appointment()
RETURNS TRIGGER AS $$
DECLARE
  v_service_provider profiles%ROWTYPE;
  v_property_owner profiles%ROWTYPE;
  v_supabase_url text := current_setting('app.settings.supabase_url', true);
  v_supabase_anon_key text := current_setting('app.settings.supabase_anon_key', true);
BEGIN
  -- Only send notification if property owner is set
  IF NEW.property_owner_id IS NOT NULL THEN
    -- Get service provider details
    SELECT * INTO v_service_provider
    FROM profiles
    WHERE id = NEW.service_provider_id;
    
    -- Get property owner details
    SELECT * INTO v_property_owner
    FROM profiles
    WHERE id = NEW.property_owner_id;
    
    -- Send notification via edge function
    IF v_property_owner.email IS NOT NULL AND v_service_provider.email IS NOT NULL THEN
      PERFORM net.http_post(
        url := v_supabase_url || '/functions/v1/send-property-owner-appointment-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_supabase_anon_key
        ),
        body := jsonb_build_object(
          'appointmentId', NEW.id,
          'propertyOwnerName', v_property_owner.full_name,
          'propertyOwnerEmail', v_property_owner.email,
          'serviceProviderName', v_service_provider.full_name,
          'serviceProviderEmail', v_service_provider.email,
          'title', NEW.title,
          'description', NEW.description,
          'location', NEW.location,
          'startTime', NEW.start_time,
          'endTime', NEW.end_time
        )::text
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new appointments with property owners
DROP TRIGGER IF EXISTS notify_property_owner_of_appointment_trigger ON service_provider_appointments;
CREATE TRIGGER notify_property_owner_of_appointment_trigger
  AFTER INSERT ON service_provider_appointments
  FOR EACH ROW
  WHEN (NEW.property_owner_id IS NOT NULL)
  EXECUTE FUNCTION notify_property_owner_of_appointment();
