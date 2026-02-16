/*
  # Auto-complete appraisal after inspection
  
  1. Changes
    - Add trigger to automatically mark appraisal as completed when inspection is completed
    - This streamlines the buyer journey by automatically progressing through related stages
    
  2. Behavior
    - When inspection_completed is set to true, appraisal_completed is also set to true
    - Appraisal date is set to the same time as inspection date
    - Current stage automatically advances to loan_approval
*/

CREATE OR REPLACE FUNCTION auto_complete_appraisal()
RETURNS TRIGGER AS $$
BEGIN
  -- When inspection is marked complete, also mark appraisal complete
  IF NEW.inspection_completed = true AND (OLD.inspection_completed = false OR OLD.inspection_completed IS NULL) THEN
    NEW.appraisal_completed := true;
    NEW.appraisal_date := COALESCE(NEW.appraisal_date, NEW.inspection_date, NOW());
    NEW.current_stage := 'loan_approval';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_complete_appraisal
  BEFORE UPDATE ON buyer_journey_progress
  FOR EACH ROW
  EXECUTE FUNCTION auto_complete_appraisal();