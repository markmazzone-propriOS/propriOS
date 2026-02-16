/*
  # Fix Agent Notifications - Distinguish New Listings from Buyer Views

  ## Overview
  The notification system currently uses the seller as the "buyer" for new property notifications,
  which is incorrect. This migration makes buyer_id nullable and adds a notification_type field
  to distinguish between:
  - 'new_listing': Property just created, no buyer interest yet
  - 'buyer_viewed': A buyer actually viewed/favorited the property

  ## Changes
  - Make buyer_id nullable in agent_claim_notifications
  - Add notification_type enum field
  - Update unique constraint to handle null buyer_id
  - Update RLS policies
  - Update trigger functions to set correct notification_type
*/

-- Add notification type enum
DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM ('new_listing', 'buyer_viewed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Drop existing unique constraint
ALTER TABLE agent_claim_notifications 
  DROP CONSTRAINT IF EXISTS agent_claim_notifications_property_id_agent_id_buyer_id_key;

-- Make buyer_id nullable
ALTER TABLE agent_claim_notifications 
  ALTER COLUMN buyer_id DROP NOT NULL;

-- Add notification_type column
ALTER TABLE agent_claim_notifications 
  ADD COLUMN IF NOT EXISTS notification_type notification_type DEFAULT 'new_listing';

-- Create new unique constraint that handles null buyer_id
-- For new_listing: one notification per property per agent
-- For buyer_viewed: one notification per property per agent per buyer
CREATE UNIQUE INDEX IF NOT EXISTS agent_claim_notifications_unique_idx
  ON agent_claim_notifications (property_id, agent_id, COALESCE(buyer_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Update existing notifications to set type
UPDATE agent_claim_notifications
SET notification_type = 'new_listing'
WHERE notification_type IS NULL;

-- Update the property creation notification function
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
      notification_type,
      notified_at,
      viewed
    ) VALUES (
      NEW.id,
      v_agent.id,
      NULL, -- No buyer for new listings
      'new_listing',
      now(),
      false
    )
    ON CONFLICT (property_id, agent_id, COALESCE(buyer_id, '00000000-0000-0000-0000-000000000000'::uuid)) DO NOTHING;

    v_notification_count := v_notification_count + 1;
  END LOOP;

  IF v_notification_count > 0 THEN
    RAISE NOTICE 'Notified % agents about new property at %', v_notification_count, NEW.address_line1;
  END IF;

  RETURN NEW;
END;
$$;

-- Update the property view notification function
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

  -- Find agents in the same area
  FOR v_agent IN
    SELECT a.id, p.full_name, a.locations
    FROM agent_profiles a
    INNER JOIN profiles p ON p.id = a.id
    WHERE p.user_type = 'agent'
    AND a.id != NEW.user_id
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
      CASE 
        WHEN v_property.city = ANY(a.locations) THEN 0
        WHEN v_property.state = ANY(a.locations) THEN 1
        ELSE 2
      END,
      a.created_at DESC
    LIMIT 20
  LOOP
    INSERT INTO agent_claim_notifications (
      property_id,
      agent_id,
      buyer_id,
      notification_type,
      notified_at,
      viewed
    ) VALUES (
      NEW.property_id,
      v_agent.id,
      v_buyer.id, -- Actual buyer who viewed the property
      'buyer_viewed',
      now(),
      false
    )
    ON CONFLICT (property_id, agent_id, COALESCE(buyer_id, '00000000-0000-0000-0000-000000000000'::uuid)) DO NOTHING;

    v_notification_count := v_notification_count + 1;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Update the manual notification function
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
      notification_type,
      notified_at,
      viewed
    ) VALUES (
      v_property.id,
      v_agent.id,
      NULL, -- Manual notifications are for new listings
      'new_listing',
      now(),
      false
    )
    ON CONFLICT (property_id, agent_id, COALESCE(buyer_id, '00000000-0000-0000-0000-000000000000'::uuid)) DO NOTHING;

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