/*
  # Fix support ticket responses RLS policy

  1. Changes
    - Drop and recreate the "Users can view responses on own tickets" policy
    - Move the is_internal_note check outside the EXISTS subquery where it belongs
    - This was preventing users from seeing admin responses to their tickets

  ## Problem
  The original policy had:
  ```
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets
      WHERE support_tickets.id = ticket_id
      AND support_tickets.user_id = auth.uid()
      AND is_internal_note = false  -- This column doesn't exist in support_tickets!
    )
  )
  ```

  ## Solution
  The is_internal_note column is on support_ticket_responses, not support_tickets,
  so it needs to be checked outside the EXISTS clause.
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can view responses on own tickets" ON support_ticket_responses;

-- Recreate with correct logic
CREATE POLICY "Users can view responses on own tickets"
  ON support_ticket_responses
  FOR SELECT
  TO authenticated
  USING (
    is_internal_note = false
    AND EXISTS (
      SELECT 1 FROM support_tickets
      WHERE support_tickets.id = ticket_id
      AND support_tickets.user_id = auth.uid()
    )
  );
