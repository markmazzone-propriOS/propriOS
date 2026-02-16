/*
  # Add Welcome Email Trigger for Service Providers

  ## Overview
  Creates a trigger to send welcome emails when service providers complete their profile setup.

  ## Changes
  1. Create function to send welcome email for service providers
  2. Add trigger on service_provider_profiles table
  3. Reuses existing send-welcome-email edge function

  ## Notes
  - Triggers after insert on service_provider_profiles
  - Sends business name and email to edge function
  - Non-blocking operation using pg_net extension
  - Falls back gracefully on errors
*/

-- Create function to send welcome email for service providers
CREATE OR REPLACE FUNCTION send_service_provider_welcome_email()
RETURNS TRIGGER AS $$
DECLARE
  provider_email text;
  provider_name text;
  request_id bigint;
  edge_function_url text;
  supabase_url text;
BEGIN
  -- Get service provider email and name
  SELECT u.email, p.full_name
  INTO provider_email, provider_name
  FROM auth.users u
  JOIN profiles p ON p.id = u.id
  WHERE u.id = NEW.id;

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
      'email', provider_email,
      'full_name', provider_name,
      'business_name', NEW.business_name,
      'user_type', 'service_provider'
    ),
    timeout_milliseconds := 5000
  ) INTO request_id;

  -- Log the request for debugging
  RAISE LOG 'Welcome email triggered for service provider: % (email: %, request_id: %)', provider_name, provider_email, request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Failed to send welcome email for service provider %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on service_provider_profiles
DROP TRIGGER IF EXISTS trigger_send_service_provider_welcome_email ON service_provider_profiles;

CREATE TRIGGER trigger_send_service_provider_welcome_email
  AFTER INSERT ON service_provider_profiles
  FOR EACH ROW
  EXECUTE FUNCTION send_service_provider_welcome_email();
