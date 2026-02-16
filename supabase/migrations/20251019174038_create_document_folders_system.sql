/*
  # Create Document Folders System

  ## Overview
  Adds a folder system to help users organize their documents with hierarchical structure
  and labels for better categorization.

  ## New Tables
  
  ### `document_folders`
  - `id` (uuid, primary key) - Unique folder identifier
  - `owner_id` (uuid, foreign key) - References auth.users, folder owner
  - `name` (text) - Folder name
  - `parent_folder_id` (uuid, nullable) - References document_folders for nested folders
  - `color` (text, nullable) - Optional color for visual identification
  - `created_at` (timestamptz) - When the folder was created
  - `updated_at` (timestamptz) - Last update timestamp

  ### `document_labels`
  - `id` (uuid, primary key) - Unique label identifier
  - `owner_id` (uuid, foreign key) - References auth.users, label owner
  - `name` (text) - Label name
  - `color` (text) - Label color for visual identification
  - `created_at` (timestamptz) - When the label was created

  ### `document_label_assignments`
  - `id` (uuid, primary key) - Unique assignment identifier
  - `document_id` (uuid, foreign key) - References documents
  - `label_id` (uuid, foreign key) - References document_labels
  - `created_at` (timestamptz) - When the label was assigned

  ## Changes to Existing Tables
  - Add `folder_id` to documents table to link documents to folders

  ## Security
  - Enable RLS on all tables
  - Users can only manage their own folders and labels
  - Folder ownership follows document ownership rules
*/

-- Create document_folders table
CREATE TABLE IF NOT EXISTS document_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  parent_folder_id uuid REFERENCES document_folders(id) ON DELETE CASCADE,
  color text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create document_labels table
CREATE TABLE IF NOT EXISTS document_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3B82F6',
  created_at timestamptz DEFAULT now()
);

-- Create document_label_assignments table
CREATE TABLE IF NOT EXISTS document_label_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  label_id uuid REFERENCES document_labels(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(document_id, label_id)
);

-- Add folder_id to documents table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'folder_id'
  ) THEN
    ALTER TABLE documents ADD COLUMN folder_id uuid REFERENCES document_folders(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_document_folders_owner_id ON document_folders(owner_id);
CREATE INDEX IF NOT EXISTS idx_document_folders_parent_id ON document_folders(parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_document_labels_owner_id ON document_labels(owner_id);
CREATE INDEX IF NOT EXISTS idx_document_label_assignments_document_id ON document_label_assignments(document_id);
CREATE INDEX IF NOT EXISTS idx_document_label_assignments_label_id ON document_label_assignments(label_id);
CREATE INDEX IF NOT EXISTS idx_documents_folder_id ON documents(folder_id);

-- Enable RLS
ALTER TABLE document_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_label_assignments ENABLE ROW LEVEL SECURITY;

-- Document Folders Policies

-- Users can view their own folders
CREATE POLICY "Users can view own folders"
  ON document_folders
  FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

-- Users can create their own folders
CREATE POLICY "Users can create own folders"
  ON document_folders
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- Users can update their own folders
CREATE POLICY "Users can update own folders"
  ON document_folders
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Users can delete their own folders
CREATE POLICY "Users can delete own folders"
  ON document_folders
  FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- Document Labels Policies

-- Users can view their own labels
CREATE POLICY "Users can view own labels"
  ON document_labels
  FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

-- Users can create their own labels
CREATE POLICY "Users can create own labels"
  ON document_labels
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- Users can update their own labels
CREATE POLICY "Users can update own labels"
  ON document_labels
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Users can delete their own labels
CREATE POLICY "Users can delete own labels"
  ON document_labels
  FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- Document Label Assignments Policies

-- Users can view label assignments for their documents
CREATE POLICY "Users can view own document label assignments"
  ON document_label_assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_id
      AND documents.owner_id = auth.uid()
    )
  );

-- Users can create label assignments for their documents
CREATE POLICY "Users can create label assignments for own documents"
  ON document_label_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_id
      AND documents.owner_id = auth.uid()
    )
    AND
    EXISTS (
      SELECT 1 FROM document_labels
      WHERE document_labels.id = label_id
      AND document_labels.owner_id = auth.uid()
    )
  );

-- Users can delete label assignments for their documents
CREATE POLICY "Users can delete label assignments for own documents"
  ON document_label_assignments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_id
      AND documents.owner_id = auth.uid()
    )
  );

-- Function to update folder timestamp
CREATE OR REPLACE FUNCTION update_folder_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update folder timestamp
CREATE TRIGGER update_document_folders_timestamp
  BEFORE UPDATE ON document_folders
  FOR EACH ROW
  EXECUTE FUNCTION update_folder_timestamp();

-- Function to prevent circular folder references
CREATE OR REPLACE FUNCTION check_circular_folder_reference()
RETURNS TRIGGER AS $$
DECLARE
  current_parent_id uuid;
  check_id uuid;
BEGIN
  IF NEW.parent_folder_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.id = NEW.parent_folder_id THEN
    RAISE EXCEPTION 'A folder cannot be its own parent';
  END IF;

  check_id := NEW.parent_folder_id;
  LOOP
    IF check_id IS NULL THEN
      EXIT;
    END IF;

    IF check_id = NEW.id THEN
      RAISE EXCEPTION 'Circular folder reference detected';
    END IF;

    SELECT parent_folder_id INTO current_parent_id
    FROM document_folders
    WHERE id = check_id;

    check_id := current_parent_id;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to check circular references
CREATE TRIGGER check_circular_folder_reference_trigger
  BEFORE INSERT OR UPDATE ON document_folders
  FOR EACH ROW
  EXECUTE FUNCTION check_circular_folder_reference();