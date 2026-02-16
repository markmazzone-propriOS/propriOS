/*
  # Add Seller Delete Offers Policy

  1. Changes
    - Add DELETE policy for property_offers table
    - Allows property listers (sellers) to delete offers on their properties
    - Allows agents to delete offers on properties they manage
  
  2. Security
    - Sellers can only delete offers on their own properties
    - Agents can only delete offers on properties they manage
*/

-- Property listers (sellers) can delete offers on their properties
CREATE POLICY "Property listers can delete offers on their properties"
  ON property_offers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_offers.property_id
      AND properties.listed_by = auth.uid()
    )
  );

-- Agents can delete offers on properties they manage
CREATE POLICY "Agents can delete offers on their listings"
  ON property_offers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_offers.property_id
      AND properties.agent_id = auth.uid()
    )
  );