/*
  # Fix Appointment Calendar Sync - Set property_owner_id
  
  1. Changes
    - Update the sync_appointment_to_calendar function to set property_owner_id
    - This ensures property owners can see appointments in their calendar
  
  2. Notes
    - Property owner calendar events need property_owner_id set
    - Service provider calendar events use user_id only
*/

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
        property_owner_id,
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
      AND property_owner_id = NEW.property_owner_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
