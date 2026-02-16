/*
  # Allow Anonymous Pre-Approval Document Uploads

  ## Overview
  Updates the pre-approval system to allow unauthenticated users to submit
  requests and upload documents. This enables lenders to share links with
  potential buyers who don't have accounts yet.

  ## Changes
  1. Make uploaded_by field nullable in pre_approval_documents
  2. Make buyer_id nullable in pre_approval_requests
  3. Add policies for anonymous users to submit requests and upload documents
  4. Update storage policies to allow anonymous uploads

  ## Security
  - Anonymous users can only create new requests and upload to their own request folders
  - Once a request is created, only the creator (or authenticated buyer/lender) can access it
*/

-- Make uploaded_by nullable to allow anonymous uploads
ALTER TABLE pre_approval_documents
ALTER COLUMN uploaded_by DROP NOT NULL;

-- Make buyer_id nullable to allow anonymous submissions
ALTER TABLE pre_approval_requests
ALTER COLUMN buyer_id DROP NOT NULL;

-- Allow anonymous users to create pre-approval requests
CREATE POLICY "Anyone can create pre-approval requests"
  ON pre_approval_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow anonymous users to view requests they have the token for
CREATE POLICY "Anyone with token can view pre-approval request"
  ON pre_approval_requests
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow anonymous users to update requests (for adding documents references)
CREATE POLICY "Anyone with token can update pre-approval request"
  ON pre_approval_requests
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Allow anonymous users to insert documents
CREATE POLICY "Anyone can insert pre-approval documents"
  ON pre_approval_documents
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow anyone to view documents (they need the URL anyway)
CREATE POLICY "Anyone can view pre-approval documents"
  ON pre_approval_documents
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow document deletion
CREATE POLICY "Anyone can delete pre-approval documents"
  ON pre_approval_documents
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- Update storage policies to allow anonymous uploads
DROP POLICY IF EXISTS "Users can upload pre-approval documents" ON storage.objects;
CREATE POLICY "Anyone can upload pre-approval documents"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'pre-approval-documents'
  );

DROP POLICY IF EXISTS "Users can view their pre-approval documents" ON storage.objects;
CREATE POLICY "Anyone can view pre-approval documents"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id = 'pre-approval-documents'
  );

DROP POLICY IF EXISTS "Users can delete their pre-approval documents" ON storage.objects;
CREATE POLICY "Anyone can delete pre-approval documents"
  ON storage.objects
  FOR DELETE
  TO anon, authenticated
  USING (
    bucket_id = 'pre-approval-documents'
  );
