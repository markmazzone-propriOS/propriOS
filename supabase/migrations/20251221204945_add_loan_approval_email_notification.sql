/*
  # Add Loan Approval Email Notification

  1. Summary
    - Creates automatic email notification when a loan application status is updated to 'approved'
    - Sends professionally designed email to buyer with loan details
    - Includes loan amount, interest rate, closing date, and lender information

  2. Changes
    - New trigger function `notify_loan_approval` that fires when loan status changes to 'approved'
    - Fetches buyer and lender information from auth.users and profiles
    - Calls edge function `send-loan-approval-notification` to send email
    - Handles property address lookup if property_id is present

  3. Security
    - Function runs with SECURITY DEFINER to access auth.users
    - Only triggers on status change from non-approved to approved status
    - Uses environment variable for function URL
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

    SELECT au.email, p.full_name, p.phone
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

DROP TRIGGER IF EXISTS trigger_notify_loan_approval ON loan_applications;

CREATE TRIGGER trigger_notify_loan_approval
  AFTER UPDATE ON loan_applications
  FOR EACH ROW
  EXECUTE FUNCTION notify_loan_approval();
