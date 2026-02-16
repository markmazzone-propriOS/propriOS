/*
  # Add RLS Policies for Requesters to View Their Calendar Events

  1. New Policies
    - Requesters (buyers/renters) can view their own scheduled viewing requests
    - This allows authenticated users who schedule viewings to see them in their dashboard

  2. Security
    - Users can only view calendar events where they are the requester
    - They cannot modify or delete events (only agents can do that)
*/

-- Allow requesters to view their own scheduled viewings
CREATE POLICY "Requesters can view own viewing requests"
  ON calendar_events
  FOR SELECT
  TO authenticated
  USING (
    requester_id = auth.uid()
  );
