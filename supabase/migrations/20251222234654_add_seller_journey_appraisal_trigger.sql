/*
  # Add Seller Journey Appraisal Trigger

  1. Changes
    - Create trigger to update seller journey when buyer schedules an appraisal
    - When an appraisal request is created or scheduled, update the seller's journey
    - Mark appraisal stage as active and update current_stage if needed

  2. Automation
    - When buyer creates appraisal request with status 'scheduled' or 'pending'
    - Find the property's seller_id and update their journey progress
    - Move to 'appraisal' stage if they are on 'inspection' stage
    - Mark appraisal_completed = true and set appraisal_date when status is 'scheduled'

  3. Security
    - Function uses SECURITY DEFINER to update seller journey
    - Only triggers on INSERT or UPDATE of buyer_appraisal_requests
*/

-- Create function to update seller journey when appraisal is scheduled
CREATE OR REPLACE FUNCTION update_seller_journey_on_appraisal_scheduled()
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
      appraisal_completed,
      appraisal_date
    )
    VALUES (
      v_seller_id,
      NEW.property_id,
      'appraisal',
      true,
      now()
    )
    ON CONFLICT (seller_id, property_id)
    DO UPDATE SET
      -- Mark appraisal as completed when status is 'scheduled', 'in_progress', or 'completed'
      appraisal_completed = CASE
        WHEN NEW.status IN ('scheduled', 'in_progress', 'completed') THEN true
        ELSE seller_journey_progress.appraisal_completed
      END,
      appraisal_date = CASE
        WHEN NEW.status IN ('scheduled', 'in_progress', 'completed') AND seller_journey_progress.appraisal_date IS NULL THEN now()
        ELSE seller_journey_progress.appraisal_date
      END,
      -- Update current stage if still on inspection
      current_stage = CASE
        WHEN seller_journey_progress.current_stage = 'inspection' AND NEW.status IN ('scheduled', 'in_progress', 'completed') THEN 'appraisal'
        ELSE seller_journey_progress.current_stage
      END,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_seller_journey_on_appraisal_trigger ON buyer_appraisal_requests;

-- Create trigger on buyer_appraisal_requests
CREATE TRIGGER update_seller_journey_on_appraisal_trigger
  AFTER INSERT OR UPDATE OF status ON buyer_appraisal_requests
  FOR EACH ROW
  WHEN (NEW.status IN ('scheduled', 'in_progress', 'completed'))
  EXECUTE FUNCTION update_seller_journey_on_appraisal_scheduled();
