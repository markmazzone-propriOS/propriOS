/*
  # Add soft delete to support tickets

  1. Changes
    - Add `deleted_at` column to support_tickets table
    - Add `deleted_by` column to track who deleted the ticket
    - Create index for efficient querying of non-deleted tickets
    - Update RLS policies to exclude deleted tickets from normal views
    - Keep analytics queries able to see all tickets (deleted or not)

  2. Benefits
    - Maintains historical data for analytics
    - Allows potential ticket restoration
    - Preserves data integrity for reporting
    - Tracks who deleted tickets for audit purposes

  3. Security
    - Only admins can see deleted tickets
    - Normal users cannot see or access deleted tickets
*/

-- Add soft delete columns
ALTER TABLE support_tickets 
ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id);

-- Create index for efficient querying of active (non-deleted) tickets
CREATE INDEX IF NOT EXISTS idx_support_tickets_deleted_at ON support_tickets(deleted_at) WHERE deleted_at IS NULL;

-- Update existing select policies to exclude deleted tickets for users
DROP POLICY IF EXISTS "Users can view own tickets" ON support_tickets;
CREATE POLICY "Users can view own tickets"
  ON support_tickets FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() 
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS "Guest users can view own tickets via email" ON support_tickets;
CREATE POLICY "Guest users can view own tickets via email"
  ON support_tickets FOR SELECT
  TO anon
  USING (
    user_id IS NULL 
    AND deleted_at IS NULL
  );

-- Update admin select policy to show both deleted and non-deleted tickets
DROP POLICY IF EXISTS "Admins can view all tickets" ON support_tickets;
CREATE POLICY "Admins can view all tickets"
  ON support_tickets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

-- Update the delete policy to do soft delete instead
DROP POLICY IF EXISTS "Admins can delete support tickets" ON support_tickets;
CREATE POLICY "Admins can soft delete support tickets"
  ON support_tickets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );
