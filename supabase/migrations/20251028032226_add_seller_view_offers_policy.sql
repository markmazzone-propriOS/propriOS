/*
  # Add Seller Offers Viewing Policy

  1. Changes
    - Add policy allowing sellers to view offers on their properties
    - The existing policy checks `listed_by` but properties use `seller_id`

  2. Security
    - Only allows sellers to see offers for properties they own (seller_id matches)
*/

-- Allow sellers to view offers on their own properties
CREATE POLICY "Sellers can view offers on own properties"
  ON property_offers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_offers.property_id
      AND properties.seller_id = auth.uid()
    )
  );

-- Allow sellers to update offer status on their properties
CREATE POLICY "Sellers can update offer status on own properties"
  ON property_offers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_offers.property_id
      AND properties.seller_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_offers.property_id
      AND properties.seller_id = auth.uid()
    )
  );
