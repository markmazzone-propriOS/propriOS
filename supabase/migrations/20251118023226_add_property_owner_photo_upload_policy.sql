/*
  # Allow Property Owners to Upload Property Photos

  1. Changes
    - Update property photo upload policy to include 'property_owner' user type
    - Property owners can now upload photos for their rental listings

  2. Security
    - Maintains existing security for agents and sellers
    - Adds property_owner to allowed user types for photo uploads
*/

-- Drop and recreate the upload policy to include property_owner
DROP POLICY IF EXISTS "Agents can upload property photos" ON storage.objects;

CREATE POLICY "Agents, sellers, and property owners can upload property photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'property-photos' AND
    (SELECT user_type FROM profiles WHERE id = auth.uid()) IN ('agent', 'seller', 'property_owner')
  );
