/*
  # Fix Agent Notification to Use Locations Array

  ## Overview
  This migration fixes the agent notification trigger to properly use the locations array
  field instead of non-existent city/state fields in agent_profiles.

  ## Changes
  - Update both notification functions to use the locations array
  - Match agents where property city is in their locations array
  - If no city match, match by state in locations
*/

-- Fix function for property creation notifications
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

  -- Find nearby agents (where property location is in their service areas)
  FOR v_agent IN
    SELECT DISTINCT a.id, p.full_name, a.locations
    FROM agent_profiles a
    INNER JOIN profiles p ON p.id = a.id
    WHERE p.user_type = 'agent'
    AND a.id != NEW.listed_by
    AND (
      -- Agent serves the property city
      NEW.city = ANY(a.locations)
      OR
      -- Agent serves the property state
      NEW.state = ANY(a.locations)
      OR
      -- Agent serves a broader region that includes the city
      EXISTS (
        SELECT 1 FROM unnest(a.locations) as loc
        WHERE NEW.city ILIKE '%' || loc || '%'
        OR NEW.state ILIKE '%' || loc || '%'
      )
    )
    ORDER BY
      -- Prioritize exact city match
      CASE WHEN NEW.city = ANY(a.locations) THEN 0 ELSE 1 END,
      a.created_at DESC
    LIMIT 20
  LOOP
    -- Create notification record
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

-- Fix function for property view notifications
CREATE OR REPLACE FUNCTION notify_nearby_agents_on_property_view()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_property RECORD;
  v_buyer RECORD;
  v_agent RECORD;
  v_notification_count integer := 0;
BEGIN
  -- Get property details
  SELECT p.*, p.agent_id, p.listing_type, p.city, p.state
  INTO v_property
  FROM properties p
  WHERE p.id = NEW.property_id;

  -- Only proceed if property is unassigned (no agent) and is for sale
  IF v_property.agent_id IS NOT NULL OR v_property.listing_type != 'sale' THEN
    RETURN NEW;
  END IF;

  -- Get buyer details
  SELECT * INTO v_buyer
  FROM profiles
  WHERE id = NEW.user_id
  AND user_type IN ('buyer', 'seller');

  -- Only proceed if viewer is a buyer
  IF v_buyer.id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find nearby agents (where property location is in their service areas)
  FOR v_agent IN
    SELECT DISTINCT a.id, p.full_name, a.locations
    FROM agent_profiles a
    INNER JOIN profiles p ON p.id = a.id
    WHERE p.user_type = 'agent'
    AND a.id != NEW.user_id
    AND (
      -- Agent serves the property city
      v_property.city = ANY(a.locations)
      OR
      -- Agent serves the property state
      v_property.state = ANY(a.locations)
      OR
      -- Agent serves a broader region that includes the city
      EXISTS (
        SELECT 1 FROM unnest(a.locations) as loc
        WHERE v_property.city ILIKE '%' || loc || '%'
        OR v_property.state ILIKE '%' || loc || '%'
      )
    )
    ORDER BY
      -- Prioritize exact city match
      CASE WHEN v_property.city = ANY(a.locations) THEN 0 ELSE 1 END,
      a.created_at DESC
    LIMIT 20
  LOOP
    -- Create notification record
    INSERT INTO agent_claim_notifications (
      property_id,
      agent_id,
      buyer_id,
      notified_at,
      viewed
    ) VALUES (
      NEW.property_id,
      v_agent.id,
      v_buyer.id,
      now(),
      false
    )
    ON CONFLICT (property_id, agent_id, buyer_id) DO NOTHING;

    v_notification_count := v_notification_count + 1;
  END LOOP;

  RETURN NEW;
END;
$$;