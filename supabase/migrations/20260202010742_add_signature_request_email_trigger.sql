/*
  # Add Automatic Email Notification for Signature Requests

  1. Changes
    - Creates a trigger function to automatically send email notifications when signature requests are created
    - Adds trigger on document_signatures table to call edge function for new requests
  
  2. Security
    - Function runs with SECURITY DEFINER to access edge functions
    - Only triggers on INSERT operations with 'pending' status
*/

-- Function to send signature request email notification
CREATE OR REPLACE FUNCTION notify_signature_request_created()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_edge_function_url text;
BEGIN
  -- Get the edge function URL from environment
  v_edge_function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-signature-request';
  
  -- If setting doesn't exist, use default
  IF v_edge_function_url IS NULL OR v_edge_function_url = '/functions/v1/send-signature-request' THEN
    v_edge_function_url := 'https://bkwrcuvvsgnxaxznnlhg.supabase.co/functions/v1/send-signature-request';
  END IF;

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

-- Create trigger only if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'on_signature_request_created'
  ) THEN
    CREATE TRIGGER on_signature_request_created
      AFTER INSERT ON document_signatures
      FOR EACH ROW
      WHEN (NEW.status = 'pending')
      EXECUTE FUNCTION notify_signature_request_created();
  END IF;
END $$;