/*
  # Add Brokerage Analytics Access to All Tables

  1. Changes
    - Add policy allowing agents to view favorites for their own properties
    - Add policy allowing brokerages to view favorites for their agents' properties
    - Add policy allowing agents to view calendar events for their properties
    - Add policy allowing brokerages to view calendar events for their agents' properties
    - Add policy allowing brokerages to view offers for their agents' properties
  
  2. Security
    - Agents can see analytics for properties they manage
    - Brokerages can see analytics for all their agents' properties
*/

-- Allow agents to view favorites for their own properties
CREATE POLICY "Agents can view favorites for own properties"
  ON favorites
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = favorites.property_id
      AND properties.agent_id = auth.uid()
    )
  );

-- Allow brokerages to view favorites for their agents' properties
CREATE POLICY "Brokerages can view favorites for agents properties"
  ON favorites
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      JOIN brokerage_agents ba ON ba.agent_id = p.agent_id
      JOIN brokerages b ON b.id = ba.brokerage_id
      WHERE p.id = favorites.property_id
      AND b.super_admin_id = auth.uid()
    )
  );

-- Allow agents to view calendar events for their properties
CREATE POLICY "Agents can view calendar events for own properties"
  ON calendar_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = calendar_events.property_id
      AND properties.agent_id = auth.uid()
    )
  );

-- Allow brokerages to view calendar events for their agents' properties
CREATE POLICY "Brokerages can view calendar events for agents properties"
  ON calendar_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      JOIN brokerage_agents ba ON ba.agent_id = p.agent_id
      JOIN brokerages b ON b.id = ba.brokerage_id
      WHERE p.id = calendar_events.property_id
      AND b.super_admin_id = auth.uid()
    )
  );

-- Allow brokerages to view offers for their agents' properties
CREATE POLICY "Brokerages can view offers for agents properties"
  ON property_offers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      JOIN brokerage_agents ba ON ba.agent_id = p.agent_id
      JOIN brokerages b ON b.id = ba.brokerage_id
      WHERE p.id = property_offers.property_id
      AND b.super_admin_id = auth.uid()
    )
  );
