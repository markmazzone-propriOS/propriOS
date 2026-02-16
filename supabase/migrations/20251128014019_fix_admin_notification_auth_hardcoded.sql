/*
  # Fix Admin Signup Notification Authorization (Hardcoded Key)

  ## Overview
  The admin signup notification trigger needs the anon key to authorize
  edge function calls. Since the key is already public in the frontend,
  we can hardcode it here.

  ## Changes
  - Hardcode the Supabase anon key in the trigger function
  - This allows the edge function to be called successfully
*/

CREATE OR REPLACE FUNCTION send_admin_signup_notification()
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
  edge_function_url := 'https://rfdaepolwygosvwunhnk.supabase.co/functions/v1/send-admin-signup-notification';

  RAISE LOG 'Sending admin notification for new %: % (%)', user_type_val, user_full_name, user_email;

  -- Make async HTTP request to edge function with authorization
  BEGIN
    SELECT net.http_post(
      url := edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmZGFlcG9sd3lnb3N2d3VuaG5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxMjEwODYsImV4cCI6MjA3NTY5NzA4Nn0.zqEX5HrXyE8uS2ymApqe6MHWIgFsS4rjml_R-U7tFvw',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmZGFlcG9sd3lnb3N2d3VuaG5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxMjEwODYsImV4cCI6MjA3NTY5NzA4Nn0.zqEX5HrXyE8uS2ymApqe6MHWIgFsS4rjml_R-U7tFvw'
      ),
      body := jsonb_build_object(
        'email', user_email,
        'full_name', user_full_name,
        'user_type', user_type_val,
        'signup_date', NEW.created_at
      ),
      timeout_milliseconds := 5000
    ) INTO request_id;

    RAISE LOG 'Admin notification sent: request_id=%', request_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Admin notification HTTP request failed: %', SQLERRM;
  END;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Failed to send admin notification for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;