/*
  # Add Seller Journey Viewing Trigger

  1. Changes
    - Add trigger to update seller_journey_progress when a viewing is scheduled
    - Automatically mark 'showings_started' as true when first viewing is scheduled
    - Update current_stage to 'showings' if currently on 'listed' stage

  2. Security
    - Uses SECURITY DEFINER to ensure proper permissions
*/

-- Create trigger function to update seller journey when viewing is scheduled
CREATE OR REPLACE FUNCTION auto_update_seller_journey_on_viewing_scheduled()
RETURNS TRIGGER AS $$
DECLARE
  v_seller_id uuid;
BEGIN
  -- Only process viewing events
  IF NEW.event_type != 'viewing' OR NEW.property_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get the seller_id from the property
  SELECT seller_id INTO v_seller_id
  FROM properties
  WHERE id = NEW.property_id;

  -- If no seller found, exit
  IF v_seller_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Update or create seller journey progress
  INSERT INTO seller_journey_progress (
    seller_id,
    property_id,
    current_stage,
    showings_started,
    showings_date,
    listed,
    listed_date
  )
  VALUES (
    v_seller_id,
    NEW.property_id,
    'showings',
    true,
    NEW.start_time,
    true,
    now()
  )
  ON CONFLICT (seller_id, property_id)
  DO UPDATE SET
    showings_started = true,
    showings_date = COALESCE(seller_journey_progress.showings_date, NEW.start_time),
    current_stage = CASE
      WHEN seller_journey_progress.current_stage IN ('preparation', 'listed') THEN 'showings'
      ELSE seller_journey_progress.current_stage
    END,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on calendar_events
DROP TRIGGER IF EXISTS viewing_scheduled_journey_update ON calendar_events;
CREATE TRIGGER viewing_scheduled_journey_update
  AFTER INSERT OR UPDATE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_seller_journey_on_viewing_scheduled();
