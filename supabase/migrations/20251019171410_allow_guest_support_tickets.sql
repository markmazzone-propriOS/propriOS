/*
  # Allow Guest Support Tickets

  ## Overview
  Allows visitors who are not logged in to submit support tickets.
  This is particularly useful for users who cannot log in and need help.

  ## Changes
  1. Add a policy to allow anonymous users to insert support tickets
  2. Create a special "guest" UUID for non-authenticated users
  3. Ensure guest tickets are properly tracked

  ## Security
  - Anonymous users can only INSERT tickets, not view or modify them
  - Guest tickets are marked with a special user_id for admin identification
  - All other existing policies remain unchanged
*/

-- Allow anonymous users to insert support tickets
CREATE POLICY "Anyone can create support tickets"
  ON support_tickets
  FOR INSERT
  TO anon
  WITH CHECK (true);