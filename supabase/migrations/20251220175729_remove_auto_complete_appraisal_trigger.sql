/*
  # Remove auto-complete appraisal trigger

  1. Changes
    - Drop the trigger that automatically marks appraisal as completed after inspection
    - Appraisal will now remain as a separate manual step in the buyer journey
    - Buyers must explicitly complete the appraisal step

  2. Behavior
    - Inspection and appraisal are now independent steps
    - Each step must be completed separately
*/

-- Drop the trigger
DROP TRIGGER IF EXISTS trigger_auto_complete_appraisal ON buyer_journey_progress;

-- Drop the function
DROP FUNCTION IF EXISTS auto_complete_appraisal();
