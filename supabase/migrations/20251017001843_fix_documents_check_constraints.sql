/*
  # Fix Documents Check Constraints

  ## Overview
  Updates the document_type check constraints to accept the proper values being used by the application.

  ## Changes
  1. Drop old check constraints that have incorrect values
  2. Create new check constraint with all valid document types (capitalized as used in the app)

  ## Notes
  - Allows: License, Insurance, Certification, Contract, Invoice, Inspection, Work Photo, Other
  - Maintains backward compatibility with existing lowercase values
  - Ensures service providers can upload all document types
*/

-- Drop the old constraints
ALTER TABLE documents DROP CONSTRAINT IF EXISTS agent_documents_document_type_check;
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_document_type_check;

-- Create a new constraint that accepts both capitalized and lowercase values
ALTER TABLE documents ADD CONSTRAINT documents_document_type_check 
  CHECK (document_type IN (
    'License', 'Insurance', 'Certification', 'Contract', 'Invoice', 'Inspection', 'Work Photo', 'Other',
    'license', 'insurance', 'certification', 'contract', 'invoice', 'inspection', 'work photo', 'other',
    'identification', 'appraisal', 'disclosure', 'offer'
  ));