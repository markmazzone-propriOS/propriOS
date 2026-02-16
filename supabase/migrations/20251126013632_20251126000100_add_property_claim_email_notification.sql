/*
  # Add Email Notification for Property Claims

  This migration adds a trigger to send email notifications to agents when they
  receive a new property claim opportunity.

  ## Changes
  - Create function to send email notification via edge function
  - Create trigger on agent_claim_notifications to send emails
*/

-- Function to send property claim notification email
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
  v_supabase_url text;
BEGIN
  -- Get Supabase URL from environment
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  IF v_supabase_url IS NULL THEN
    v_supabase_url := 'https://your-project.supabase.co';
  END IF;

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
      url := v_supabase_url || '/functions/v1/send-property-claim-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
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
END;
$$;

-- Create trigger to send email notification
DROP TRIGGER IF EXISTS trigger_send_property_claim_email ON agent_claim_notifications;
CREATE TRIGGER trigger_send_property_claim_email
  AFTER INSERT ON agent_claim_notifications
  FOR EACH ROW
  EXECUTE FUNCTION send_property_claim_email_notification();
