/*
  # Fix Appointment Calendar Sync Email Field
  
  1. Changes
    - Update sync function to get email from auth.users instead of profiles
    - Use get_user_email function to retrieve emails properly
  
  2. Notes
    - Profiles table doesn't have email field
    - Emails are stored in auth.users table
*/

CREATE OR REPLACE FUNCTION sync_appointment_to_calendar()
RETURNS TRIGGER AS $$
DECLARE
  v_service_provider_name text;
  v_service_provider_email text;
  v_service_provider_phone text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Create calendar event for property owner (if exists)
    IF NEW.property_owner_id IS NOT NULL THEN
      -- Get service provider details
      SELECT p.full_name, p.phone
      INTO v_service_provider_name, v_service_provider_phone
      FROM profiles p
      WHERE p.id = NEW.service_provider_id;
      
      -- Get service provider email
      SELECT get_user_email(NEW.service_provider_id) INTO v_service_provider_email;

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
        COALESCE(NEW.description, '') || E'\n\nService Provider: ' || v_service_provider_name,
        NEW.location,
        NEW.start_time,
        NEW.end_time,
        NEW.status,
        v_service_provider_name,
        v_service_provider_email,
        v_service_provider_phone,
        NEW.service_provider_id
      );
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Update property owner's calendar event if exists
    IF NEW.property_owner_id IS NOT NULL THEN
      -- Get service provider details
      SELECT p.full_name
      INTO v_service_provider_name
      FROM profiles p
      WHERE p.id = NEW.service_provider_id;

      UPDATE calendar_events
      SET
        title = NEW.title,
        description = COALESCE(NEW.description, '') || E'\n\nService Provider: ' || v_service_provider_name,
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
