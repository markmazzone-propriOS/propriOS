/*
  # Disable Journey Trigger Completely

  1. Changes
    - Drop the problematic trigger_journey_on_offer_submit trigger
    - The journey progress will need to be updated manually from the application
    - This prevents the out of memory error from infinite recursion

  2. Security
    - No changes to RLS policies
*/

-- Drop the trigger completely
DROP TRIGGER IF EXISTS trigger_journey_on_offer_submit ON property_offers;

-- Drop the trigger for offer acceptance as well
DROP TRIGGER IF EXISTS trigger_journey_on_offer_accept ON property_offers;

-- Drop the trigger for first viewing
DROP TRIGGER IF EXISTS trigger_journey_on_first_viewing ON property_views;

-- Drop the trigger for favorites
DROP TRIGGER IF EXISTS trigger_journey_on_favorite ON favorites;
