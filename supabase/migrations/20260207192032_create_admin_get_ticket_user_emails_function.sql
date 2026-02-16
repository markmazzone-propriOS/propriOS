/*
  # Create admin function to get user emails for support tickets

  1. New Functions
    - `admin_get_ticket_user_info(ticket_id)` - Returns user info for a support ticket
    - Only accessible to admin users
    - Uses SECURITY DEFINER to access auth.users table
    - Handles both authenticated users and guest tickets

  2. Security
    - Function checks that caller is an admin before returning data
*/

-- Function to get user info for a ticket (admin only)
CREATE OR REPLACE FUNCTION admin_get_ticket_user_info(ticket_user_id uuid, ticket_description text)
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
    -- Guest ticket - extract email from description
    guest_email := (regexp_matches(ticket_description, 'Email: ([^\n]+)'))[1];
    RETURN json_build_object('email', COALESCE(guest_email, 'Guest User'));
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION admin_get_ticket_user_info(uuid, text) TO authenticated;
