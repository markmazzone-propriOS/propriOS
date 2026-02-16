/*
  # Enable RLS and Add Missing Policies
  
  ## Critical Security Fixes
  1. Enable RLS on conversations table (was disabled despite having policies)
  2. Add RLS policies to docusign_documents table (had RLS enabled but no policies)
  
  ## Security Impact
  - Conversations table now properly enforces row-level security
  - Docusign documents are now protected with appropriate access controls
*/

-- Enable RLS on conversations table
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for docusign_documents
-- Property owners can view their own docusign documents
CREATE POLICY "Property owners can view their docusign documents"
  ON docusign_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = docusign_documents.document_id
      AND d.owner_id = (SELECT auth.uid())
    )
  );

-- Property owners can create docusign documents
CREATE POLICY "Property owners can create docusign documents"
  ON docusign_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_id
      AND d.owner_id = (SELECT auth.uid())
    )
  );

-- Property owners can update their docusign documents
CREATE POLICY "Property owners can update their docusign documents"
  ON docusign_documents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = docusign_documents.document_id
      AND d.owner_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_id
      AND d.owner_id = (SELECT auth.uid())
    )
  );

-- Property owners can delete their docusign documents  
CREATE POLICY "Property owners can delete their docusign documents"
  ON docusign_documents FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = docusign_documents.document_id
      AND d.owner_id = (SELECT auth.uid())
    )
  );
