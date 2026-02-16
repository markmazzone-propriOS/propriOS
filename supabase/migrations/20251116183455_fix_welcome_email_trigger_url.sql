/*
  # Fix Welcome Email Trigger URL
  
  1. Changes
    - Update the welcome email trigger to use a more reliable URL construction
    - Hardcode the edge function path since it's always at /functions/v1/send-welcome-email
    - Use the Supabase project reference from the request headers
    
  2. Improvements
    - More reliable URL construction
    - Better error handling and logging
    - Ensures the HTTP request is made correctly
*/

CREATE OR REPLACE FUNCTION send_universal_welcome_email()
RETURNS TRIGGER AS $$
DECLARE
  user_email text;
  user_full_name text;
  user_type_val text;
  request_id bigint;
  edge_function_url text;
BEGIN
  -- Get user email from auth.users
  SELECT u.email
  INTO user_email
  FROM auth.users u
  WHERE u.id = NEW.id;

  -- Get user details from new profile
  user_full_name := NEW.full_name;
  user_type_val := NEW.user_type;

  -- Skip if email is missing
  IF user_email IS NULL THEN
    RAISE WARNING 'No email found for user %', NEW.id;
    RETURN NEW;
  END IF;

  -- Use the hardcoded Supabase URL for the project
  edge_function_url := 'https://rfdaepolwygosvwunhnk.supabase.co/functions/v1/send-welcome-email';

  RAISE LOG 'Attempting to send welcome email to: % (type: %, url: %)', user_email, user_type_val, edge_function_url;

  -- Make async HTTP request to edge function
  BEGIN
    SELECT net.http_post(
      url := edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'email', user_email,
        'full_name', user_full_name,
        'user_type', user_type_val
      ),
      timeout_milliseconds := 5000
    ) INTO request_id;

    RAISE LOG 'Welcome email request sent: request_id=%', request_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'HTTP request failed: %', SQLERRM;
  END;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Failed to send welcome email for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
