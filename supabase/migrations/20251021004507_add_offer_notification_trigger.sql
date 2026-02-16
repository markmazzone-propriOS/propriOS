/*
  # Add Offer Notification Trigger

  1. Changes
    - Create a trigger function that sends an email notification to the agent when a buyer submits an offer
    - The function calls the send-offer-notification edge function with buyer, property, and offer details
    - Trigger fires after an offer is inserted into the property_offers table

  2. Security
    - No changes to RLS policies
*/

CREATE OR REPLACE FUNCTION notify_agent_of_new_offer()
RETURNS TRIGGER AS $$
DECLARE
  v_agent_email text;
  v_agent_name text;
  v_buyer_name text;
  v_property_address text;
  v_supabase_url text;
  v_service_role_key text;
BEGIN
  SELECT email, full_name INTO v_agent_email, v_agent_name
  FROM auth.users
  JOIN profiles ON profiles.id = auth.users.id
  WHERE profiles.id = NEW.agent_id;

  SELECT full_name INTO v_buyer_name
  FROM profiles
  WHERE id = NEW.buyer_id;

  SELECT address INTO v_property_address
  FROM properties
  WHERE id = NEW.property_id;

  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_service_role_key := current_setting('app.settings.service_role_key', true);

  IF v_supabase_url IS NULL THEN
    v_supabase_url := '';
  END IF;

  IF v_service_role_key IS NULL THEN
    v_service_role_key := '';
  END IF;

  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/send-offer-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := jsonb_build_object(
      'agent_email', v_agent_email,
      'agent_name', v_agent_name,
      'buyer_name', v_buyer_name,
      'property_address', v_property_address,
      'offer_amount', NEW.offer_amount,
      'property_id', NEW.property_id
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_agent_of_new_offer ON property_offers;

CREATE TRIGGER trigger_notify_agent_of_new_offer
  AFTER INSERT ON property_offers
  FOR EACH ROW
  EXECUTE FUNCTION notify_agent_of_new_offer();
