/*
  # Add Brokerage Calendar Permissions

  1. Changes
    - Allow brokerages to create calendar events
    - Allow brokerages to view calendar events shared with their agents
    - Allow brokerages to manage event shares for their agents

  2. Security
    - Brokerages can only create events for themselves
    - Brokerages can only share events with agents in their brokerage
    - Brokerages can view all events from agents in their brokerage
*/

-- Allow brokerages to create calendar events
CREATE POLICY "Brokerages can create calendar events"
  ON calendar_events FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'brokerage'
    )
  );

-- Allow brokerages to view events they created
CREATE POLICY "Brokerages can view own calendar events"
  ON calendar_events FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'brokerage'
    )
  );

-- Allow brokerages to update their own events
CREATE POLICY "Brokerages can update own calendar events"
  ON calendar_events FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'brokerage'
    )
  )
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'brokerage'
    )
  );

-- Allow brokerages to delete their own events
CREATE POLICY "Brokerages can delete own calendar events"
  ON calendar_events FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'brokerage'
    )
  );

-- Allow brokerages to share events with their agents
CREATE POLICY "Brokerages can share events with their agents"
  ON calendar_event_shares FOR INSERT
  TO authenticated
  WITH CHECK (
    shared_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'brokerage'
    ) AND
    EXISTS (
      SELECT 1 FROM brokerages b
      JOIN brokerage_agents ba ON ba.brokerage_id = b.id
      WHERE b.super_admin_id = auth.uid()
      AND ba.agent_id = shared_with
      AND ba.status = 'active'
    )
  );

-- Allow brokerages to view shares of their own events
CREATE POLICY "Brokerages can view shares of own events"
  ON calendar_event_shares FOR SELECT
  TO authenticated
  USING (
    shared_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'brokerage'
    )
  );

-- Allow brokerages to update shares of their own events
CREATE POLICY "Brokerages can update shares of own events"
  ON calendar_event_shares FOR UPDATE
  TO authenticated
  USING (
    shared_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'brokerage'
    )
  )
  WITH CHECK (
    shared_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'brokerage'
    )
  );

-- Allow brokerages to delete shares of their own events
CREATE POLICY "Brokerages can delete shares of own events"
  ON calendar_event_shares FOR DELETE
  TO authenticated
  USING (
    shared_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'brokerage'
    )
  );