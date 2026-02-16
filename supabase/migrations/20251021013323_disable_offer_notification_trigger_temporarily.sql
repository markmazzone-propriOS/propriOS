/*
  # Disable offer notification trigger temporarily

  1. Changes
    - Drop the trigger that sends HTTP notifications
    - This trigger is causing "out of memory" errors
    - We'll handle notifications through activities instead

  2. Notes
    - The trigger was trying to call an edge function via HTTP
    - The HTTP call is failing and causing memory issues
    - Activities table will track offer submissions instead
*/

DROP TRIGGER IF EXISTS trigger_notify_agent_of_new_offer ON property_offers;
DROP FUNCTION IF EXISTS notify_agent_of_new_offer();