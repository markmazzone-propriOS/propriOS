/*
  # Fix Loan Approval Notification Phone Column Reference

  1. Summary
    - Fixes the `notify_loan_approval` trigger function to use correct column name
    - Changes `p.phone` to `p.phone_number` to match the profiles table schema

  2. Changes
    - Updates the SELECT query in notify_loan_approval function to use phone_number instead of phone
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
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    v_function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-loan-approval-notification';
    
    IF v_function_url IS NULL OR v_function_url = '' THEN
      v_function_url := 'https://' || current_setting('app.settings.supabase_project_ref', true) || '.supabase.co/functions/v1/send-loan-approval-notification';
    END IF;

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

    IF v_buyer_email IS NOT NULL AND v_buyer_name IS NOT NULL THEN
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