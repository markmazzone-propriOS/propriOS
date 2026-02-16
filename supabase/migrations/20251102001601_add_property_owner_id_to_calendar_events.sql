/*
  # Add Property Owner Support to Calendar Events

  1. Changes
    - Add property_owner_id column to calendar_events table
    - Make agent_id nullable to support property owner viewings
    - Add RLS policies for property owners to manage their calendar events
  
  2. Security
    - Property owners can view and manage viewing requests for their properties
    - Maintain existing agent permissions
*/

-- Add property_owner_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calendar_events' 
    AND column_name = 'property_owner_id'
  ) THEN
    ALTER TABLE calendar_events ADD COLUMN property_owner_id uuid REFERENCES profiles(id);
  END IF;
END $$;

-- Make agent_id nullable to support property owner viewings
DO $$ 
BEGIN
  ALTER TABLE calendar_events ALTER COLUMN agent_id DROP NOT NULL;
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- Add constraint to ensure either agent_id or property_owner_id is set
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'calendar_events_owner_check'
  ) THEN
    ALTER TABLE calendar_events 
    ADD CONSTRAINT calendar_events_owner_check 
    CHECK (agent_id IS NOT NULL OR property_owner_id IS NOT NULL);
  END IF;
END $$;

-- Add RLS policies for property owners
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'calendar_events' 
    AND policyname = 'Property owners can view their calendar events'
  ) THEN
    CREATE POLICY "Property owners can view their calendar events"
      ON calendar_events
      FOR SELECT
      TO authenticated
      USING (
        property_owner_id = auth.uid() OR
        requester_id = auth.uid()
      );
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'calendar_events' 
    AND policyname = 'Property owners can update their calendar events'
  ) THEN
    CREATE POLICY "Property owners can update their calendar events"
      ON calendar_events
      FOR UPDATE
      TO authenticated
      USING (property_owner_id = auth.uid())
      WITH CHECK (property_owner_id = auth.uid());
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'calendar_events' 
    AND policyname = 'Property owners can delete their calendar events'
  ) THEN
    CREATE POLICY "Property owners can delete their calendar events"
      ON calendar_events
      FOR DELETE
      TO authenticated
      USING (property_owner_id = auth.uid());
  END IF;
END $$;