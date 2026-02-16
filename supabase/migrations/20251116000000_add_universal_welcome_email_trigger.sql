/*
  # Add Universal Welcome Email Trigger for All User Types

  1. Changes
    - Create universal welcome email function that triggers on profile creation
    - Sends welcome email to ALL user types at account creation time
    - Replaces the agent-specific and service-provider-specific triggers
    - Triggers on profiles table insert (right after account creation)

  2. User Types Covered
    - Buyers
    - Sellers
    - Renters
    - Agents (already exists but will use new trigger)
    - Service Providers (already exists but will use new trigger)
    - Property Owners
    - Mortgage Lenders
    - Admin

  3. Security
    - Function runs with SECURITY DEFINER to access auth.users
    - Non-blocking operation using pg_net
    - Graceful error handling to not block account creation

  4. Notes
    - This replaces the need for separate triggers per user type
    - Welcome email is sent immediately after profile creation
    - Edge function handles user-type-specific email content
*/

-- Create universal function to send welcome email for any user type
CREATE OR REPLACE FUNCTION send_universal_welcome_email()
RETURNS TRIGGER AS $$
DECLARE
  user_email text;
  user_full_name text;
  user_type_val text;
  request_id bigint;
  edge_function_url text;
  supabase_url text;
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

  -- Construct edge function URL
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
    edge_function_url := 'http://localhost:54321/functions/v1/send-welcome-email';
  END IF;

  -- Make async HTTP request to edge function
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

  -- Log the request for debugging
  RAISE LOG 'Welcome email triggered for user: % (email: %, type: %, request_id: %)',
    user_full_name, user_email, user_type_val, request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Failed to send welcome email for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_send_universal_welcome_email ON profiles;

-- Create trigger on profiles table (fires for all user types)
CREATE TRIGGER trigger_send_universal_welcome_email
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION send_universal_welcome_email();
