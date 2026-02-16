/*
  # Add Property Owner Lead Email Notification

  1. Changes
    - Create trigger function to send email notification when a new property_owner_lead is created
    - Create trigger that calls the edge function to send the email
    - Uses SECURITY DEFINER to ensure trigger has permission to access the data

  2. Notes
    - Email is sent asynchronously via edge function
    - Includes lead details and property information
    - Helps property owners respond quickly to rental inquiries
*/

-- Create function to send property owner lead notification
CREATE OR REPLACE FUNCTION notify_property_owner_new_lead()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_owner_email text;
  v_payload jsonb;
BEGIN
  -- Get property owner's email
  SELECT email INTO v_owner_email
  FROM auth.users
  WHERE id = NEW.property_owner_id;

  IF v_owner_email IS NULL THEN
    RAISE WARNING 'Property owner email not found for lead %', NEW.id;
    RETURN NEW;
  END IF;

  -- Build payload for edge function
  v_payload := jsonb_build_object(
    'propertyOwnerId', NEW.property_owner_id,
    'propertyId', NEW.property_id,
    'leadName', NEW.lead_name,
    'leadEmail', NEW.lead_email,
    'leadPhone', NEW.lead_phone,
    'message', NEW.message
  );

  -- Call edge function to send email
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-property-owner-lead-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key', true)
    ),
    body := v_payload
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to send property owner lead notification: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_notify_property_owner_new_lead ON property_owner_leads;

-- Create trigger to send notification on new lead
CREATE TRIGGER trigger_notify_property_owner_new_lead
  AFTER INSERT ON property_owner_leads
  FOR EACH ROW
  EXECUTE FUNCTION notify_property_owner_new_lead();
