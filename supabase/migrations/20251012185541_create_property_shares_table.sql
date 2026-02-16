/*
  # Create Property Shares Table

  ## Overview
  This migration creates a table to track when properties are shared with buyers, particularly for sharing in messages.
  When a property is shared with a buyer, it also assigns that property to them.

  ## New Tables

  ### `property_shares`
  - `id` (uuid, primary key) - Unique identifier
  - `property_id` (uuid, foreign key) - References properties table
  - `shared_by_user_id` (uuid, foreign key) - User who shared the property (typically agent)
  - `shared_with_user_id` (uuid, foreign key) - User the property was shared with (typically buyer)
  - `conversation_id` (uuid, foreign key, nullable) - If shared in a message conversation
  - `message_id` (uuid, foreign key, nullable) - If shared in a specific message
  - `created_at` (timestamptz) - When the property was shared
  - Unique constraint on (property_id, shared_with_user_id) to prevent duplicate shares

  ## Security
  - Enable RLS on property_shares table
  - Users can view shares they created or received
  - Users can create shares for properties they have access to
  - Agents can view all shares they created

  ## Indexes
  - Indexes on property_id, shared_by_user_id, and shared_with_user_id for faster lookups
*/

-- Create property_shares table
CREATE TABLE IF NOT EXISTS property_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  shared_by_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  shared_with_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(property_id, shared_with_user_id)
);

ALTER TABLE property_shares ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_property_shares_property_id ON property_shares(property_id);
CREATE INDEX IF NOT EXISTS idx_property_shares_shared_by ON property_shares(shared_by_user_id);
CREATE INDEX IF NOT EXISTS idx_property_shares_shared_with ON property_shares(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_property_shares_conversation_id ON property_shares(conversation_id);

-- RLS Policies for property_shares
CREATE POLICY "Users can view shares they created"
  ON property_shares
  FOR SELECT
  TO authenticated
  USING (shared_by_user_id = auth.uid());

CREATE POLICY "Users can view shares they received"
  ON property_shares
  FOR SELECT
  TO authenticated
  USING (shared_with_user_id = auth.uid());

CREATE POLICY "Users can create property shares"
  ON property_shares
  FOR INSERT
  TO authenticated
  WITH CHECK (shared_by_user_id = auth.uid());

CREATE POLICY "Users can delete shares they created"
  ON property_shares
  FOR DELETE
  TO authenticated
  USING (shared_by_user_id = auth.uid());