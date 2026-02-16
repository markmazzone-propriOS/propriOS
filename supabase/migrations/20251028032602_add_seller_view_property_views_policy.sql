/*
  # Add Seller Property Views Viewing Policy

  1. Changes
    - Add policy allowing sellers to view property_views for their own properties
    - Sellers need this to see view counts on their property listings

  2. Security
    - Only allows sellers to see views for properties they own (seller_id matches)
    - Does not reveal personal information about who viewed
*/

-- Allow sellers to view property_views for their own properties
CREATE POLICY "Sellers can view views for own properties"
  ON property_views
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_views.property_id
      AND properties.seller_id = auth.uid()
    )
  );
