/*
  # Add Ticket Reply Tokens

  ## Overview
  Adds secure reply tokens to support tickets so users (including guests) 
  can respond to tickets via email without needing to log in.

  ## Changes
  1. New Columns
    - `reply_token` (text, unique) - Secure token for replying to tickets
    - Generated automatically when ticket is created
  
  2. New Function
    - `generate_ticket_reply_token()` - Generates secure random token
  
  3. New Trigger
    - Sets reply_token on ticket creation
  
  4. New Policies
    - Allow anyone with valid reply_token to view specific ticket
    - Allow anyone with valid reply_token to add responses to specific ticket

  ## Security
  - Tokens are cryptographically secure random strings
  - Tokens are unique across all tickets
  - Access is limited to specific ticket only
  - Cannot be used to access other tickets or user data
*/

-- Add reply_token column to support_tickets
ALTER TABLE support_tickets 
ADD COLUMN IF NOT EXISTS reply_token text UNIQUE;

-- Create index for token lookups
CREATE INDEX IF NOT EXISTS idx_support_tickets_reply_token ON support_tickets(reply_token);

-- Function to generate secure reply token
CREATE OR REPLACE FUNCTION generate_ticket_reply_token()
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'hex');
END;
$$;

-- Function to set reply token on ticket creation
CREATE OR REPLACE FUNCTION set_ticket_reply_token()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.reply_token IS NULL THEN
    NEW.reply_token := generate_ticket_reply_token();
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger to set reply token
DROP TRIGGER IF EXISTS set_ticket_reply_token_trigger ON support_tickets;

CREATE TRIGGER set_ticket_reply_token_trigger
  BEFORE INSERT ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION set_ticket_reply_token();

-- Backfill reply tokens for existing tickets
UPDATE support_tickets 
SET reply_token = generate_ticket_reply_token()
WHERE reply_token IS NULL;

-- Policy: Anyone with valid token can view the ticket
CREATE POLICY "Anyone with reply token can view ticket"
  ON support_tickets
  FOR SELECT
  TO anon, authenticated
  USING (
    reply_token = current_setting('request.jwt.claims', true)::json->>'reply_token'
    OR
    reply_token IN (
      SELECT unnest(string_to_array(current_setting('app.current_reply_token', true), ','))
    )
  );

-- Policy: Anyone with valid token can add responses (non-internal)
CREATE POLICY "Anyone with reply token can add responses"
  ON support_ticket_responses
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM support_tickets
      WHERE support_tickets.id = ticket_id
      AND (
        support_tickets.reply_token = current_setting('request.jwt.claims', true)::json->>'reply_token'
        OR
        support_tickets.reply_token IN (
          SELECT unnest(string_to_array(current_setting('app.current_reply_token', true), ','))
        )
      )
    )
    AND is_internal_note = false
  );

-- Policy: Anyone with valid token can view responses on their ticket
CREATE POLICY "Anyone with reply token can view ticket responses"
  ON support_ticket_responses
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets
      WHERE support_tickets.id = ticket_id
      AND (
        support_tickets.reply_token = current_setting('request.jwt.claims', true)::json->>'reply_token'
        OR
        support_tickets.reply_token IN (
          SELECT unnest(string_to_array(current_setting('app.current_reply_token', true), ','))
        )
      )
    )
    AND is_internal_note = false
  );
