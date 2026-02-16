/*
  # Fix Calendar Events Infinite Recursion
  
  1. Changes
    - Drop existing policies that cause circular dependencies
    - Create helper functions with SECURITY DEFINER to avoid recursion
    - Recreate policies using the helper functions
  
  2. Security
    - Maintain same security model but avoid recursive policy checks
    - Use functions to bypass RLS when checking relationships
*/

-- Drop problematic policies
DROP POLICY IF EXISTS "Users can view shared calendar events" ON calendar_events;
DROP POLICY IF EXISTS "Users can update shared calendar events with permission" ON calendar_events;
DROP POLICY IF EXISTS "Agents can view shares of own events" ON calendar_event_shares;
DROP POLICY IF EXISTS "Agents can share own calendar events" ON calendar_event_shares;
DROP POLICY IF EXISTS "Agents can update shares of own events" ON calendar_event_shares;
DROP POLICY IF EXISTS "Agents can delete shares of own events" ON calendar_event_shares;

-- Create security definer function to check if user can view event
CREATE OR REPLACE FUNCTION can_view_calendar_event(event_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user owns the event
  IF EXISTS (
    SELECT 1 FROM calendar_events 
    WHERE id = event_id AND agent_id = user_id
  ) THEN
    RETURN true;
  END IF;
  
  -- Check if event is shared with user (without triggering RLS)
  IF EXISTS (
    SELECT 1 FROM calendar_event_shares 
    WHERE calendar_event_shares.event_id = can_view_calendar_event.event_id 
    AND shared_with = user_id
  ) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Create security definer function to check if user can edit shared event
CREATE OR REPLACE FUNCTION can_edit_shared_calendar_event(event_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM calendar_event_shares 
    WHERE calendar_event_shares.event_id = can_edit_shared_calendar_event.event_id 
    AND shared_with = user_id
    AND can_edit = true
  );
END;
$$;

-- Create security definer function to check if user owns event
CREATE OR REPLACE FUNCTION owns_calendar_event(event_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM calendar_events 
    WHERE id = event_id AND agent_id = user_id
  );
END;
$$;

-- Recreate policies using helper functions

-- Users can view events shared with them
CREATE POLICY "Users can view shared calendar events"
  ON calendar_events FOR SELECT
  TO authenticated
  USING (can_view_calendar_event(id, auth.uid()));

-- Users with edit permission can update shared events
CREATE POLICY "Users can update shared calendar events with permission"
  ON calendar_events FOR UPDATE
  TO authenticated
  USING (can_edit_shared_calendar_event(id, auth.uid()))
  WITH CHECK (can_edit_shared_calendar_event(id, auth.uid()));

-- Agents can view shares of their events
CREATE POLICY "Agents can view shares of own events"
  ON calendar_event_shares FOR SELECT
  TO authenticated
  USING (owns_calendar_event(event_id, auth.uid()) OR shared_with = auth.uid());

-- Agents can share their own events
CREATE POLICY "Agents can share own calendar events"
  ON calendar_event_shares FOR INSERT
  TO authenticated
  WITH CHECK (shared_by = auth.uid() AND owns_calendar_event(event_id, auth.uid()));

-- Agents can update shares of their own events
CREATE POLICY "Agents can update shares of own events"
  ON calendar_event_shares FOR UPDATE
  TO authenticated
  USING (owns_calendar_event(event_id, auth.uid()))
  WITH CHECK (owns_calendar_event(event_id, auth.uid()));

-- Agents can delete shares of their own events
CREATE POLICY "Agents can delete shares of own events"
  ON calendar_event_shares FOR DELETE
  TO authenticated
  USING (owns_calendar_event(event_id, auth.uid()));
