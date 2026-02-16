/*
  # Add Message Read Status Tracking

  1. Changes
    - Add `is_read` column to messages table (defaults to false)
    - Add index on conversation_id and is_read for efficient unread queries
    
  2. Security
    - No RLS changes needed (inherits existing message policies)
*/

-- Add is_read column to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false;

-- Add index for efficient unread message queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation_is_read 
ON messages(conversation_id, is_read);

-- Create a function to mark messages as read
CREATE OR REPLACE FUNCTION mark_messages_as_read(p_conversation_id uuid, p_user_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE messages
  SET is_read = true
  WHERE conversation_id = p_conversation_id
    AND sender_id != p_user_id
    AND is_read = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;