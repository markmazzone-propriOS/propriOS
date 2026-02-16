/*
  # Fix Auto-Approve Claim to Assign Seller to Agent

  ## Overview
  When an agent claims a property, the auto_approve_first_claim() function assigns
  the agent to the property but doesn't update the seller's assigned_agent_id field.
  This means the seller doesn't show up in the agent's "Assigned Sellers" list.

  ## Changes
  - Update auto_approve_first_claim() to also set the seller's assigned_agent_id
  - This ensures sellers appear in the agent's client list after property claim
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

    -- Assign agent to seller (if property has a seller)
    IF v_property.seller_id IS NOT NULL THEN
      UPDATE profiles
      SET assigned_agent_id = NEW.agent_id
      WHERE id = v_property.seller_id;
    END IF;

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