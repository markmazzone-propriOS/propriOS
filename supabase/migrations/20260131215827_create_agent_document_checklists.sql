/*
  # Create Agent Document Checklists System

  1. New Tables
    - `document_checklists`
      - `id` (uuid, primary key)
      - `agent_id` (uuid, references profiles)
      - `name` (text) - Name of the checklist
      - `description` (text) - Optional description
      - `client_id` (uuid, references profiles) - Optional client association
      - `property_id` (uuid, references properties) - Optional property association
      - `all_documents_added` (boolean) - Flag when all required documents are uploaded
      - `all_documents_completed` (boolean) - Flag when all documents are marked complete
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `document_checklist_items`
      - `id` (uuid, primary key)
      - `checklist_id` (uuid, references document_checklists)
      - `name` (text) - Name/description of required document
      - `document_id` (uuid, references documents) - Linked document if uploaded
      - `is_required` (boolean) - Whether this document is required
      - `is_completed` (boolean) - Whether document is marked as reviewed/complete
      - `notes` (text) - Optional notes about the document
      - `order_index` (integer) - Display order
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Agents can manage their own checklists
    - Clients can view checklists assigned to them

  3. Notifications
    - Notify when all documents are uploaded
    - Notify when all documents are completed
*/

-- Create document_checklists table
CREATE TABLE IF NOT EXISTS document_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  client_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  all_documents_added boolean DEFAULT false,
  all_documents_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create document_checklist_items table
CREATE TABLE IF NOT EXISTS document_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL REFERENCES document_checklists(id) ON DELETE CASCADE,
  name text NOT NULL,
  document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  is_required boolean DEFAULT true,
  is_completed boolean DEFAULT false,
  notes text,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_document_checklists_agent_id ON document_checklists(agent_id);
CREATE INDEX IF NOT EXISTS idx_document_checklists_client_id ON document_checklists(client_id);
CREATE INDEX IF NOT EXISTS idx_document_checklists_property_id ON document_checklists(property_id);
CREATE INDEX IF NOT EXISTS idx_document_checklist_items_checklist_id ON document_checklist_items(checklist_id);
CREATE INDEX IF NOT EXISTS idx_document_checklist_items_document_id ON document_checklist_items(document_id);

-- Enable RLS
ALTER TABLE document_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_checklist_items ENABLE ROW LEVEL SECURITY;

-- Policies for document_checklists
CREATE POLICY "Agents can view own checklists"
  ON document_checklists FOR SELECT
  TO authenticated
  USING (agent_id = auth.uid());

CREATE POLICY "Agents can create own checklists"
  ON document_checklists FOR INSERT
  TO authenticated
  WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents can update own checklists"
  ON document_checklists FOR UPDATE
  TO authenticated
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents can delete own checklists"
  ON document_checklists FOR DELETE
  TO authenticated
  USING (agent_id = auth.uid());

CREATE POLICY "Clients can view their assigned checklists"
  ON document_checklists FOR SELECT
  TO authenticated
  USING (client_id = auth.uid());

-- Policies for document_checklist_items
CREATE POLICY "Agents can view items from their checklists"
  ON document_checklist_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM document_checklists
      WHERE document_checklists.id = document_checklist_items.checklist_id
      AND document_checklists.agent_id = auth.uid()
    )
  );

CREATE POLICY "Agents can create items in their checklists"
  ON document_checklist_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM document_checklists
      WHERE document_checklists.id = document_checklist_items.checklist_id
      AND document_checklists.agent_id = auth.uid()
    )
  );

CREATE POLICY "Agents can update items in their checklists"
  ON document_checklist_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM document_checklists
      WHERE document_checklists.id = document_checklist_items.checklist_id
      AND document_checklists.agent_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM document_checklists
      WHERE document_checklists.id = document_checklist_items.checklist_id
      AND document_checklists.agent_id = auth.uid()
    )
  );

CREATE POLICY "Agents can delete items from their checklists"
  ON document_checklist_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM document_checklists
      WHERE document_checklists.id = document_checklist_items.checklist_id
      AND document_checklists.agent_id = auth.uid()
    )
  );

CREATE POLICY "Clients can view items from their assigned checklists"
  ON document_checklist_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM document_checklists
      WHERE document_checklists.id = document_checklist_items.checklist_id
      AND document_checklists.client_id = auth.uid()
    )
  );

-- Function to check if all documents are added
CREATE OR REPLACE FUNCTION check_all_documents_added()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_checklist_id uuid;
  v_all_added boolean;
  v_was_added boolean;
  v_agent_id uuid;
  v_checklist_name text;
BEGIN
  v_checklist_id := NEW.checklist_id;
  
  -- Check if all required items have documents
  SELECT 
    NOT EXISTS (
      SELECT 1 FROM document_checklist_items
      WHERE checklist_id = v_checklist_id
      AND is_required = true
      AND document_id IS NULL
    )
  INTO v_all_added;
  
  -- Get previous state and checklist info
  SELECT 
    all_documents_added,
    agent_id,
    name
  INTO 
    v_was_added,
    v_agent_id,
    v_checklist_name
  FROM document_checklists
  WHERE id = v_checklist_id;
  
  -- Update checklist if state changed
  IF v_all_added AND NOT v_was_added THEN
    UPDATE document_checklists
    SET 
      all_documents_added = true,
      updated_at = now()
    WHERE id = v_checklist_id;
    
    -- Create activity notification
    INSERT INTO activity_feed (
      user_id,
      activity_type,
      title,
      description,
      created_at
    ) VALUES (
      v_agent_id,
      'document_checklist_added',
      'All Documents Added',
      'All required documents have been added to checklist: ' || v_checklist_name,
      now()
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Function to check if all documents are completed
CREATE OR REPLACE FUNCTION check_all_documents_completed()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_checklist_id uuid;
  v_all_completed boolean;
  v_was_completed boolean;
  v_agent_id uuid;
  v_checklist_name text;
BEGIN
  v_checklist_id := NEW.checklist_id;
  
  -- Check if all required items are completed
  SELECT 
    NOT EXISTS (
      SELECT 1 FROM document_checklist_items
      WHERE checklist_id = v_checklist_id
      AND is_required = true
      AND (document_id IS NULL OR is_completed = false)
    )
  INTO v_all_completed;
  
  -- Get previous state and checklist info
  SELECT 
    all_documents_completed,
    agent_id,
    name
  INTO 
    v_was_completed,
    v_agent_id,
    v_checklist_name
  FROM document_checklists
  WHERE id = v_checklist_id;
  
  -- Update checklist if state changed
  IF v_all_completed AND NOT v_was_completed THEN
    UPDATE document_checklists
    SET 
      all_documents_completed = true,
      updated_at = now()
    WHERE id = v_checklist_id;
    
    -- Create activity notification
    INSERT INTO activity_feed (
      user_id,
      activity_type,
      title,
      description,
      created_at
    ) VALUES (
      v_agent_id,
      'document_checklist_completed',
      'Document Checklist Completed',
      'All required documents have been completed for checklist: ' || v_checklist_name,
      now()
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Triggers for document_checklist_items
CREATE TRIGGER trigger_check_all_documents_added
  AFTER INSERT OR UPDATE OF document_id
  ON document_checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION check_all_documents_added();

CREATE TRIGGER trigger_check_all_documents_completed
  AFTER INSERT OR UPDATE OF is_completed
  ON document_checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION check_all_documents_completed();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_checklist_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_checklist_timestamp
  BEFORE UPDATE ON document_checklists
  FOR EACH ROW
  EXECUTE FUNCTION update_checklist_updated_at();

CREATE TRIGGER trigger_update_checklist_item_timestamp
  BEFORE UPDATE ON document_checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION update_checklist_updated_at();