/*
  # Fix Serial Number Generation for Dual Signature Documents

  ## Problem
  Serial numbers were only generated when status changed from 'pending' to 'signed'.
  However, documents requiring both sender and recipient signatures transition:
  - First signature: pending → partially_signed
  - Second signature: partially_signed → signed

  The trigger missed the second transition, so dual-signature documents never received serial numbers.

  ## Solution
  Update trigger to also fire when status changes from 'partially_signed' to 'signed'.

  ## Changes
  1. Update trigger function to handle both transitions
  2. Update trigger condition to match both status changes
*/

-- Drop existing trigger
DROP TRIGGER IF EXISTS on_signature_assign_serial_number ON document_signatures;

-- Update function to handle both pending→signed and partially_signed→signed transitions
CREATE OR REPLACE FUNCTION assign_signature_serial_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Assign serial number when status changes to 'signed' (from pending OR partially_signed)
  IF NEW.status = 'signed' AND
     (OLD.status = 'pending' OR OLD.status = 'partially_signed') AND
     NEW.serial_number IS NULL THEN

    NEW.serial_number := generate_signature_serial_number();

    -- Add audit log entry
    NEW.audit_log := NEW.audit_log || jsonb_build_object(
      'timestamp', now(),
      'action', 'serial_number_assigned',
      'details', 'Serial number ' || NEW.serial_number || ' assigned to signature',
      'ip_address', NEW.ip_address,
      'user_agent', NEW.user_agent,
      'user_id', NEW.signer_id
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate trigger with updated condition
CREATE TRIGGER on_signature_assign_serial_number
  BEFORE UPDATE OF status ON document_signatures
  FOR EACH ROW
  WHEN (NEW.status = 'signed' AND (OLD.status = 'pending' OR OLD.status = 'partially_signed'))
  EXECUTE FUNCTION assign_signature_serial_number();

COMMENT ON FUNCTION assign_signature_serial_number() IS 'Automatically assigns unique serial number when document is fully signed (handles both single and dual signature workflows)';
