/*
  # Add DELETE policy for prospects table

  1. Changes
    - Add policy allowing agents to delete their own prospects

  2. Security
    - Agents can only delete prospects where they are the assigned agent (agent_id = auth.uid())
*/

CREATE POLICY "Agents can delete their own prospects"
  ON prospects
  FOR DELETE
  TO authenticated
  USING (agent_id = auth.uid());
