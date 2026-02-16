/*
  # Add Seller Favorites Viewing Policy

  1. Changes
    - Add policy allowing sellers to view favorites for their own properties
    - Sellers need this to see favorite counts on their property listings

  2. Security
    - Only allows sellers to see favorites for properties they own (seller_id matches)
    - Does not reveal personal information about who favorited
*/

-- Allow sellers to view favorites for their own properties
CREATE POLICY "Sellers can view favorites for own properties"
  ON favorites
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = favorites.property_id
      AND properties.seller_id = auth.uid()
    )
  );
