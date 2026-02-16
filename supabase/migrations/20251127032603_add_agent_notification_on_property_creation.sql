/*
  # Add Agent Notification on Property Creation

  ## Overview
  This migration adds functionality to notify nearby agents when a new unassigned property
  is created (not just when a buyer views it). This gives agents immediate awareness of
  new claim opportunities.

  ## Changes
  - Create function to notify nearby agents when property is created
  - Create trigger on properties table to fire on INSERT
  - Only notifies for unassigned properties (agent_id IS NULL)
  
  ## Notes
  - Uses a synthetic buyer_id (the property creator) for the notification
  - Agents get notified immediately upon property creation
  - First agent to claim gets automatically assigned
*/

-- Function to notify nearby agents when new unassigned property is created
CREATE OR REPLACE FUNCTION notify_agents_on_property_creation()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_agent RECORD;
  v_notification_count integer := 0;
BEGIN
  -- Only proceed if property is unassigned (no agent) and is for sale
  IF NEW.agent_id IS NOT NULL OR NEW.listing_type != 'sale' THEN
    RETURN NEW;
  END IF;

  -- Find nearby agents (within same state, prioritize same city)
  FOR v_agent IN
    SELECT DISTINCT a.id, a.city, a.state, p.full_name
    FROM agent_profiles a
    INNER JOIN profiles p ON p.id = a.id
    WHERE a.state = NEW.state
    AND p.user_type = 'agent'
    AND a.id != NEW.listed_by
    ORDER BY
      CASE WHEN a.city = NEW.city THEN 0 ELSE 1 END,
      a.created_at DESC
    LIMIT 20
  LOOP
    -- Create notification record
    -- Use the property creator (listed_by) as the "buyer" for notification tracking
    INSERT INTO agent_claim_notifications (
      property_id,
      agent_id,
      buyer_id,
      notified_at,
      viewed
    ) VALUES (
      NEW.id,
      v_agent.id,
      NEW.listed_by,
      now(),
      false
    )
    ON CONFLICT (property_id, agent_id, buyer_id) DO NOTHING;

    v_notification_count := v_notification_count + 1;
  END LOOP;

  -- Log how many agents were notified
  IF v_notification_count > 0 THEN
    RAISE NOTICE 'Notified % agents about new property at %', v_notification_count, NEW.address_line1;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for new property creation
DROP TRIGGER IF EXISTS trigger_notify_agents_on_creation ON properties;
CREATE TRIGGER trigger_notify_agents_on_creation
  AFTER INSERT ON properties
  FOR EACH ROW
  EXECUTE FUNCTION notify_agents_on_property_creation();