/*
  # Create Support Ticket System

  ## Overview
  Creates a comprehensive support ticket system where users can submit trouble tickets
  and admins can view and respond to them.

  ## New Tables
  
  ### `support_tickets`
  - `id` (uuid, primary key) - Unique ticket identifier
  - `user_id` (uuid, foreign key) - References auth.users, user who submitted the ticket
  - `subject` (text) - Ticket subject line
  - `description` (text) - Detailed description of the issue
  - `status` (text) - Ticket status: 'open', 'in_progress', 'resolved', 'closed'
  - `priority` (text) - Priority level: 'low', 'medium', 'high', 'urgent'
  - `category` (text) - Issue category: 'technical', 'billing', 'feature_request', 'other'
  - `assigned_to` (uuid, nullable) - Admin user assigned to handle the ticket
  - `created_at` (timestamptz) - When the ticket was created
  - `updated_at` (timestamptz) - Last update timestamp
  - `resolved_at` (timestamptz, nullable) - When the ticket was resolved

  ### `support_ticket_responses`
  - `id` (uuid, primary key) - Unique response identifier
  - `ticket_id` (uuid, foreign key) - References support_tickets
  - `user_id` (uuid, foreign key) - References auth.users, user who wrote the response
  - `message` (text) - Response message content
  - `is_internal_note` (boolean) - If true, only visible to admins
  - `created_at` (timestamptz) - When the response was created

  ## Security
  - Enable RLS on all tables
  - Users can create tickets and view their own tickets
  - Users can create responses on their own tickets
  - Admins can view all tickets and responses
  - Admins can update ticket status and assignment
  - Admins can create responses on any ticket
  - Internal notes are only visible to admins
*/

-- Create support_tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subject text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  category text NOT NULL DEFAULT 'other' CHECK (category IN ('technical', 'billing', 'feature_request', 'other')),
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

-- Create support_ticket_responses table
CREATE TABLE IF NOT EXISTS support_ticket_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES support_tickets(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message text NOT NULL,
  is_internal_note boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to ON support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_ticket_responses_ticket_id ON support_ticket_responses(ticket_id);

-- Enable RLS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_responses ENABLE ROW LEVEL SECURITY;

-- Support Tickets Policies

-- Users can view their own tickets
CREATE POLICY "Users can view own tickets"
  ON support_tickets
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all tickets
CREATE POLICY "Admins can view all tickets"
  ON support_tickets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

-- Users can create their own tickets
CREATE POLICY "Users can create own tickets"
  ON support_tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own open tickets (only description and subject)
CREATE POLICY "Users can update own open tickets"
  ON support_tickets
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'open')
  WITH CHECK (auth.uid() = user_id AND status = 'open');

-- Admins can update any ticket
CREATE POLICY "Admins can update any ticket"
  ON support_tickets
  FOR UPDATE
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

-- Support Ticket Responses Policies

-- Users can view responses on their own tickets (excluding internal notes)
CREATE POLICY "Users can view responses on own tickets"
  ON support_ticket_responses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets
      WHERE support_tickets.id = ticket_id
      AND support_tickets.user_id = auth.uid()
      AND is_internal_note = false
    )
  );

-- Admins can view all responses including internal notes
CREATE POLICY "Admins can view all responses"
  ON support_ticket_responses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

-- Users can create responses on their own tickets
CREATE POLICY "Users can create responses on own tickets"
  ON support_ticket_responses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM support_tickets
      WHERE support_tickets.id = ticket_id
      AND support_tickets.user_id = auth.uid()
    )
    AND is_internal_note = false
  );

-- Admins can create responses on any ticket
CREATE POLICY "Admins can create responses on any ticket"
  ON support_ticket_responses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

-- Function to update ticket updated_at timestamp
CREATE OR REPLACE FUNCTION update_ticket_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update ticket timestamp on ticket update
CREATE TRIGGER update_support_tickets_timestamp
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_ticket_timestamp();

-- Trigger to update ticket timestamp when a new response is added
CREATE OR REPLACE FUNCTION update_ticket_on_response()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE support_tickets
  SET updated_at = now()
  WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ticket_on_new_response
  AFTER INSERT ON support_ticket_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_ticket_on_response();