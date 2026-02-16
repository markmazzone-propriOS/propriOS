/*
  # Update admin_get_ticket_user_info to use email column

  1. Changes
    - Updates admin_get_ticket_user_info function to use the new email column for guest tickets
    - Adds ticket_email parameter to the function signature
    - Falls back to parsing description if email column is not available

  2. Security
    - Maintains existing SECURITY DEFINER and admin-only access
*/

-- Update function to get user info for a ticket (admin only)
CREATE OR REPLACE FUNCTION admin_get_ticket_user_info(ticket_user_id uuid, ticket_description text, ticket_email text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  user_email text;
  guest_email text;
BEGIN
  -- Check if the caller is an admin
  IF NOT EXISTS (
    SELECT 1 FROM admin_users WHERE id = auth.uid()
  ) THEN
    RETURN json_build_object('email', 'Unauthorized');
  END IF;

  -- If ticket has a user_id, get email from auth.users
  IF ticket_user_id IS NOT NULL THEN
    SELECT email INTO user_email
    FROM auth.users
    WHERE id = ticket_user_id;
    
    RETURN json_build_object('email', COALESCE(user_email, 'Unknown'));
  ELSE
    -- Guest ticket - use email column if available, otherwise extract from description
    IF ticket_email IS NOT NULL AND ticket_email != '' THEN
      RETURN json_build_object('email', ticket_email);
    ELSE
      -- Fallback: extract email from description
      guest_email := (regexp_matches(ticket_description, 'Email: ([^\n]+)'))[1];
      RETURN json_build_object('email', COALESCE(guest_email, 'Guest User'));
    END IF;
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION admin_get_ticket_user_info(uuid, text, text) TO authenticated;
