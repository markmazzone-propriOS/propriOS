/*
  # Fix Welcome Email Trigger

  1. Changes
    - Update send_agent_welcome_email function to correctly get email from auth.users
    - Fix SQL query to properly join tables

  2. Notes
    - Email is stored in auth.users, not profiles
    - Function will now correctly retrieve agent email and name
*/

-- Update function to fix email retrieval
CREATE OR REPLACE FUNCTION send_agent_welcome_email()
RETURNS TRIGGER AS $$
DECLARE
  agent_email text;
  agent_name text;
  request_id bigint;
  edge_function_url text;
  supabase_url text;
BEGIN
  -- Get agent email and name
  SELECT u.email, p.full_name
  INTO agent_email, agent_name
  FROM auth.users u
  JOIN profiles p ON p.id = u.id
  WHERE u.id = NEW.id;

  -- Construct edge function URL
  -- Try to get from settings first, fall back to environment
  BEGIN
    supabase_url := current_setting('request.headers', true)::json->>'x-forwarded-host';
    IF supabase_url IS NOT NULL THEN
      edge_function_url := 'https://' || supabase_url || '/functions/v1/send-welcome-email';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      supabase_url := NULL;
  END;

  -- If we couldn't get it from headers, construct from environment
  IF edge_function_url IS NULL THEN
    BEGIN
      supabase_url := current_setting('app.settings.supabase_url', true);
      IF supabase_url IS NOT NULL THEN
        edge_function_url := supabase_url || '/functions/v1/send-welcome-email';
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END IF;

  -- Last resort: use a default pattern
  IF edge_function_url IS NULL THEN
    -- This will fail but at least we tried
    edge_function_url := 'http://localhost:54321/functions/v1/send-welcome-email';
  END IF;

  -- Make async HTTP request to edge function
  SELECT net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'email', agent_email,
      'full_name', agent_name,
      'license_number', NEW.license_number
    ),
    timeout_milliseconds := 5000
  ) INTO request_id;

  -- Log the request for debugging
  RAISE LOG 'Welcome email triggered for agent: % (email: %, request_id: %)', agent_name, agent_email, request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Failed to send welcome email for agent %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
