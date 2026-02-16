/*
  # Restore Seller and Agent Delete Policies

  1. Changes
    - Restore DELETE policy for sellers to delete their own properties (seller_id)
    - Restore DELETE policy for agents to delete properties they manage (agent_id)
    
  2. Security
    - Sellers can delete properties where they are the seller (seller_id = auth.uid())
    - Agents can delete properties they are assigned to (agent_id = auth.uid())
    - These policies work alongside existing property owner policies
*/

-- Drop any duplicate policies first if they exist
DROP POLICY IF EXISTS "Assigned agent can delete property" ON properties;
DROP POLICY IF EXISTS "Property seller can delete own property" ON properties;

-- Restore policy for sellers to delete their properties
CREATE POLICY "Property seller can delete own property"
  ON properties
  FOR DELETE
  TO authenticated
  USING (auth.uid() = seller_id);

-- Restore policy for assigned agents to delete properties
CREATE POLICY "Assigned agent can delete property"
  ON properties
  FOR DELETE
  TO authenticated
  USING (auth.uid() = agent_id);
