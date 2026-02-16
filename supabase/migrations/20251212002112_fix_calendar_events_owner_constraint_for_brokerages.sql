/*
  # Fix Calendar Events Owner Constraint for Brokerages
  
  1. Changes
    - Update the calendar_events_owner_check constraint to include user_id
    - This allows brokerages and other user types to create events using user_id
    
  2. Details
    - The constraint now requires at least one of: agent_id, property_owner_id, or user_id
    - This supports calendar events created by agents, property owners, and brokerages
*/

-- Drop the existing constraint if it exists
ALTER TABLE calendar_events 
DROP CONSTRAINT IF EXISTS calendar_events_owner_check;

-- Add updated constraint that includes user_id
ALTER TABLE calendar_events 
ADD CONSTRAINT calendar_events_owner_check 
CHECK (agent_id IS NOT NULL OR property_owner_id IS NOT NULL OR user_id IS NOT NULL);
