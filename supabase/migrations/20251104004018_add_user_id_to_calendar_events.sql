/*
  # Add User ID to Calendar Events
  
  1. Changes
    - Add `user_id` column to `calendar_events` table
    - This column will be used for general calendar ownership (agents, property owners, service providers, etc.)
    - Maintains backward compatibility with existing `agent_id` and `property_owner_id` columns
    - Add index for efficient queries
    - Add RLS policies for users to view their own calendar events
  
  2. Notes
    - `user_id` is the primary owner of the calendar event
    - `agent_id` remains for backward compatibility with viewing-related events
    - `property_owner_id` remains for property owner-specific filtering
*/

-- Add user_id column to calendar_events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calendar_events' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE calendar_events 
    ADD COLUMN user_id uuid REFERENCES profiles(id) ON DELETE CASCADE;
    
    CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);
  END IF;
END $$;

-- Add RLS policy for users to view their own calendar events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'calendar_events' 
    AND policyname = 'Users can view own calendar events'
  ) THEN
    CREATE POLICY "Users can view own calendar events"
      ON calendar_events FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- Add RLS policy for users to update their own calendar events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'calendar_events' 
    AND policyname = 'Users can update own calendar events'
  ) THEN
    CREATE POLICY "Users can update own calendar events"
      ON calendar_events FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Add RLS policy for users to delete their own calendar events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'calendar_events' 
    AND policyname = 'Users can delete own calendar events'
  ) THEN
    CREATE POLICY "Users can delete own calendar events"
      ON calendar_events FOR DELETE
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;
