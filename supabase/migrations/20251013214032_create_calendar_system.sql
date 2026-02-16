/*
  # Create Calendar and Viewing Appointments System

  1. New Tables
    - `calendar_events`
      - `id` (uuid, primary key)
      - `agent_id` (uuid, references profiles) - The agent who owns this event
      - `property_id` (uuid, references properties, nullable) - Associated property if applicable
      - `event_type` (text) - Type: 'viewing', 'meeting', 'closing', 'other'
      - `title` (text) - Event title
      - `description` (text, nullable) - Event description
      - `start_time` (timestamptz) - Event start time
      - `end_time` (timestamptz) - Event end time
      - `location` (text, nullable) - Event location
      - `status` (text) - Status: 'pending', 'confirmed', 'cancelled', 'completed'
      - `requestor_name` (text, nullable) - Name of person who requested (for public requests)
      - `requestor_email` (text, nullable) - Email of person who requested
      - `requestor_phone` (text, nullable) - Phone of person who requested
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `calendar_event_shares`
      - `id` (uuid, primary key)
      - `event_id` (uuid, references calendar_events)
      - `shared_by` (uuid, references profiles) - Agent sharing the event
      - `shared_with` (uuid, references profiles) - User receiving the share
      - `can_edit` (boolean) - Whether recipient can edit the event
      - `shared_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Agents can view and manage their own calendar events
    - Agents can create viewing requests from public requests
    - Users can view calendar events shared with them
    - Agents can share calendar events with their assigned clients
*/

-- Create calendar_events table
CREATE TABLE IF NOT EXISTS calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  event_type text NOT NULL DEFAULT 'other',
  title text NOT NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  location text,
  status text NOT NULL DEFAULT 'pending',
  requestor_name text,
  requestor_email text,
  requestor_phone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_event_type CHECK (event_type IN ('viewing', 'meeting', 'closing', 'other')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Create calendar_event_shares table
CREATE TABLE IF NOT EXISTS calendar_event_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES calendar_events(id) ON DELETE CASCADE NOT NULL,
  shared_by uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  shared_with uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  can_edit boolean DEFAULT false,
  shared_at timestamptz DEFAULT now(),
  UNIQUE(event_id, shared_with)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_calendar_events_agent_id ON calendar_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_property_id ON calendar_events(property_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_status ON calendar_events(status);
CREATE INDEX IF NOT EXISTS idx_calendar_event_shares_event_id ON calendar_event_shares(event_id);
CREATE INDEX IF NOT EXISTS idx_calendar_event_shares_shared_with ON calendar_event_shares(shared_with);

-- Enable RLS
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_event_shares ENABLE ROW LEVEL SECURITY;

-- RLS Policies for calendar_events

-- Agents can view their own events
CREATE POLICY "Agents can view own calendar events"
  ON calendar_events FOR SELECT
  TO authenticated
  USING (
    agent_id = auth.uid()
  );

-- Agents can insert their own events
CREATE POLICY "Agents can create own calendar events"
  ON calendar_events FOR INSERT
  TO authenticated
  WITH CHECK (
    agent_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'agent'
    )
  );

-- Agents can update their own events
CREATE POLICY "Agents can update own calendar events"
  ON calendar_events FOR UPDATE
  TO authenticated
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

-- Agents can delete their own events
CREATE POLICY "Agents can delete own calendar events"
  ON calendar_events FOR DELETE
  TO authenticated
  USING (agent_id = auth.uid());

-- Users can view events shared with them
CREATE POLICY "Users can view shared calendar events"
  ON calendar_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM calendar_event_shares
      WHERE calendar_event_shares.event_id = calendar_events.id
      AND calendar_event_shares.shared_with = auth.uid()
    )
  );

-- Users with edit permission can update shared events
CREATE POLICY "Users can update shared calendar events with permission"
  ON calendar_events FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM calendar_event_shares
      WHERE calendar_event_shares.event_id = calendar_events.id
      AND calendar_event_shares.shared_with = auth.uid()
      AND calendar_event_shares.can_edit = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM calendar_event_shares
      WHERE calendar_event_shares.event_id = calendar_events.id
      AND calendar_event_shares.shared_with = auth.uid()
      AND calendar_event_shares.can_edit = true
    )
  );

-- RLS Policies for calendar_event_shares

-- Agents can view shares of their events
CREATE POLICY "Agents can view shares of own events"
  ON calendar_event_shares FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM calendar_events
      WHERE calendar_events.id = calendar_event_shares.event_id
      AND calendar_events.agent_id = auth.uid()
    )
  );

-- Users can view shares of events shared with them
CREATE POLICY "Users can view own event shares"
  ON calendar_event_shares FOR SELECT
  TO authenticated
  USING (shared_with = auth.uid());

-- Agents can share their own events
CREATE POLICY "Agents can share own calendar events"
  ON calendar_event_shares FOR INSERT
  TO authenticated
  WITH CHECK (
    shared_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM calendar_events
      WHERE calendar_events.id = calendar_event_shares.event_id
      AND calendar_events.agent_id = auth.uid()
    )
  );

-- Agents can update shares of their own events
CREATE POLICY "Agents can update shares of own events"
  ON calendar_event_shares FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM calendar_events
      WHERE calendar_events.id = calendar_event_shares.event_id
      AND calendar_events.agent_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM calendar_events
      WHERE calendar_events.id = calendar_event_shares.event_id
      AND calendar_events.agent_id = auth.uid()
    )
  );

-- Agents can delete shares of their own events
CREATE POLICY "Agents can delete shares of own events"
  ON calendar_event_shares FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM calendar_events
      WHERE calendar_events.id = calendar_event_shares.event_id
      AND calendar_events.agent_id = auth.uid()
    )
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_calendar_event_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION update_calendar_event_updated_at();
