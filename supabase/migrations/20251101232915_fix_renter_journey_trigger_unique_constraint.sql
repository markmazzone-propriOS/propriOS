/*
  # Fix Renter Journey Trigger for Unique Constraint

  ## Overview
  Updates the trigger to work with the existing unique constraint on renter_id only.
  Since a renter can only have one journey at a time, we update based on renter_id.

  ## Changes
  - Fix update_renter_journey_from_application() to use ON CONFLICT (renter_id)
*/

-- Fix the trigger to use correct unique constraint
CREATE OR REPLACE FUNCTION update_renter_journey_from_application() RETURNS TRIGGER AS $$
DECLARE
  v_journey_stage text;
BEGIN
  -- Map application status to journey stage
  CASE NEW.status
    WHEN 'interested' THEN v_journey_stage := 'searching';
    WHEN 'applied' THEN v_journey_stage := 'application_submitted';
    WHEN 'background_check' THEN v_journey_stage := 'background_check';
    WHEN 'approved' THEN v_journey_stage := 'approved';
    WHEN 'lease_signed' THEN v_journey_stage := 'lease_signing';
    WHEN 'active' THEN v_journey_stage := 'moved_in';
    ELSE v_journey_stage := 'searching';
  END CASE;

  -- Update or create renter journey using correct unique constraint
  INSERT INTO renter_journey_progress (
    renter_id,
    property_id,
    current_stage,
    updated_at
  )
  VALUES (
    NEW.renter_id,
    NEW.property_id,
    v_journey_stage,
    now()
  )
  ON CONFLICT (renter_id) 
  DO UPDATE SET
    property_id = NEW.property_id,
    current_stage = v_journey_stage,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
