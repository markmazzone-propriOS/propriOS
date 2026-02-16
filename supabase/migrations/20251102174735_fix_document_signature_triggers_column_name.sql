/*
  # Fix Document Signature Triggers - Column Name

  ## Changes
  - Update trigger functions to use `file_name` instead of `title` 
  - The documents table uses `file_name` not `title`

  ## Functions Updated
  1. `notify_signature_request_sent()` - line 200
  2. `notify_signature_completed()` - line 266
*/

-- Fix trigger: Create activity when signature request is sent
CREATE OR REPLACE FUNCTION notify_signature_request_sent()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_document_name text;
  v_signer_name text;
  v_sender_name text;
BEGIN
  -- Get document and user names
  SELECT file_name INTO v_document_name
  FROM documents
  WHERE id = NEW.document_id;

  SELECT full_name INTO v_signer_name
  FROM profiles
  WHERE id = NEW.signer_id;

  SELECT full_name INTO v_sender_name
  FROM profiles
  WHERE id = NEW.sender_id;

  -- Create activity for signer
  PERFORM create_activity(
    NEW.signer_id,
    NEW.sender_id,
    'signature_request',
    'Signature Required',
    v_sender_name || ' sent "' || v_document_name || '" for your signature',
    NEW.id,
    'document_signature',
    jsonb_build_object(
      'document_id', NEW.document_id,
      'document_name', v_document_name,
      'expires_at', NEW.expires_at
    )
  );

  -- Create activity for sender
  PERFORM create_activity(
    NEW.sender_id,
    NEW.signer_id,
    'signature_request_sent',
    'Signature Request Sent',
    'Sent "' || v_document_name || '" to ' || v_signer_name || ' for signature',
    NEW.id,
    'document_signature',
    jsonb_build_object(
      'document_id', NEW.document_id,
      'document_name', v_document_name,
      'signer_name', v_signer_name
    )
  );

  RETURN NEW;
END;
$$;

-- Fix trigger: Create activity when document is signed
CREATE OR REPLACE FUNCTION notify_signature_completed()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_document_name text;
  v_signer_name text;
BEGIN
  IF NEW.status = 'signed' AND OLD.status = 'pending' THEN
    -- Get document and user names
    SELECT file_name INTO v_document_name
    FROM documents
    WHERE id = NEW.document_id;

    SELECT full_name INTO v_signer_name
    FROM profiles
    WHERE id = NEW.signer_id;

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
  END IF;

  RETURN NEW;
END;
$$;
