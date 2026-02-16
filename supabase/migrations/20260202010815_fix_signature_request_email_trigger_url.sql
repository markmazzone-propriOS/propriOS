/*
  # Fix Signature Request Email Trigger URL

  1. Changes
    - Updates the trigger function to use the correct Supabase URL from environment
    - Removes hardcoded URL fallback
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_signature_request_created ON document_signatures;
DROP FUNCTION IF EXISTS notify_signature_request_created();

-- Recreate function without hardcoded URL
CREATE OR REPLACE FUNCTION notify_signature_request_created()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_edge_function_url text;
  v_supabase_url text;
BEGIN
  -- Get Supabase URL from environment
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  
  -- Build edge function URL
  v_edge_function_url := v_supabase_url || '/functions/v1/send-signature-request';

  -- Call edge function asynchronously to send email
  PERFORM http_post(
    v_edge_function_url,
    json_build_object(
      'signature_id', NEW.id
    )::text,
    'application/json'
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the insert
    RAISE WARNING 'Failed to send signature request email: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER on_signature_request_created
  AFTER INSERT ON document_signatures
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION notify_signature_request_created();