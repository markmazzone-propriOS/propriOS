/*
  # Make agent-documents bucket public for DocuSign integration

  1. Changes
    - Update agent-documents bucket to be public
    - This allows PDF.js to load documents for signature field placement
    - Existing RLS policies still control who can upload/delete documents
    
  2. Security
    - Documents remain protected by RLS policies for write operations
    - Public read access allows loading PDFs in the browser for DocuSign workflow
*/

UPDATE storage.buckets 
SET public = true 
WHERE id = 'agent-documents';
