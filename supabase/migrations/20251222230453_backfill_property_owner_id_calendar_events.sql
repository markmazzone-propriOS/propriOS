/*
  # Backfill Property Owner ID in Calendar Events
  
  1. Changes
    - Update existing calendar events to set property_owner_id based on the seller_id from the associated property
    - Add trigger to automatically populate property_owner_id when viewings are created
  
  2. Notes
    - This ensures sellers can see viewing requests for their properties on their calendar
    - Only affects viewing events that have an associated property
*/

-- Backfill existing calendar events with property_owner_id
UPDATE calendar_events ce
SET property_owner_id = p.seller_id
FROM properties p
WHERE ce.property_id = p.id
  AND p.seller_id IS NOT NULL
  AND ce.property_owner_id IS NULL
  AND ce.event_type = 'viewing';

-- Create trigger function to auto-populate property_owner_id for viewing events
CREATE OR REPLACE FUNCTION set_calendar_event_property_owner()
RETURNS TRIGGER AS $$
BEGIN
  -- If this is a viewing event with a property, set the property_owner_id
  IF NEW.event_type = 'viewing' AND NEW.property_id IS NOT NULL THEN
    SELECT seller_id INTO NEW.property_owner_id
    FROM properties
    WHERE id = NEW.property_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it exists and recreate it
DROP TRIGGER IF EXISTS set_property_owner_on_viewing_insert ON calendar_events;

CREATE TRIGGER set_property_owner_on_viewing_insert
  BEFORE INSERT ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION set_calendar_event_property_owner();
