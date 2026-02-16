/*
  # Add 'cancelled' Status to Invitations

  1. Changes
    - Modify the status check constraint to include 'cancelled' as a valid status
    - This allows agents to cancel invitations they've sent
    
  2. Security
    - No security changes, only extends allowed values for status column
*/

-- Drop the existing check constraint
ALTER TABLE invitations DROP CONSTRAINT IF EXISTS invitations_status_check;

-- Add the new check constraint with 'cancelled' included
ALTER TABLE invitations ADD CONSTRAINT invitations_status_check 
  CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled'));