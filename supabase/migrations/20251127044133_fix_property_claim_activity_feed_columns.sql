/*
  # Fix Property Claim Activity Feed Column Names

  ## Overview
  The auto_approve_first_claim() function is trying to insert into activity_feed
  with incorrect column names (related_entity_type, related_entity_id) when the
  actual columns are (reference_type, reference_id).

  ## Changes
  - Update auto_approve_first_claim() function to use correct column names
*/

CREATE OR REPLACE FUNCTION auto_approve_first_claim()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_property RECORD;
  v_existing_claims integer;
BEGIN
  -- Only proceed for new pending claims
  IF NEW.status != 'pending' OR TG_OP != 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Get property details
  SELECT * INTO v_property
  FROM properties
  WHERE id = NEW.property_id;

  -- Only proceed if property is unassigned
  IF v_property.agent_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Check if this is the first claim
  SELECT COUNT(*) INTO v_existing_claims
  FROM property_claim_requests
  WHERE property_id = NEW.property_id
  AND id != NEW.id;

  -- If this is the first claim, auto-approve it
  IF v_existing_claims = 0 THEN
    -- Update the claim to approved
    UPDATE property_claim_requests
    SET
      status = 'approved',
      approved_at = now(),
      approved_by = NEW.agent_id,
      updated_at = now()
    WHERE id = NEW.id;

    -- Assign agent to property
    UPDATE properties
    SET
      agent_id = NEW.agent_id,
      updated_at = now()
    WHERE id = NEW.property_id;

    -- Create activity feed entry for agent
    INSERT INTO activity_feed (
      user_id,
      activity_type,
      title,
      description,
      reference_type,
      reference_id,
      created_at
    ) VALUES (
      NEW.agent_id,
      'property_claimed',
      'Property Claimed',
      'You successfully claimed a new property listing at ' || v_property.address_line1,
      'property',
      NEW.property_id,
      now()
    );

    -- Return the updated record
    SELECT * INTO NEW FROM property_claim_requests WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;