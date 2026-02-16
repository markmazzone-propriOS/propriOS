/*
  # Fix Admin Signup Notification Authorization

  ## Overview
  The admin signup notification trigger was failing with 401 unauthorized
  because it wasn't including the authorization header when calling the edge function.

  ## Changes
  - Update trigger to include Supabase anon key in authorization header
  - This allows the edge function to be called successfully from the database
*/

CREATE OR REPLACE FUNCTION send_admin_signup_notification()
RETURNS TRIGGER AS $$
DECLARE
  user_email text;
  user_full_name text;
  user_type_val text;
  request_id bigint;
  edge_function_url text;
  supabase_anon_key text;
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
  
  -- Get the anon key from vault (stored as SUPABASE_ANON_KEY secret)
  SELECT decrypted_secret INTO supabase_anon_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_ANON_KEY'
  LIMIT 1;

  RAISE LOG 'Sending admin notification for new %: % (%)', user_type_val, user_full_name, user_email;

  -- Make async HTTP request to edge function with authorization
  BEGIN
    SELECT net.http_post(
      url := edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(supabase_anon_key, '')
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