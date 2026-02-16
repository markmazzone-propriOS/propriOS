/*
  # Create Pre-Approval Status Notifications

  ## Overview
  Automatically creates activity feed notifications for buyers when their
  pre-approval request is approved or denied by a lender.

  ## Changes
  1. Creates trigger function to notify buyers of pre-approval status changes
  2. Creates trigger on pre_approval_requests table
  3. Notifications appear in buyer's activity feed with appropriate details

  ## Security
  - Function uses SECURITY DEFINER to bypass RLS for system notifications
  - Only triggers on status changes to 'approved' or 'denied'
  - Uses existing create_activity function for consistency
*/

-- Function to notify buyer of pre-approval status change
CREATE OR REPLACE FUNCTION notify_buyer_pre_approval_status()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_title text;
  v_description text;
  v_activity_type text;
BEGIN
  -- Only proceed if status changed to 'approved' or 'denied'
  IF (NEW.status IN ('approved', 'denied')) AND 
     (OLD.status IS NULL OR OLD.status NOT IN ('approved', 'denied')) THEN
    
    -- Set notification content based on status
    IF NEW.status = 'approved' THEN
      v_activity_type := 'pre_approval_approved';
      v_title := 'Pre-Approval Request Approved';
      
      IF NEW.approved_amount IS NOT NULL THEN
        v_description := 'Your pre-approval request has been approved for $' || 
                        TO_CHAR(NEW.approved_amount, 'FM999,999,999') || 
                        '. You can now start house hunting with confidence!';
      ELSE
        v_description := 'Your pre-approval request has been approved! You can now start house hunting with confidence.';
      END IF;
    ELSE
      -- Status is 'denied'
      v_activity_type := 'pre_approval_denied';
      v_title := 'Pre-Approval Request Update';
      v_description := 'Your pre-approval request has been reviewed. Please contact your lender for more information.';
    END IF;

    -- Create activity notification
    PERFORM create_activity(
      NEW.buyer_id,                    -- user_id (buyer receives notification)
      NEW.lender_id,                   -- actor_id (lender who made decision)
      v_activity_type,                 -- activity_type
      v_title,                         -- title
      v_description,                   -- description
      NEW.id,                          -- reference_id
      'pre_approval_request',          -- reference_type
      jsonb_build_object(
        'status', NEW.status,
        'approved_amount', NEW.approved_amount,
        'actual_credit_score', NEW.actual_credit_score
      )                                -- metadata
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trigger_notify_buyer_pre_approval_status ON pre_approval_requests;

-- Create trigger on pre_approval_requests
CREATE TRIGGER trigger_notify_buyer_pre_approval_status
  AFTER INSERT OR UPDATE OF status ON pre_approval_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_buyer_pre_approval_status();
