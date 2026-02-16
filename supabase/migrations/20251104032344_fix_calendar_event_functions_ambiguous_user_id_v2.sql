/*
  # Fix ambiguous user_id references in calendar event functions

  1. Changes
    - Drop policies that depend on the functions
    - Drop and recreate can_view_calendar_event function with qualified column references
    - Drop and recreate can_edit_shared_calendar_event function with qualified column references
    - Recreate the policies
  
  2. Details
    - Use fully qualified column names (table.column) to avoid ambiguity
    - Maintain same logic but with explicit table references
*/

-- Drop policies that depend on the functions
DROP POLICY IF EXISTS "Users can view shared calendar events" ON calendar_events;
DROP POLICY IF EXISTS "Users can update shared calendar events with permission" ON calendar_events;

-- Drop existing functions
DROP FUNCTION IF EXISTS can_view_calendar_event(uuid, uuid);
DROP FUNCTION IF EXISTS can_edit_shared_calendar_event(uuid, uuid);

-- Recreate can_view_calendar_event with qualified references
CREATE OR REPLACE FUNCTION can_view_calendar_event(event_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user owns the event
  IF EXISTS (
    SELECT 1 FROM calendar_events 
    WHERE calendar_events.id = can_view_calendar_event.event_id 
    AND calendar_events.agent_id = can_view_calendar_event.user_id
  ) THEN
    RETURN true;
  END IF;

  -- Check if event is shared with user
  IF EXISTS (
    SELECT 1 FROM calendar_event_shares 
    WHERE calendar_event_shares.event_id = can_view_calendar_event.event_id 
    AND calendar_event_shares.shared_with = can_view_calendar_event.user_id
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Recreate can_edit_shared_calendar_event with qualified references
CREATE OR REPLACE FUNCTION can_edit_shared_calendar_event(event_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM calendar_event_shares 
    WHERE calendar_event_shares.event_id = can_edit_shared_calendar_event.event_id 
    AND calendar_event_shares.shared_with = can_edit_shared_calendar_event.user_id
    AND calendar_event_shares.can_edit = true
  );
END;
$$;

-- Recreate policies
CREATE POLICY "Users can view shared calendar events"
  ON calendar_events FOR SELECT
  TO authenticated
  USING (can_view_calendar_event(id, auth.uid()));

CREATE POLICY "Users can update shared calendar events with permission"
  ON calendar_events FOR UPDATE
  TO authenticated
  USING (can_edit_shared_calendar_event(id, auth.uid()))
  WITH CHECK (can_edit_shared_calendar_event(id, auth.uid()));
