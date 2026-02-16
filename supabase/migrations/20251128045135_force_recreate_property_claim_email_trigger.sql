/*
  # Force Recreate Property Claim Email Trigger

  ## Overview
  The trigger exists but is not firing. This migration will:
  - Drop the existing trigger completely
  - Recreate it to ensure it's properly attached
  - Add logging to verify it works

  ## Changes
  - Drop and recreate trigger on agent_claim_notifications table
  - Ensure trigger fires AFTER INSERT for each row
*/

-- Drop the existing trigger
DROP TRIGGER IF EXISTS trigger_send_property_claim_email ON agent_claim_notifications;

-- Recreate the trigger
CREATE TRIGGER trigger_send_property_claim_email
  AFTER INSERT ON agent_claim_notifications
  FOR EACH ROW
  EXECUTE FUNCTION send_property_claim_email_notification();

-- Log that trigger was recreated
DO $$
BEGIN
  RAISE NOTICE 'Property claim email trigger recreated successfully';
END $$;