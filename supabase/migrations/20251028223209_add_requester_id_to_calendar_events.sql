/*
  # Add Requester ID to Calendar Events

  1. Changes
    - Add `requester_id` column to `calendar_events` table
    - This allows tracking authenticated users who schedule viewings
    - Field is nullable to support both authenticated and anonymous viewing requests

  2. Notes
    - For authenticated users: `requester_id` will be set to their user ID
    - For anonymous users: `requester_id` will be NULL and `requestor_name`, `requestor_email`, `requestor_phone` will be used
    - This fixes the trigger error "record 'new' has no field 'user_id'"
*/

-- Add requester_id column to calendar_events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calendar_events' AND column_name = 'requester_id'
  ) THEN
    ALTER TABLE calendar_events 
    ADD COLUMN requester_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_calendar_events_requester_id ON calendar_events(requester_id);
  END IF;
END $$;
