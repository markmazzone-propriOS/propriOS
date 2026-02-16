/*
  # Make support tickets user_id nullable for guest submissions

  1. Changes
    - Remove NOT NULL constraint from user_id column
    - This allows guest users (not logged in) to submit support tickets
    - Guest tickets will have NULL user_id and include email in description

  2. Security
    - Existing RLS policies remain unchanged
    - Anonymous users can still INSERT tickets via existing policy
*/

-- Make user_id nullable to support guest tickets
ALTER TABLE support_tickets
ALTER COLUMN user_id DROP NOT NULL;
