/*
  # Add public read policy for agent-documents storage

  1. Changes
    - Add policy to allow public read access to agent-documents bucket
    - This enables PDF.js to load documents for DocuSign signature placement
    
  2. Security
    - Only SELECT (read) access is public
    - Upload, update, and delete remain restricted by existing policies
*/

CREATE POLICY "Public read access for agent documents"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'agent-documents');
