/*
  # Temporarily Disable Offer Triggers for Debugging

  1. Changes
    - Disable trigger_notify_agent_of_new_offer
    - Disable trigger_journey_on_offer_submit
    - This will help us identify which trigger is causing the recursion

  2. Security
    - No changes to RLS policies
*/

-- Disable the email notification trigger
ALTER TABLE property_offers DISABLE TRIGGER trigger_notify_agent_of_new_offer;

-- Disable the journey tracking trigger
ALTER TABLE property_offers DISABLE TRIGGER trigger_journey_on_offer_submit;