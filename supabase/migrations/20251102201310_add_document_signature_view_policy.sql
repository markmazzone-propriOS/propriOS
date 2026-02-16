/*
  # Add Document Signature View Policy

  1. Changes
    - Add policy allowing users to view documents they need to sign
    - This allows the document relationship to load in signature requests
  
  2. Security
    - Only allows viewing documents where user is the signer
    - Checks document_signatures table for valid signature request
*/

CREATE POLICY "Users can view documents they need to sign"
  ON documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM document_signatures
      WHERE document_signatures.document_id = documents.id
      AND document_signatures.signer_id = auth.uid()
    )
  );
