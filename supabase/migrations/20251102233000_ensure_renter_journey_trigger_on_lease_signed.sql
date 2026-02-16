/*
  # Ensure Renter Journey Updates on Lease Signed

  ## Overview
  Ensures that the renter journey tracker properly updates when a lease is signed.
  This migration recreates the trigger to ensure it's properly connected and
  verifies the function logic is correct.

  ## Changes
  1. Drop and recreate the trigger to ensure it's active
  2. Verify the function handles lease_signed status correctly
*/

-- Drop the existing trigger
DROP TRIGGER IF EXISTS on_application_status_change_update_journey ON rental_applications;

-- Recreate the trigger
CREATE TRIGGER on_application_status_change_update_journey
  AFTER INSERT OR UPDATE OF status ON rental_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_renter_journey_from_application();

-- Verify the function exists and has correct logic by recreating it
CREATE OR REPLACE FUNCTION update_renter_journey_from_application() RETURNS TRIGGER AS $$
DECLARE
  v_journey_stage text;
  v_lease_signed boolean := false;
  v_lease_signed_date timestamptz := null;
  v_background_check_completed boolean := false;
  v_background_check_date timestamptz := null;
  v_application_submitted boolean := false;
  v_application_submitted_date timestamptz := null;
BEGIN
  -- Map application status to journey stage
  CASE NEW.status
    WHEN 'interested' THEN v_journey_stage := 'property_search';
    WHEN 'applied' THEN
      v_journey_stage := 'application_submitted';
      v_application_submitted := true;
      v_application_submitted_date := COALESCE(NEW.application_submitted_at, now());
    WHEN 'background_check' THEN
      v_journey_stage := 'background_check';
      v_application_submitted := true;
      v_application_submitted_date := COALESCE(NEW.application_submitted_at, now());
      v_background_check_completed := true;
      v_background_check_date := now();
    WHEN 'approved' THEN
      v_journey_stage := 'lease_signing';
      v_application_submitted := true;
      v_application_submitted_date := COALESCE(NEW.application_submitted_at, now());
      v_background_check_completed := true;
      v_background_check_date := now();
    WHEN 'rejected' THEN v_journey_stage := 'property_search';
    WHEN 'lease_signed' THEN
      v_journey_stage := 'deposit_payment';
      v_application_submitted := true;
      v_application_submitted_date := COALESCE(NEW.application_submitted_at, now());
      v_background_check_completed := true;
      v_background_check_date := now();
      v_lease_signed := true;
      v_lease_signed_date := now();
    WHEN 'active' THEN
      v_journey_stage := 'move_in_inspection';
      v_application_submitted := true;
      v_application_submitted_date := COALESCE(NEW.application_submitted_at, now());
      v_background_check_completed := true;
      v_background_check_date := now();
      v_lease_signed := true;
      v_lease_signed_date := now();
    WHEN 'completed' THEN
      v_journey_stage := 'completed';
      v_application_submitted := true;
      v_application_submitted_date := COALESCE(NEW.application_submitted_at, now());
      v_background_check_completed := true;
      v_background_check_date := now();
      v_lease_signed := true;
      v_lease_signed_date := now();
    ELSE v_journey_stage := 'property_search';
  END CASE;

  -- Update or create renter journey
  INSERT INTO renter_journey_progress (
    renter_id,
    property_id,
    current_stage,
    application_submitted,
    application_submitted_date,
    background_check_completed,
    background_check_date,
    lease_signed,
    lease_signed_date,
    updated_at
  )
  VALUES (
    NEW.renter_id,
    NEW.property_id,
    v_journey_stage,
    v_application_submitted,
    v_application_submitted_date,
    v_background_check_completed,
    v_background_check_date,
    v_lease_signed,
    v_lease_signed_date,
    now()
  )
  ON CONFLICT (renter_id)
  DO UPDATE SET
    property_id = NEW.property_id,
    current_stage = v_journey_stage,
    application_submitted = GREATEST(renter_journey_progress.application_submitted, v_application_submitted),
    application_submitted_date = COALESCE(renter_journey_progress.application_submitted_date, v_application_submitted_date),
    background_check_completed = GREATEST(renter_journey_progress.background_check_completed, v_background_check_completed),
    background_check_date = COALESCE(renter_journey_progress.background_check_date, v_background_check_date),
    lease_signed = GREATEST(renter_journey_progress.lease_signed, v_lease_signed),
    lease_signed_date = COALESCE(renter_journey_progress.lease_signed_date, v_lease_signed_date),
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
