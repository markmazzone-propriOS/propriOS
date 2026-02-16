/*
  # Add Appointment Event Type to Calendar Events
  
  1. Changes
    - Update calendar_events check constraint to include 'appointment' event type
    - Allows service provider appointments to sync to calendar
  
  2. Notes
    - Previously only allowed: viewing, meeting, closing, other
    - Now also allows: appointment
*/

-- Drop the old constraint
ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS valid_event_type;

-- Add the new constraint with 'appointment' included
ALTER TABLE calendar_events ADD CONSTRAINT valid_event_type 
  CHECK (event_type IN ('viewing', 'meeting', 'closing', 'appointment', 'other'));
