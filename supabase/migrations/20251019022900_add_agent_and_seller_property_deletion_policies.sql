/*
  # Add Property Deletion Policies for Agents and Sellers

  1. Changes
    - Add DELETE policy for assigned agents to delete properties
    - Add DELETE policy for sellers (seller_id field) to delete properties
    - These policies work alongside the existing property owner (listed_by) deletion policy

  2. Security
    - Agents can delete properties they are assigned to (agent_id matches)
    - Sellers can delete properties they own (seller_id matches)
    - Original listers can still delete properties they created (listed_by matches)
*/

-- Add policy for assigned agents to delete properties
CREATE POLICY "Assigned agent can delete property"
  ON properties
  FOR DELETE
  TO authenticated
  USING (auth.uid() = agent_id);

-- Add policy for sellers to delete their properties
CREATE POLICY "Property seller can delete own property"
  ON properties
  FOR DELETE
  TO authenticated
  USING (auth.uid() = seller_id);
