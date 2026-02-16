/*
  # Restructure Seller Journey Stages

  1. Changes
    - Split inspection_appraisal into separate inspection and appraisal stages
    - Remove final_steps as a separate stage
    - Rename closing to final_steps_closing
    - Add new columns: inspection_completed, inspection_date, appraisal_completed, appraisal_date
    - Update valid_stage constraint to reflect new stages
    - Migrate existing data to new structure

  2. New Stages
    - preparation
    - listed
    - showings
    - offer_received
    - under_contract
    - inspection (new - split from inspection_appraisal)
    - appraisal (new - split from inspection_appraisal)
    - final_steps_closing (renamed from closing)

  3. Security
    - No changes to RLS policies
*/

-- Add new columns for separate inspection and appraisal tracking
ALTER TABLE seller_journey_progress
ADD COLUMN IF NOT EXISTS inspection_completed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS inspection_date timestamptz,
ADD COLUMN IF NOT EXISTS appraisal_completed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS appraisal_date timestamptz;

-- Migrate existing inspection_appraisal data to both new fields
UPDATE seller_journey_progress
SET 
  inspection_completed = inspection_appraisal_completed,
  inspection_date = inspection_appraisal_date,
  appraisal_completed = inspection_appraisal_completed,
  appraisal_date = inspection_appraisal_date
WHERE inspection_appraisal_completed = true
  AND (inspection_completed = false OR appraisal_completed = false);

-- Drop the old constraint
ALTER TABLE seller_journey_progress DROP CONSTRAINT IF EXISTS valid_stage;

-- Update current_stage values for records that are on old stages
UPDATE seller_journey_progress
SET current_stage = 'inspection'
WHERE current_stage = 'inspection_appraisal';

UPDATE seller_journey_progress
SET current_stage = 'final_steps_closing'
WHERE current_stage IN ('final_steps', 'closing', 'completed');

-- Add new constraint with updated stages
ALTER TABLE seller_journey_progress
ADD CONSTRAINT valid_stage CHECK (current_stage IN (
  'preparation',
  'listed',
  'showings',
  'offer_received',
  'under_contract',
  'inspection',
  'appraisal',
  'final_steps_closing'
));

-- Update the property listing trigger to use new stage names
CREATE OR REPLACE FUNCTION auto_update_seller_journey_on_property_list()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- When a property status changes to 'active', mark listed stage as complete
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    INSERT INTO seller_journey_progress (seller_id, property_id, current_stage, listed, listed_date)
    VALUES (NEW.seller_id, NEW.id, 'listed', true, now())
    ON CONFLICT (seller_id, property_id)
    DO UPDATE SET
      listed = true,
      listed_date = COALESCE(seller_journey_progress.listed_date, now()),
      current_stage = CASE
        WHEN seller_journey_progress.current_stage = 'preparation' THEN 'listed'
        ELSE seller_journey_progress.current_stage
      END,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;
