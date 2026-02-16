/*
  # Add Agent and Brokerage Analytics Policies

  1. Changes
    - Add policy allowing agents to view analytics for their own properties
    - Add policy allowing brokerages to view analytics for their agents' properties
  
  2. Security
    - Agents can only see analytics for properties they manage (agent_id match)
    - Brokerages can only see analytics for properties managed by their agents
*/

-- Allow agents to view property_views for their own properties
CREATE POLICY "Agents can view analytics for own properties"
  ON property_views
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_views.property_id
      AND properties.agent_id = auth.uid()
    )
  );

-- Allow brokerages to view property_views for their agents' properties
CREATE POLICY "Brokerages can view analytics for agents properties"
  ON property_views
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      JOIN brokerage_agents ba ON ba.agent_id = p.agent_id
      JOIN brokerages b ON b.id = ba.brokerage_id
      WHERE p.id = property_views.property_id
      AND b.super_admin_id = auth.uid()
    )
  );

-- Allow agents to view anonymous_property_views for their own properties
CREATE POLICY "Agents can view anonymous analytics for own properties"
  ON anonymous_property_views
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = anonymous_property_views.property_id
      AND properties.agent_id = auth.uid()
    )
  );

-- Allow brokerages to view anonymous_property_views for their agents' properties
CREATE POLICY "Brokerages can view anonymous analytics for agents properties"
  ON anonymous_property_views
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      JOIN brokerage_agents ba ON ba.agent_id = p.agent_id
      JOIN brokerages b ON b.id = ba.brokerage_id
      WHERE p.id = anonymous_property_views.property_id
      AND b.super_admin_id = auth.uid()
    )
  );
