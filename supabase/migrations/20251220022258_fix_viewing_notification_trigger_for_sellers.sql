/*
  # Fix Viewing Notification Trigger for Seller Viewings

  1. Changes
    - Update trigger to only fire for agent viewings, not seller viewings
    - This prevents the trigger from trying to send emails when sellers receive viewing requests
    - Sellers manage their viewings through the SellerCalendar interface

  2. Security
    - Maintains existing agent notification functionality
    - Prevents errors when buyers schedule viewings with sellers directly
*/

-- Update the trigger condition to only fire when there's an agent_id
DROP TRIGGER IF EXISTS send_agent_viewing_notification_trigger ON calendar_events;

CREATE TRIGGER send_agent_viewing_notification_trigger
  AFTER INSERT ON calendar_events
  FOR EACH ROW
  WHEN (NEW.event_type = 'viewing' AND NEW.property_id IS NOT NULL AND NEW.agent_id IS NOT NULL)
  EXECUTE FUNCTION notify_agent_of_viewing_via_email();
