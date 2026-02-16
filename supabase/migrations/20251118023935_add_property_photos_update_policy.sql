/*
  # Add UPDATE Policy for Property Photos

  1. Changes
    - Add UPDATE policy for property-photos bucket
    - Allows agents, sellers, and property owners to update their property photos

  2. Security
    - Only users who own the folder (property) can update photos
    - Must be authenticated with proper user type
*/

-- Add UPDATE policy for property photos
CREATE POLICY "Users can update their own property photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'property-photos' AND
    (SELECT user_type FROM profiles WHERE id = auth.uid()) IN ('agent', 'seller', 'property_owner')
  )
  WITH CHECK (
    bucket_id = 'property-photos' AND
    (SELECT user_type FROM profiles WHERE id = auth.uid()) IN ('agent', 'seller', 'property_owner')
  );
