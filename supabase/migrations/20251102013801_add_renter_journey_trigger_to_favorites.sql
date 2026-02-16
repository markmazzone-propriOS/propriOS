/*
  # Add Renter Journey Trigger to Favorites Table

  1. Changes
    - Add trigger to track property search progress when renter favorites a property
    - Uses the existing track_renter_property_search() function
  
  2. Notes
    - This ensures renters' journey progress is updated when they favorite properties
    - The trigger marks property_search_started as true and advances to property_search stage
*/

-- Add trigger to favorites table for renter journey tracking
DROP TRIGGER IF EXISTS track_renter_property_search_trigger ON favorites;
CREATE TRIGGER track_renter_property_search_trigger
  AFTER INSERT ON favorites
  FOR EACH ROW
  EXECUTE FUNCTION track_renter_property_search();