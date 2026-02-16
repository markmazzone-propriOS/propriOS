/*
  # Add offer activity tracking

  1. Changes
    - Create a trigger to log offer submissions to the activities table
    - This replaces the broken HTTP notification trigger
    - Agents will see new offers in their activity feed

  2. Security
    - Function uses SECURITY DEFINER to bypass RLS when creating activities
*/

CREATE OR REPLACE FUNCTION log_offer_to_activities()
RETURNS TRIGGER AS $$
DECLARE
  v_agent_id uuid;
  v_property_address text;
  v_buyer_name text;
BEGIN
  -- Get agent and property info
  SELECT agent_id, address INTO v_agent_id, v_property_address
  FROM properties
  WHERE id = NEW.property_id;

  -- Get buyer name
  SELECT full_name INTO v_buyer_name
  FROM profiles
  WHERE id = NEW.buyer_id;

  -- Create activity for agent if property has an agent
  IF v_agent_id IS NOT NULL THEN
    INSERT INTO activities (
      user_id,
      activity_type,
      description,
      property_id,
      related_user_id
    ) VALUES (
      v_agent_id,
      'offer_received',
      v_buyer_name || ' submitted an offer of $' || NEW.offer_amount || ' on ' || v_property_address,
      NEW.property_id,
      NEW.buyer_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_log_offer_to_activities ON property_offers;
CREATE TRIGGER trigger_log_offer_to_activities
  AFTER INSERT ON property_offers
  FOR EACH ROW
  EXECUTE FUNCTION log_offer_to_activities();