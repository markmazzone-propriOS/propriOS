/*
  # Add Seller Property Update Policy

  1. Changes
    - Add UPDATE policy for sellers to update their own properties
    - This allows sellers to update property details like price, description, etc.

  2. Security
    - Sellers can only update properties where they are the seller (seller_id = auth.uid())
    - Uses both USING and WITH CHECK to ensure sellers can't change ownership
*/

CREATE POLICY "Sellers can update own properties"
  ON properties
  FOR UPDATE
  TO authenticated
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());
