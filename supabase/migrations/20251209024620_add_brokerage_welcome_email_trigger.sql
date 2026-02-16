/*
  # Add Brokerage Welcome Email Trigger

  1. Changes
    - Create trigger function to send welcome email when a new brokerage is created
    - Attach trigger to brokerages table on INSERT
  
  2. Details
    - Automatically sends welcome email to brokerage super admin
    - Includes company name, super admin name, and license number
    - Runs asynchronously after brokerage creation
*/

-- Create function to send brokerage welcome email
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

  -- Only proceed if we have the email
  IF v_super_admin_email IS NOT NULL THEN
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

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_send_brokerage_welcome_email ON brokerages;

-- Create trigger to send welcome email when a brokerage is created
CREATE TRIGGER trigger_send_brokerage_welcome_email
  AFTER INSERT ON brokerages
  FOR EACH ROW
  EXECUTE FUNCTION send_brokerage_welcome_email();
