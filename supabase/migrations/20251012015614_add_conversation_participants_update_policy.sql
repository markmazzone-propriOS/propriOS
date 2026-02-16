/*
  # Add UPDATE policy for conversation participants

  1. Changes
    - Add UPDATE policy to allow users to update their own participant record (specifically last_read_at)
  
  2. Security
    - Users can only update their own participant record
    - Cannot modify other users' participant records
*/

CREATE POLICY "Users can update own participant record"
  ON conversation_participants
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
