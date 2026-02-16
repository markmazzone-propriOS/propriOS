/*
  # Fix Property Owner Appointment Notification Trigger
  
  1. Changes
    - Fix trigger to get email from auth.users table instead of profiles
    - Profiles table doesn't have email field, it's in auth.users
  
  2. Notes
    - Maintains all existing functionality
    - Only changes how emails are retrieved
*/

CREATE OR REPLACE FUNCTION notify_property_owner_of_appointment()
RETURNS TRIGGER AS $$
DECLARE
  v_service_provider_name text;
  v_service_provider_email text;
  v_property_owner_name text;
  v_property_owner_email text;
  v_supabase_url text := current_setting('app.settings.supabase_url', true);
  v_supabase_anon_key text := current_setting('app.settings.supabase_anon_key', true);
BEGIN
  IF NEW.property_owner_id IS NOT NULL THEN
    SELECT p.full_name, au.email
    INTO v_service_provider_name, v_service_provider_email
    FROM profiles p
    JOIN auth.users au ON p.id = au.id
    WHERE p.id = NEW.service_provider_id;
    
    SELECT p.full_name, au.email
    INTO v_property_owner_name, v_property_owner_email
    FROM profiles p
    JOIN auth.users au ON p.id = au.id
    WHERE p.id = NEW.property_owner_id;
    
    IF v_property_owner_email IS NOT NULL AND v_service_provider_email IS NOT NULL THEN
      PERFORM net.http_post(
        url := v_supabase_url || '/functions/v1/send-property-owner-appointment-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_supabase_anon_key
        ),
        body := jsonb_build_object(
          'appointmentId', NEW.id,
          'propertyOwnerName', v_property_owner_name,
          'propertyOwnerEmail', v_property_owner_email,
          'serviceProviderName', v_service_provider_name,
          'serviceProviderEmail', v_service_provider_email,
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
