/*
  # Allow Property Owners and Agents to View Signed Documents

  1. Problem
    - Signed documents are stored in renter's folder (e.g., `84b42437.../signed/...`)
    - Property owners cannot view signed documents because RLS only allows viewing own folder
    - This prevents property owners from viewing completed lease agreements

  2. Solution
    - Add storage policy allowing property owners to view signed documents from their renters
    - Add storage policy allowing agents to view signed documents from their clients
    - Check if the document is in a user's `/signed/` subfolder
    - Verify the relationship exists (rental application, agent assignment, etc.)

  3. Changes
    - New SELECT policies for agent-documents bucket
    - Allows property owners to view signed documents from their assigned renters
    - Allows agents to view signed documents from their buyer/seller clients
*/

-- Allow property owners to view signed documents from their renters
CREATE POLICY "Property owners can view signed documents from their renters"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'agent-documents'
  AND name LIKE '%/signed/%'
  AND (storage.foldername(name))[1] IN (
    SELECT renter_id::text
    FROM rental_applications
    WHERE property_owner_id = auth.uid()
      AND status IN ('approved', 'lease_signed')
  )
);

-- Allow agents to view signed documents from their buyer clients
CREATE POLICY "Agents can view signed documents from their buyer clients"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'agent-documents'
  AND name LIKE '%/signed/%'
  AND (storage.foldername(name))[1] IN (
    SELECT p.id::text
    FROM profiles p
    WHERE p.assigned_agent_id = auth.uid()
      AND p.user_type = 'buyer'
  )
);

-- Allow agents to view signed documents from their property sellers
CREATE POLICY "Agents can view signed documents from their property sellers"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'agent-documents'
  AND name LIKE '%/signed/%'
  AND (storage.foldername(name))[1] IN (
    SELECT pr.seller_id::text
    FROM properties pr
    WHERE pr.agent_id = auth.uid()
  )
);
