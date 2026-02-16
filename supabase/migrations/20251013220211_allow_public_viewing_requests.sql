/*
  # Allow Public Viewing Requests
  
  1. Changes
    - Add RLS policy to allow anonymous users to create viewing requests in calendar_events
    - This allows public visitors to schedule property viewings without signing in
  
  2. Security
    - Anonymous users can only INSERT calendar events
    - They cannot SELECT, UPDATE, or DELETE calendar events
    - The policy ensures the event is a viewing request with requestor information
*/

-- Allow anonymous users to create viewing requests
CREATE POLICY "Anyone can create viewing requests"
  ON calendar_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    event_type = 'viewing' AND
    requestor_name IS NOT NULL AND
    requestor_email IS NOT NULL
  );
