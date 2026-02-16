/*
  # Sync Service Provider Appointments to Calendar Events
  
  1. Changes
    - Add trigger to automatically create calendar events when appointments are scheduled
    - Syncs appointment details to both service provider and property owner calendars
    - Updates calendar events when appointments are modified
    - Deletes calendar events when appointments are cancelled or deleted
  
  2. Notes
    - Service provider gets a calendar event with their own details
    - Property owner gets a calendar event with appointment details
    - Calendar events are linked to the appointment via a custom field
*/

-- Add appointment_id column to calendar_events to track the link
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calendar_events' AND column_name = 'appointment_id'
  ) THEN
    ALTER TABLE calendar_events 
    ADD COLUMN appointment_id uuid REFERENCES service_provider_appointments(id) ON DELETE CASCADE;
    
    CREATE INDEX IF NOT EXISTS idx_calendar_events_appointment_id ON calendar_events(appointment_id);
  END IF;
END $$;

-- Function to create calendar events from appointment
CREATE OR REPLACE FUNCTION sync_appointment_to_calendar()
RETURNS TRIGGER AS $$
DECLARE
  v_service_provider_profile profiles%ROWTYPE;
  v_property_owner_profile profiles%ROWTYPE;
BEGIN
  -- Get service provider details
  SELECT * INTO v_service_provider_profile
  FROM profiles
  WHERE id = NEW.service_provider_id;

  -- Get property owner details (if exists)
  IF NEW.property_owner_id IS NOT NULL THEN
    SELECT * INTO v_property_owner_profile
    FROM profiles
    WHERE id = NEW.property_owner_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Create calendar event for service provider
    INSERT INTO calendar_events (
      user_id,
      appointment_id,
      property_id,
      event_type,
      title,
      description,
      location,
      start_time,
      end_time,
      status,
      requestor_name,
      requestor_email,
      requestor_phone
    ) VALUES (
      NEW.service_provider_id,
      NEW.id,
      NULL,
      'appointment',
      NEW.title,
      NEW.description,
      NEW.location,
      NEW.start_time,
      NEW.end_time,
      NEW.status,
      NEW.client_name,
      NEW.client_email,
      NEW.client_phone
    );

    -- Create calendar event for property owner (if exists)
    IF NEW.property_owner_id IS NOT NULL THEN
      INSERT INTO calendar_events (
        user_id,
        appointment_id,
        property_id,
        event_type,
        title,
        description,
        location,
        start_time,
        end_time,
        status,
        requestor_name,
        requestor_email,
        requestor_phone,
        requester_id
      ) VALUES (
        NEW.property_owner_id,
        NEW.id,
        NULL,
        'appointment',
        NEW.title,
        COALESCE(NEW.description, '') || E'\n\nService Provider: ' || v_service_provider_profile.full_name,
        NEW.location,
        NEW.start_time,
        NEW.end_time,
        NEW.status,
        v_service_provider_profile.full_name,
        v_service_provider_profile.email,
        v_service_provider_profile.phone,
        NEW.service_provider_id
      );
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Update existing calendar events
    UPDATE calendar_events
    SET
      title = NEW.title,
      description = NEW.description,
      location = NEW.location,
      start_time = NEW.start_time,
      end_time = NEW.end_time,
      status = NEW.status,
      requestor_name = NEW.client_name,
      requestor_email = NEW.client_email,
      requestor_phone = NEW.client_phone
    WHERE appointment_id = NEW.id
    AND user_id = NEW.service_provider_id;

    -- Update property owner's calendar event if exists
    IF NEW.property_owner_id IS NOT NULL THEN
      UPDATE calendar_events
      SET
        title = NEW.title,
        description = COALESCE(NEW.description, '') || E'\n\nService Provider: ' || v_service_provider_profile.full_name,
        location = NEW.location,
        start_time = NEW.start_time,
        end_time = NEW.end_time,
        status = NEW.status
      WHERE appointment_id = NEW.id
      AND user_id = NEW.property_owner_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for insert and update
DROP TRIGGER IF EXISTS sync_appointment_to_calendar_trigger ON service_provider_appointments;
CREATE TRIGGER sync_appointment_to_calendar_trigger
  AFTER INSERT OR UPDATE ON service_provider_appointments
  FOR EACH ROW
  EXECUTE FUNCTION sync_appointment_to_calendar();

-- Function to clean up calendar events when appointment is deleted
CREATE OR REPLACE FUNCTION delete_appointment_calendar_events()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM calendar_events
  WHERE appointment_id = OLD.id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for delete
DROP TRIGGER IF EXISTS delete_appointment_calendar_events_trigger ON service_provider_appointments;
CREATE TRIGGER delete_appointment_calendar_events_trigger
  BEFORE DELETE ON service_provider_appointments
  FOR EACH ROW
  EXECUTE FUNCTION delete_appointment_calendar_events();
