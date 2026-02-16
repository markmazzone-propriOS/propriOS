/*
  # Add Email Field to Support Tickets

  1. Changes
    - Adds email column to support_tickets table for guest user notifications
    - Email is nullable since authenticated users get email from auth.users

  2. Security
    - No RLS changes needed as existing policies cover this field
*/

-- Add email column for guest tickets
ALTER TABLE support_tickets
ADD COLUMN IF NOT EXISTS email TEXT;

-- Add comment explaining the column usage
COMMENT ON COLUMN support_tickets.email IS 'Email address for guest tickets (when user_id is null). For authenticated users, email is retrieved from auth.users.';
