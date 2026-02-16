/*
  # Add Seller Offers Management Policies

  ## Changes
  This migration adds RLS policies to allow sellers (property owners) to view
  and manage offers on properties where they are assigned as the seller.

  1. New Policies
    - Sellers can view offers on properties where they are the seller
    - Sellers can update offer status on their properties (accept, reject, counter)

  2. Security
    - Policies check that seller_id matches auth.uid()
    - Maintains security by ensuring sellers can only manage their own properties' offers
*/

-- Allow sellers to view offers on properties where they are the seller
CREATE POLICY "Sellers can view offers on their properties"
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
CREATE POLICY "Sellers can update offer status on their properties"
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