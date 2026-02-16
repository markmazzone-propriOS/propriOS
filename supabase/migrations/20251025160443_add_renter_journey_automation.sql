/*
  # Add Renter Journey Progress Automation

  1. Automated Tracking Triggers
    - Property favorited → Update property_search_started
    - Calendar event created → Update viewing_scheduled
    - Offer submitted → Update application_submitted (for rentals)
  
  2. Functions
    - Trigger function to track property search activity
    - Trigger function to track viewing scheduling
    - Stage progression logic

  Note: These triggers automatically track renter progress based on their actions
*/

-- Function: Track property search activity when renter favorites a property
CREATE OR REPLACE FUNCTION track_renter_property_search()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_type text;
BEGIN
  SELECT user_type INTO v_user_type
  FROM profiles
  WHERE id = NEW.user_id;

  IF v_user_type = 'renter' THEN
    INSERT INTO renter_journey_progress (
      renter_id,
      property_id,
      property_search_started,
      property_search_date,
      current_stage
    )
    VALUES (
      NEW.user_id,
      NEW.property_id,
      true,
      now(),
      'property_search'
    )
    ON CONFLICT (renter_id)
    DO UPDATE SET
      property_search_started = true,
      property_search_date = COALESCE(renter_journey_progress.property_search_date, now()),
      property_id = NEW.property_id,
      current_stage = CASE
        WHEN renter_journey_progress.current_stage = 'budget_determination' THEN 'property_search'
        ELSE renter_journey_progress.current_stage
      END,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger: Track property search when favoriting
DROP TRIGGER IF EXISTS track_renter_property_search_trigger ON property_favorites;
CREATE TRIGGER track_renter_property_search_trigger
  AFTER INSERT ON property_favorites
  FOR EACH ROW
  EXECUTE FUNCTION track_renter_property_search();

-- Function: Track viewing scheduling
CREATE OR REPLACE FUNCTION track_renter_viewing_scheduled()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_type text;
BEGIN
  SELECT user_type INTO v_user_type
  FROM profiles
  WHERE id = NEW.requester_id;

  IF v_user_type = 'renter' AND NEW.event_type = 'viewing' THEN
    INSERT INTO renter_journey_progress (
      renter_id,
      property_id,
      viewing_scheduled,
      viewing_scheduled_date,
      current_stage
    )
    VALUES (
      NEW.requester_id,
      NEW.property_id,
      true,
      now(),
      'viewing_scheduled'
    )
    ON CONFLICT (renter_id)
    DO UPDATE SET
      viewing_scheduled = true,
      viewing_scheduled_date = COALESCE(renter_journey_progress.viewing_scheduled_date, now()),
      property_id = NEW.property_id,
      current_stage = CASE
        WHEN renter_journey_progress.current_stage IN ('budget_determination', 'property_search') 
        THEN 'viewing_scheduled'
        ELSE renter_journey_progress.current_stage
      END,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger: Track viewing scheduling
DROP TRIGGER IF EXISTS track_renter_viewing_trigger ON calendar_events;
CREATE TRIGGER track_renter_viewing_trigger
  AFTER INSERT ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION track_renter_viewing_scheduled();

-- Function: Create initial renter journey when profile is created
CREATE OR REPLACE FUNCTION create_initial_renter_journey()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.user_type = 'renter' THEN
    INSERT INTO renter_journey_progress (
      renter_id,
      current_stage,
      budget_determined,
      budget_determined_date
    )
    VALUES (
      NEW.id,
      'budget_determination',
      true,
      now()
    )
    ON CONFLICT (renter_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger: Create initial journey when renter profile is created
DROP TRIGGER IF EXISTS create_initial_renter_journey_trigger ON profiles;
CREATE TRIGGER create_initial_renter_journey_trigger
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_initial_renter_journey();
