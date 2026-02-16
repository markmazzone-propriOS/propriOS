/*
  # Fix Property Claim Email Notification Settings

  This migration fixes the trigger to use the correct current_setting names
  matching the pattern used in other notification triggers.

  ## Changes
  - Change from app.settings.* to app.* for consistency
  - Use proper current_setting values that match the rest of the application
*/

-- Drop and recreate the function with correct setting names
DROP FUNCTION IF EXISTS send_property_claim_email_notification() CASCADE;

CREATE OR REPLACE FUNCTION send_property_claim_email_notification()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_agent RECORD;
  v_property RECORD;
  v_buyer RECORD;
BEGIN
  -- Get agent details
  SELECT p.full_name, p.email
  INTO v_agent
  FROM profiles p
  WHERE p.id = NEW.agent_id;

  -- Get property details
  SELECT pr.address_line1, pr.city, pr.state, pr.price, pr.id
  INTO v_property
  FROM properties pr
  WHERE pr.id = NEW.property_id;

  -- Get buyer details
  SELECT p.full_name
  INTO v_buyer
  FROM profiles p
  WHERE p.id = NEW.buyer_id;

  -- Only send email if all data is available
  IF v_agent.email IS NOT NULL AND v_property.id IS NOT NULL THEN
    -- Call edge function to send email (async, don't wait for response)
    PERFORM net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/send-property-claim-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
      ),
      body := jsonb_build_object(
        'agent_email', v_agent.email,
        'agent_name', v_agent.full_name,
        'property_address', v_property.address_line1,
        'property_price', v_property.price,
        'property_city', v_property.city,
        'property_state', v_property.state,
        'buyer_name', v_buyer.full_name,
        'property_id', v_property.id
      )
    );
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Failed to send property claim notification: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_send_property_claim_email ON agent_claim_notifications;
CREATE TRIGGER trigger_send_property_claim_email
  AFTER INSERT ON agent_claim_notifications
  FOR EACH ROW
  EXECUTE FUNCTION send_property_claim_email_notification();