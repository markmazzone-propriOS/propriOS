/*
  # Add Seller Journey Inspection Trigger

  1. Changes
    - Create trigger to update seller journey when buyer schedules an inspection
    - When an inspection request is created or scheduled, update the seller's journey
    - Mark inspection stage as active and update current_stage if needed

  2. Automation
    - When buyer creates inspection request with status 'scheduled' or 'pending'
    - Find the property's seller_id and update their journey progress
    - Move to 'inspection' stage if they are on 'under_contract' stage
    - Mark inspection_completed = true and set inspection_date when status is 'scheduled'

  3. Security
    - Function uses SECURITY DEFINER to update seller journey
    - Only triggers on INSERT or UPDATE of buyer_inspection_requests
*/

-- Create function to update seller journey when inspection is scheduled
CREATE OR REPLACE FUNCTION update_seller_journey_on_inspection_scheduled()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_seller_id uuid;
BEGIN
  -- Get the seller_id for the property
  SELECT seller_id INTO v_seller_id
  FROM properties
  WHERE id = NEW.property_id;

  -- Only proceed if we found a seller
  IF v_seller_id IS NOT NULL THEN
    -- Create or update seller journey progress
    INSERT INTO seller_journey_progress (
      seller_id,
      property_id,
      current_stage,
      inspection_completed,
      inspection_date
    )
    VALUES (
      v_seller_id,
      NEW.property_id,
      'inspection',
      true,
      now()
    )
    ON CONFLICT (seller_id, property_id)
    DO UPDATE SET
      -- Mark inspection as completed when status is 'scheduled', 'in_progress', or 'completed'
      inspection_completed = CASE
        WHEN NEW.status IN ('scheduled', 'in_progress', 'completed') THEN true
        ELSE seller_journey_progress.inspection_completed
      END,
      inspection_date = CASE
        WHEN NEW.status IN ('scheduled', 'in_progress', 'completed') AND seller_journey_progress.inspection_date IS NULL THEN now()
        ELSE seller_journey_progress.inspection_date
      END,
      -- Update current stage if still on under_contract
      current_stage = CASE
        WHEN seller_journey_progress.current_stage = 'under_contract' AND NEW.status IN ('scheduled', 'in_progress', 'completed') THEN 'inspection'
        ELSE seller_journey_progress.current_stage
      END,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_seller_journey_on_inspection_trigger ON buyer_inspection_requests;

-- Create trigger on buyer_inspection_requests
CREATE TRIGGER update_seller_journey_on_inspection_trigger
  AFTER INSERT OR UPDATE OF status ON buyer_inspection_requests
  FOR EACH ROW
  WHEN (NEW.status IN ('scheduled', 'in_progress', 'completed'))
  EXECUTE FUNCTION update_seller_journey_on_inspection_scheduled();
