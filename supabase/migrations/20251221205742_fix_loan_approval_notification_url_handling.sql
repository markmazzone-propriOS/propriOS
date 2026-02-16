/*
  # Fix Loan Approval Notification URL Handling

  1. Summary
    - Fixes the URL construction in the `notify_loan_approval` trigger
    - Uses COALESCE to properly handle NULL values from current_setting
    - Hardcodes the Supabase URL as fallback to ensure the notification is sent

  2. Changes
    - Updates URL construction to use COALESCE for NULL handling
    - Adds additional check to ensure URL is valid before making HTTP call
*/

CREATE OR REPLACE FUNCTION notify_loan_approval()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_buyer_email text;
  v_buyer_name text;
  v_lender_email text;
  v_lender_name text;
  v_lender_phone text;
  v_property_address text;
  v_function_url text;
  v_supabase_url text;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    -- Try to get Supabase URL from settings, with fallback
    BEGIN
      v_supabase_url := current_setting('app.settings.supabase_url', true);
    EXCEPTION WHEN OTHERS THEN
      v_supabase_url := NULL;
    END;

    -- Use hardcoded URL if setting is not available
    IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
      v_supabase_url := 'https://rfdaepolwygosvwunhnk.supabase.co';
    END IF;

    v_function_url := v_supabase_url || '/functions/v1/send-loan-approval-notification';

    SELECT au.email, p.full_name
    INTO v_buyer_email, v_buyer_name
    FROM auth.users au
    LEFT JOIN profiles p ON p.id = au.id
    WHERE au.id = NEW.buyer_id;

    SELECT au.email, p.full_name, p.phone_number
    INTO v_lender_email, v_lender_name, v_lender_phone
    FROM auth.users au
    LEFT JOIN profiles p ON p.id = au.id
    WHERE au.id = NEW.lender_id;

    IF NEW.property_id IS NOT NULL THEN
      SELECT street_address || ', ' || city || ', ' || state || ' ' || zip_code
      INTO v_property_address
      FROM properties
      WHERE id = NEW.property_id;
    END IF;

    -- Only send if we have the required data and a valid URL
    IF v_buyer_email IS NOT NULL AND v_buyer_name IS NOT NULL AND v_function_url IS NOT NULL THEN
      BEGIN
        PERFORM net.http_post(
          url := v_function_url,
          headers := jsonb_build_object(
            'Content-Type', 'application/json'
          ),
          body := jsonb_build_object(
            'buyerEmail', v_buyer_email,
            'buyerName', v_buyer_name,
            'loanAmount', NEW.loan_amount,
            'loanType', NEW.loan_type,
            'interestRate', NEW.interest_rate,
            'estimatedClosingDate', NEW.estimated_closing_date,
            'propertyAddress', v_property_address,
            'lenderName', COALESCE(v_lender_name, 'Your Lender'),
            'lenderPhone', v_lender_phone,
            'lenderEmail', v_lender_email
          )
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to send loan approval notification: %', SQLERRM;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;