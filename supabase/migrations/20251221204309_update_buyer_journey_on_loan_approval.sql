/*
  # Update Buyer Journey on Loan Approval

  1. Changes
    - Modify the trigger function for loan_applications to update the buyer journey
    - When loan application status is set to 'approved', mark loan_approved as true
    - This will automatically move the buyer to the Closing stage (handled by existing auto_update_buyer_journey_stage trigger)

  2. Notes
    - The existing auto_update_buyer_journey_stage trigger will automatically move current_stage to 'closing' when loan_approved becomes true
    - This ensures the journey tracker shows Loan Approval as complete (green) and advances to Closing
*/

-- Update the function to handle loan application approvals
CREATE OR REPLACE FUNCTION update_journey_on_loan_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle loan application approval (full application)
  IF TG_TABLE_NAME = 'loan_applications' THEN
    IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
      -- Update the buyer journey to mark loan as approved
      UPDATE buyer_journey_progress
      SET
        loan_approved = true,
        loan_approved_date = COALESCE(loan_approved_date, NEW.approval_date, now())
      WHERE buyer_id = NEW.buyer_id;
    END IF;
  END IF;

  -- Handle pre-approval approval (separate from full loan approval)
  IF TG_TABLE_NAME = 'pre_approval_requests' THEN
    IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
      UPDATE buyer_journey_progress
      SET
        pre_approval_completed = true,
        pre_approval_date = COALESCE(pre_approval_date, NEW.approval_date, now())
      WHERE buyer_id = NEW.buyer_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the old trigger on loan_applications if it exists
DROP TRIGGER IF EXISTS trigger_journey_on_loan_approval ON loan_applications;

-- Create new trigger for loan applications
CREATE TRIGGER trigger_journey_on_loan_approval
  AFTER UPDATE ON loan_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_journey_on_loan_approval();

-- Update the pre-approval trigger to use the new function name
DROP TRIGGER IF EXISTS trigger_journey_on_pre_approval ON pre_approval_requests;

CREATE TRIGGER trigger_journey_on_pre_approval
  AFTER UPDATE ON pre_approval_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_journey_on_loan_approval();