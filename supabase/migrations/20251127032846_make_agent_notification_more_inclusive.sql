/*
  # Make Agent Notifications More Inclusive

  ## Overview
  Updates all notification functions to be more inclusive when matching agents.
  If no agents match by location, send notifications to all agents in the database.

  ## Changes
  - Update notify_agents_for_property to include all agents if no location match
  - Update notify_agents_on_property_creation to include all agents if no location match
  - Ensures agents always get opportunities even if locations aren't perfectly configured
*/

-- Update manual notification function to be more inclusive
CREATE OR REPLACE FUNCTION notify_agents_for_property(property_uuid uuid)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_property RECORD;
  v_agent RECORD;
  v_notification_count integer := 0;
  v_result jsonb;
BEGIN
  SELECT * INTO v_property
  FROM properties
  WHERE id = property_uuid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Property not found');
  END IF;

  IF v_property.agent_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Property already has an agent assigned');
  END IF;

  IF v_property.listing_type != 'sale' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Property is not for sale');
  END IF;

  -- Notify all active agents (up to 50)
  FOR v_agent IN
    SELECT a.id, p.full_name, a.locations, a.created_at
    FROM agent_profiles a
    INNER JOIN profiles p ON p.id = a.id
    WHERE p.user_type = 'agent'
    AND a.id != v_property.listed_by
    AND (p.is_suspended IS NULL OR p.is_suspended = false)
    ORDER BY
      CASE 
        WHEN v_property.city = ANY(a.locations) THEN 0
        WHEN v_property.state = ANY(a.locations) THEN 1
        WHEN EXISTS (
          SELECT 1 FROM unnest(a.locations) as loc
          WHERE v_property.city ILIKE '%' || loc || '%'
          OR loc ILIKE '%' || v_property.city || '%'
        ) THEN 2
        ELSE 3
      END,
      a.created_at DESC
    LIMIT 50
  LOOP
    INSERT INTO agent_claim_notifications (
      property_id,
      agent_id,
      buyer_id,
      notified_at,
      viewed
    ) VALUES (
      v_property.id,
      v_agent.id,
      v_property.listed_by,
      now(),
      false
    )
    ON CONFLICT (property_id, agent_id, buyer_id) DO NOTHING;

    v_notification_count := v_notification_count + 1;
  END LOOP;

  v_result := jsonb_build_object(
    'success', true,
    'property_id', v_property.id,
    'property_address', v_property.address_line1,
    'agents_notified', v_notification_count
  );

  RETURN v_result;
END;
$$;

-- Update creation notification to be more inclusive
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
  IF NEW.agent_id IS NOT NULL OR NEW.listing_type != 'sale' THEN
    RETURN NEW;
  END IF;

  -- Notify all active agents (up to 50)
  FOR v_agent IN
    SELECT a.id, p.full_name, a.locations
    FROM agent_profiles a
    INNER JOIN profiles p ON p.id = a.id
    WHERE p.user_type = 'agent'
    AND a.id != NEW.listed_by
    AND (p.is_suspended IS NULL OR p.is_suspended = false)
    ORDER BY
      CASE 
        WHEN NEW.city = ANY(a.locations) THEN 0
        WHEN NEW.state = ANY(a.locations) THEN 1
        WHEN EXISTS (
          SELECT 1 FROM unnest(a.locations) as loc
          WHERE NEW.city ILIKE '%' || loc || '%'
          OR loc ILIKE '%' || NEW.city || '%'
        ) THEN 2
        ELSE 3
      END,
      a.created_at DESC
    LIMIT 50
  LOOP
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

  IF v_notification_count > 0 THEN
    RAISE NOTICE 'Notified % agents about new property at %', v_notification_count, NEW.address_line1;
  END IF;

  RETURN NEW;
END;
$$;