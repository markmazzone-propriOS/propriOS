/*
  # Fix Seller Closing Checklist Completion Trigger

  ## Problem
  The `check_seller_closing_checklist_completion` function tries to set 
  `current_stage = 'completed'` when all required checklist items are done,
  but 'completed' is not a valid stage in the seller_journey_progress table.

  ## Changes
  - Update the function to NOT change the current_stage (it should already be 'final_steps_closing')
  - Only mark closing_completed = true and set closing_date
  - This allows checklist items to be updated without constraint violations
*/

CREATE OR REPLACE FUNCTION check_seller_closing_checklist_completion()
RETURNS TRIGGER AS $$
DECLARE
  total_required INTEGER;
  total_completed INTEGER;
BEGIN
  SELECT 
    COUNT(*) FILTER (WHERE is_required = true),
    COUNT(*) FILTER (WHERE is_required = true AND is_completed = true)
  INTO total_required, total_completed
  FROM seller_closing_checklist_items
  WHERE seller_id = NEW.seller_id
  AND (property_id = NEW.property_id OR (property_id IS NULL AND NEW.property_id IS NULL));

  -- When all required items are complete, mark closing as completed
  -- but keep current_stage as 'final_steps_closing'
  IF total_required > 0 AND total_completed = total_required THEN
    UPDATE seller_journey_progress
    SET 
      closing_completed = true,
      closing_date = now(),
      updated_at = now()
    WHERE seller_id = NEW.seller_id
    AND (property_id = NEW.property_id OR (property_id IS NULL AND NEW.property_id IS NULL))
    AND closing_completed = false;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
