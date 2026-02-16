/*
  # Add Email Notification When Document is Signed

  ## Overview
  Updates the signature completion trigger to send email notifications to property owners
  when renters sign documents. This ensures owners are immediately informed via email.

  ## Changes
  1. Updates `notify_signature_completed()` function to:
     - Send email notification to property owner via edge function
     - Include document name, signer name, and property address in notification
     - Log any errors but don't fail the transaction

  ## Security
  - Uses SECURITY DEFINER to allow calling edge function
  - Validates all data before sending
*/

-- Update the signature completion notification function
CREATE OR REPLACE FUNCTION notify_signature_completed()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_document_name text;
  v_signer_name text;
  v_sender_name text;
  v_sender_email text;
  v_property_address text;
  v_rental_app_id uuid;
  v_supabase_url text;
  v_supabase_anon_key text;
BEGIN
  IF NEW.status = 'signed' AND OLD.status = 'pending' THEN
    -- Get document and user names
    SELECT title INTO v_document_name
    FROM documents
    WHERE id = NEW.document_id;

    SELECT full_name INTO v_signer_name
    FROM profiles
    WHERE id = NEW.signer_id;

    SELECT full_name INTO v_sender_name
    FROM profiles
    WHERE id = NEW.sender_id;

    -- Get sender email
    SELECT email INTO v_sender_email
    FROM auth.users
    WHERE id = NEW.sender_id;

    -- Try to get property address if this is related to a rental application
    v_rental_app_id := NEW.rental_application_id;
    IF v_rental_app_id IS NOT NULL THEN
      SELECT
        p.address_line1 || ', ' || p.city || ', ' || p.state || ' ' || p.zip_code
      INTO v_property_address
      FROM rental_applications ra
      JOIN properties p ON ra.property_id = p.id
      WHERE ra.id = v_rental_app_id;
    END IF;

    -- Create activity for sender (property owner)
    PERFORM create_activity(
      NEW.sender_id,
      NEW.signer_id,
      'signature_completed',
      'Document Signed',
      v_signer_name || ' signed "' || v_document_name || '"',
      NEW.id,
      'document_signature',
      jsonb_build_object(
        'document_id', NEW.document_id,
        'document_name', v_document_name,
        'signed_at', NEW.signed_at
      )
    );

    -- Create activity for signer
    PERFORM create_activity(
      NEW.signer_id,
      NEW.sender_id,
      'signature_completed',
      'Document Signed',
      'You signed "' || v_document_name || '"',
      NEW.id,
      'document_signature',
      jsonb_build_object(
        'document_id', NEW.document_id,
        'document_name', v_document_name,
        'signed_at', NEW.signed_at
      )
    );

    -- Send email notification to property owner
    BEGIN
      -- Get Supabase configuration from vault or environment
      SELECT decrypted_secret INTO v_supabase_url
      FROM vault.decrypted_secrets
      WHERE name = 'SUPABASE_URL'
      LIMIT 1;

      SELECT decrypted_secret INTO v_supabase_anon_key
      FROM vault.decrypted_secrets
      WHERE name = 'SUPABASE_ANON_KEY'
      LIMIT 1;

      -- If not in vault, try current_setting (for local development)
      IF v_supabase_url IS NULL THEN
        v_supabase_url := current_setting('app.settings.supabase_url', true);
      END IF;

      IF v_supabase_anon_key IS NULL THEN
        v_supabase_anon_key := current_setting('app.settings.supabase_anon_key', true);
      END IF;

      -- Only attempt to send email if we have the necessary configuration
      IF v_sender_email IS NOT NULL AND v_supabase_url IS NOT NULL THEN
        PERFORM
          net.http_post(
            url := v_supabase_url || '/functions/v1/send-document-signed-notification',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || COALESCE(v_supabase_anon_key, '')
            ),
            body := jsonb_build_object(
              'ownerEmail', v_sender_email,
              'ownerName', v_sender_name,
              'signerName', v_signer_name,
              'documentName', v_document_name,
              'signedAt', NEW.signed_at,
              'propertyAddress', v_property_address
            )
          );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Log the error but don't fail the transaction
      RAISE WARNING 'Failed to send email notification: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;
