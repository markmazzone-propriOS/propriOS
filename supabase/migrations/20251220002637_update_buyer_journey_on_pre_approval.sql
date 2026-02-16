/*
  # Update Buyer Journey on Pre-Approval Approval

  ## Overview
  Automatically updates the buyer journey tracker when a pre-approval request
  is approved by a lender. This marks the pre-approval stage as completed and
  advances the buyer to the house hunting stage.

  ## Changes
  1. Creates trigger function to update buyer journey on pre-approval approval
  2. Creates trigger on pre_approval_requests table
  3. Ensures journey record exists or creates one
  4. Updates pre-approval stage completion and advances to house hunting

  ## Security
  - Function uses SECURITY DEFINER to bypass RLS for system updates
  - Only triggers on status change to 'approved'
*/

-- Function to update buyer journey when pre-approval is approved
CREATE OR REPLACE FUNCTION update_buyer_journey_on_pre_approval_approval()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_journey_id uuid;
BEGIN
  -- Only proceed if status changed to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    -- Check if buyer has a journey record
    SELECT id INTO v_journey_id
    FROM buyer_journey_progress
    WHERE buyer_id = NEW.buyer_id
    LIMIT 1;

    -- If no journey exists, create one
    IF v_journey_id IS NULL THEN
      INSERT INTO buyer_journey_progress (
        buyer_id,
        current_stage,
        pre_approval_completed,
        pre_approval_date,
        house_hunting_started,
        house_hunting_date
      )
      VALUES (
        NEW.buyer_id,
        'house_hunting',
        true,
        NOW(),
        true,
        NOW()
      );
    ELSE
      -- Update existing journey record
      UPDATE buyer_journey_progress
      SET
        pre_approval_completed = true,
        pre_approval_date = COALESCE(pre_approval_date, NOW()),
        current_stage = CASE
          WHEN current_stage = 'pre_approval' THEN 'house_hunting'
          ELSE current_stage
        END,
        house_hunting_started = true,
        house_hunting_date = COALESCE(house_hunting_date, NOW()),
        updated_at = NOW()
      WHERE id = v_journey_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trigger_update_buyer_journey_on_pre_approval ON pre_approval_requests;

-- Create trigger on pre_approval_requests
CREATE TRIGGER trigger_update_buyer_journey_on_pre_approval
  AFTER INSERT OR UPDATE OF status ON pre_approval_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_buyer_journey_on_pre_approval_approval();
