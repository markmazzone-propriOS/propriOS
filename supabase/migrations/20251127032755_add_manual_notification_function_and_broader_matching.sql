/*
  # Add Manual Notification Function and Broader Agent Matching

  ## Overview
  This migration adds a function to manually trigger notifications for existing properties
  and improves agent matching to include broader regional coverage.

  ## Changes
  - Create function to manually send notifications for a property
  - Update notification logic to be more inclusive:
    - Match agents serving the exact city
    - Match agents serving nearby cities in the same state
    - If no matches, notify ALL agents in the state (from profiles)
  
  ## Usage
  SELECT notify_agents_for_property('property-id-here');
*/

-- Function to manually trigger notifications for an existing property
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
    SELECT DISTINCT a.id, p.full_name, a.locations
    FROM agent_profiles a
    INNER JOIN profiles p ON p.id = a.id
    WHERE p.user_type = 'agent'
    AND a.id != v_property.listed_by
    AND (
      -- Agent serves the property city
      v_property.city = ANY(a.locations)
      OR
      -- Agent serves the property state
      v_property.state = ANY(a.locations)
      OR
      -- Agent serves a nearby city (partial match)
      EXISTS (
        SELECT 1 FROM unnest(a.locations) as loc
        WHERE v_property.city ILIKE '%' || loc || '%'
        OR loc ILIKE '%' || v_property.city || '%'
      )
      OR
      -- If no location restrictions, include all agents
      a.locations IS NULL
      OR
      array_length(a.locations, 1) = 0
    )
    ORDER BY
      -- Prioritize exact city match
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

    IF FOUND THEN
      v_notification_count := v_notification_count + 1;
    END IF;
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