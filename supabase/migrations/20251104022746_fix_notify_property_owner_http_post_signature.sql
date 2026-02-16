/*
  # Fix HTTP Post Function Signature
  
  1. Changes
    - Update net.http_post call to use correct parameter names for pg_net 0.19.5
    - Change from named parameters to positional parameters
  
  2. Notes
    - pg_net extension is installed but signature has changed
    - Body parameter should be jsonb type, not text
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
        v_supabase_url || '/functions/v1/send-property-owner-appointment-notification',
        jsonb_build_object(
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
        ),
        jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_supabase_anon_key
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
