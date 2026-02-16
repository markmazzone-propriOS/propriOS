/*
  # Create Reschedule Confirmation System

  1. Changes to calendar_events
    - Add `reschedule_status` field to track reschedule confirmations
    - Add `reschedule_requested_at` timestamp
    - Add `reschedule_confirmed_at` timestamp
    - Add `original_start_time` to track the previous time when rescheduling
    - Add `original_end_time` to track the previous end time

  2. New Values
    - reschedule_status: NULL (no reschedule), 'pending_confirmation', 'confirmed', 'declined'

  3. Security
    - Buyers can view events where they are the requester (via requester_id)
    - Buyers can update reschedule_status on their events
    - Add policy for buyers to confirm/decline reschedules

  4. Notes
    - When agent reschedules, set reschedule_status to 'pending_confirmation'
    - Buyer can then confirm or decline the reschedule
    - If declined, event could revert to original time or be cancelled
*/

-- Add reschedule tracking fields to calendar_events
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calendar_events' AND column_name = 'reschedule_status'
  ) THEN
    ALTER TABLE calendar_events ADD COLUMN reschedule_status text;
    ALTER TABLE calendar_events ADD CONSTRAINT valid_reschedule_status 
      CHECK (reschedule_status IN ('pending_confirmation', 'confirmed', 'declined'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calendar_events' AND column_name = 'reschedule_requested_at'
  ) THEN
    ALTER TABLE calendar_events ADD COLUMN reschedule_requested_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calendar_events' AND column_name = 'reschedule_confirmed_at'
  ) THEN
    ALTER TABLE calendar_events ADD COLUMN reschedule_confirmed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calendar_events' AND column_name = 'original_start_time'
  ) THEN
    ALTER TABLE calendar_events ADD COLUMN original_start_time timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calendar_events' AND column_name = 'original_end_time'
  ) THEN
    ALTER TABLE calendar_events ADD COLUMN original_end_time timestamptz;
  END IF;
END $$;

-- Allow buyers/requesters to view their viewing events
CREATE POLICY "Requesters can view their viewing events"
  ON calendar_events FOR SELECT
  TO authenticated
  USING (
    requester_id = auth.uid() AND event_type = 'viewing'
  );

-- Allow buyers to update reschedule status on their viewing events
CREATE POLICY "Requesters can update reschedule status"
  ON calendar_events FOR UPDATE
  TO authenticated
  USING (
    requester_id = auth.uid() AND 
    event_type = 'viewing' AND
    reschedule_status = 'pending_confirmation'
  )
  WITH CHECK (
    requester_id = auth.uid() AND 
    event_type = 'viewing'
  );
