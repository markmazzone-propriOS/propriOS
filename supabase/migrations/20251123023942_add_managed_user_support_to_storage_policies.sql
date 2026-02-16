/*
  # Add Managed User Support to Storage Policies

  1. Changes
    - Update property-photos bucket policies to allow managed users
    - Allow managed users with proper permissions to upload, update, and delete photos
    - Maintain security by checking agent_managed_accounts permissions

  2. Security
    - Maintains existing security for agents, sellers, and property owners
    - Adds secure access for managed users based on their permissions
    - Only allows managed users with can_edit_listings permission
*/

-- Drop and recreate INSERT policy with managed user support
DROP POLICY IF EXISTS "Agents can upload property photos" ON storage.objects;

CREATE POLICY "Agents can upload property photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'property-photos' AND
    (
      (SELECT user_type FROM profiles WHERE id = auth.uid()) IN ('agent', 'seller', 'property_owner')
      OR EXISTS (
        SELECT 1 FROM agent_managed_accounts ama
        WHERE ama.managed_user_id = auth.uid()
        AND ama.can_edit_listings = true
      )
    )
  );

-- Drop and recreate UPDATE policy with managed user support
DROP POLICY IF EXISTS "Users can update their own property photos" ON storage.objects;

CREATE POLICY "Users can update their own property photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'property-photos' AND
    (
      (SELECT user_type FROM profiles WHERE id = auth.uid()) IN ('agent', 'seller', 'property_owner')
      OR EXISTS (
        SELECT 1 FROM agent_managed_accounts ama
        WHERE ama.managed_user_id = auth.uid()
        AND ama.can_edit_listings = true
      )
    )
  )
  WITH CHECK (
    bucket_id = 'property-photos' AND
    (
      (SELECT user_type FROM profiles WHERE id = auth.uid()) IN ('agent', 'seller', 'property_owner')
      OR EXISTS (
        SELECT 1 FROM agent_managed_accounts ama
        WHERE ama.managed_user_id = auth.uid()
        AND ama.can_edit_listings = true
      )
    )
  );

-- Drop and recreate DELETE policy with managed user support
DROP POLICY IF EXISTS "Users can delete their own property photos" ON storage.objects;

CREATE POLICY "Users can delete their own property photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'property-photos' AND
    (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM agent_managed_accounts ama
        WHERE ama.managed_user_id = auth.uid()
        AND ama.can_delete_listings = true
      )
    )
  );
