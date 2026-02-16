/*
  # Add Invitee Name to Invitations

  1. Changes
    - Add invitee_name column to invitations table
    - This stores the full name of the person being invited
    
  2. Notes
    - Column is optional (nullable) for backward compatibility
    - Default empty string for better UX
*/

-- Add invitee_name column
ALTER TABLE invitations 
ADD COLUMN IF NOT EXISTS invitee_name text DEFAULT '';