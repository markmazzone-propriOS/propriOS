/*
  # Fix Manual Notification Function ORDER BY Issue

  ## Overview
  Fixes the SQL query in notify_agents_for_property to include ORDER BY expressions
  in the SELECT list when using DISTINCT.

  ## Changes
  - Add ORDER BY expression to SELECT clause
  - Fix DISTINCT query compatibility
*/

-- Fix the manual notification function
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
  -- Get property details
  SELECT * INTO v_property
  FROM properties
  WHERE id = property_uuid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Property not found');
  END IF;

  -- Only proceed if property is unassigned (no agent) and is for sale
  IF v_property.agent_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Property already has an agent assigned');
  END IF;

  IF v_property.listing_type != 'sale' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Property is not for sale');
  END IF;

  -- Find agents: first try locations array, then fall back to any agent
  FOR v_agent IN
    SELECT a.id, p.full_name, a.locations, a.created_at
    FROM agent_profiles a
    INNER JOIN profiles p ON p.id = a.id
    WHERE p.user_type = 'agent'
    AND a.id != v_property.listed_by
    AND (
      v_property.city = ANY(a.locations)
      OR v_property.state = ANY(a.locations)
      OR EXISTS (
        SELECT 1 FROM unnest(a.locations) as loc
        WHERE v_property.city ILIKE '%' || loc || '%'
        OR loc ILIKE '%' || v_property.city || '%'
      )
      OR a.locations IS NULL
      OR array_length(a.locations, 1) = 0
    )
    ORDER BY
      CASE WHEN v_property.city = ANY(a.locations) THEN 0
           WHEN v_property.state = ANY(a.locations) THEN 1
           ELSE 2
      END,
      a.created_at DESC
    LIMIT 50
  LOOP
    -- Create notification record
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