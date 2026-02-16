/*
  # Fix Calendar Events Property Owner Cascade Delete

  ## Overview
  This migration fixes the foreign key constraint on calendar_events.property_owner_id
  to properly cascade deletions when a property owner's account is deleted.

  ## Changes
  1. Drop existing foreign key constraint on calendar_events.property_owner_id
  2. Recreate it with ON DELETE CASCADE
  3. Also check and fix other related foreign keys that may have the same issue

  ## Impact
  - Allows property owner accounts to be deleted without foreign key violations
  - Automatically removes calendar events when property owner is deleted
  - Maintains data integrity
*/

-- Drop existing foreign key constraint on calendar_events.property_owner_id
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'calendar_events_property_owner_id_fkey' 
    AND table_name = 'calendar_events'
  ) THEN
    ALTER TABLE calendar_events 
    DROP CONSTRAINT calendar_events_property_owner_id_fkey;
  END IF;
END $$;

-- Recreate with CASCADE on delete
ALTER TABLE calendar_events 
ADD CONSTRAINT calendar_events_property_owner_id_fkey 
FOREIGN KEY (property_owner_id) 
REFERENCES profiles(id) 
ON DELETE CASCADE;

-- Also check and fix requester_id foreign key if it exists and doesn't cascade
DO $$ 
BEGIN
  -- Drop existing constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'calendar_events_requester_id_fkey' 
    AND table_name = 'calendar_events'
  ) THEN
    ALTER TABLE calendar_events 
    DROP CONSTRAINT calendar_events_requester_id_fkey;
    
    -- Recreate with CASCADE
    ALTER TABLE calendar_events 
    ADD CONSTRAINT calendar_events_requester_id_fkey 
    FOREIGN KEY (requester_id) 
    REFERENCES profiles(id) 
    ON DELETE CASCADE;
  END IF;
END $$;

-- Fix user_id foreign key on calendar_events if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'calendar_events_user_id_fkey' 
    AND table_name = 'calendar_events'
  ) THEN
    ALTER TABLE calendar_events 
    DROP CONSTRAINT calendar_events_user_id_fkey;
    
    ALTER TABLE calendar_events 
    ADD CONSTRAINT calendar_events_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES profiles(id) 
    ON DELETE CASCADE;
  END IF;
END $$;