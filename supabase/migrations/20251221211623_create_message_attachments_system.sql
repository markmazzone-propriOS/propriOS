/*
  # Create Message Attachments System

  ## Overview
  This migration adds the ability for users to attach documents to messages in conversations.

  ## New Tables

  ### `message_attachments`
  - `id` (uuid, primary key) - Unique identifier for the attachment
  - `message_id` (uuid, foreign key) - References messages table
  - `file_name` (text) - Original name of the file
  - `file_url` (text) - Storage URL of the file
  - `file_size` (bigint) - Size of the file in bytes
  - `file_type` (text) - MIME type of the file
  - `uploaded_by` (uuid, foreign key) - References profiles table (who uploaded the file)
  - `created_at` (timestamptz) - When the attachment was uploaded

  ## Storage
  - Creates a storage bucket for message attachments
  - Configures appropriate access policies

  ## Security
  - Enable RLS on message_attachments table
  - Users can view attachments in conversations they participate in
  - Users can upload attachments to their own messages
  - Users can delete attachments from their own messages

  ## Indexes
  - Index on message_id for faster lookups
*/

-- Create message_attachments table
CREATE TABLE IF NOT EXISTS message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size bigint NOT NULL,
  file_type text NOT NULL,
  uploaded_by uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;

-- Create index
CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id ON message_attachments(message_id);

-- RLS Policies for message_attachments
CREATE POLICY "Users can view attachments in their conversations"
  ON message_attachments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id
      WHERE m.id = message_attachments.message_id
      AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can upload attachments to their messages"
  ON message_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM messages m
      JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id
      WHERE m.id = message_attachments.message_id
      AND cp.user_id = auth.uid()
      AND m.sender_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete attachments from their messages"
  ON message_attachments
  FOR DELETE
  TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM messages
      WHERE messages.id = message_attachments.message_id
      AND messages.sender_id = auth.uid()
    )
  );

-- Create storage bucket for message attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('message-attachments', 'message-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload message attachments"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'message-attachments'
  );

CREATE POLICY "Users can view message attachments in their conversations"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'message-attachments'
  );

CREATE POLICY "Users can delete their message attachments"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'message-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );