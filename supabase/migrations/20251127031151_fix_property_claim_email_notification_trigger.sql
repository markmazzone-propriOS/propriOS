/*
  # Fix Property Claim Email Notification Trigger

  This migration fixes the trigger to use the correct Supabase environment variables
  that are automatically available in edge functions.

  ## Changes
  - Update function to use SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables
  - These are automatically available and don't need to be fetched via current_setting
*/

-- Drop and recreate the function with correct environment variable usage
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
  v_response RECORD;
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
    -- Call edge function to send email using vault secrets
    BEGIN
      SELECT 
        net.http_post(
          url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/send-property-claim-notification',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
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
        ) INTO v_response;
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the transaction
      RAISE WARNING 'Failed to send property claim notification: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_send_property_claim_email ON agent_claim_notifications;
CREATE TRIGGER trigger_send_property_claim_email
  AFTER INSERT ON agent_claim_notifications
  FOR EACH ROW
  EXECUTE FUNCTION send_property_claim_email_notification();