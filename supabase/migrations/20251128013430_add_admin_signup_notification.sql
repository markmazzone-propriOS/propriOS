/*
  # Add Admin Signup Notification

  ## Overview
  When a new user signs up, send an email notification to the admin with details
  about the new user including their user type, email, full name, and signup date/time.

  ## Changes
  - Create function to send admin notification on profile creation
  - Add trigger to call the function when a new profile is created
  - Admin receives email with all relevant user information
*/

-- Create function to send admin notification on new user signup
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

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS trigger_send_admin_signup_notification ON profiles;

-- Create trigger to send admin notification on new profile creation
CREATE TRIGGER trigger_send_admin_signup_notification
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION send_admin_signup_notification();