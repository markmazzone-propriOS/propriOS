/*
  # Fix Brokerage Welcome Email Null URL

  1. Changes
    - Update send_brokerage_welcome_email function to check if URL is not null
    - Only make HTTP call if both URL and service role key are available
  
  2. Security
    - Maintains same functionality but gracefully handles missing vault secrets
*/

-- Update function to check for null URL
CREATE OR REPLACE FUNCTION send_brokerage_welcome_email()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_super_admin_email text;
  v_super_admin_name text;
  v_function_url text;
  v_service_role_key text;
BEGIN
  -- Get super admin email and name from auth.users and profiles
  SELECT 
    au.email,
    COALESCE(p.full_name, au.email)
  INTO 
    v_super_admin_email,
    v_super_admin_name
  FROM auth.users au
  LEFT JOIN profiles p ON p.id = au.id
  WHERE au.id = NEW.super_admin_id;

  -- Get the function URL and service role key from vault
  SELECT decrypted_secret INTO v_function_url
  FROM vault.decrypted_secrets 
  WHERE name = 'SUPABASE_URL';
  
  SELECT decrypted_secret INTO v_service_role_key
  FROM vault.decrypted_secrets 
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';

  -- Only proceed if we have email, URL, and service role key
  IF v_super_admin_email IS NOT NULL 
    AND v_function_url IS NOT NULL 
    AND v_service_role_key IS NOT NULL THEN
    -- Call the edge function to send the welcome email
    PERFORM
      net.http_post(
        url := v_function_url || '/functions/v1/send-brokerage-welcome-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_role_key
        ),
        body := jsonb_build_object(
          'email', v_super_admin_email,
          'company_name', NEW.company_name,
          'super_admin_name', v_super_admin_name,
          'license_number', NEW.license_number
        )
      );
  END IF;

  RETURN NEW;
END;
$$;
