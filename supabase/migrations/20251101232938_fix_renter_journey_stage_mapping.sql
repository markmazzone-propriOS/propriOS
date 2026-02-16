/*
  # Fix Renter Journey Stage Mapping

  ## Overview
  Updates the trigger to map rental application statuses to the correct
  renter journey stage names that match the table's check constraint.

  ## Changes
  - Fix stage mapping to use valid stages:
    - budget_determination
    - property_search
    - viewing_scheduled
    - application_submitted
    - background_check
    - lease_signing
    - deposit_payment
    - move_in_inspection
    - completed
*/

-- Fix the trigger to use correct stage names
CREATE OR REPLACE FUNCTION update_renter_journey_from_application() RETURNS TRIGGER AS $$
DECLARE
  v_journey_stage text;
BEGIN
  -- Map application status to journey stage (using valid stages from check constraint)
  CASE NEW.status
    WHEN 'interested' THEN v_journey_stage := 'property_search';
    WHEN 'applied' THEN v_journey_stage := 'application_submitted';
    WHEN 'background_check' THEN v_journey_stage := 'background_check';
    WHEN 'approved' THEN v_journey_stage := 'lease_signing';
    WHEN 'rejected' THEN v_journey_stage := 'property_search';
    WHEN 'lease_signed' THEN v_journey_stage := 'deposit_payment';
    WHEN 'active' THEN v_journey_stage := 'move_in_inspection';
    WHEN 'completed' THEN v_journey_stage := 'completed';
    ELSE v_journey_stage := 'property_search';
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
