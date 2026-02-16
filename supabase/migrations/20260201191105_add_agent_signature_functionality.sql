/*
  # Add Agent E-Signature Functionality with Serial Number Tracking

  ## Overview
  Extends the document signature system to support agents sending signature requests
  to buyers and sellers. Adds unique serial numbers for audit tracking and compliance.

  ## Changes
  1. Add serial number field to document_signatures
  2. Create function to generate unique signature serial numbers
  3. Add agent-specific RLS policies
  4. Create indexes for performance
  5. Add audit trail fields

  ## Serial Number Format
  - Format: SIG-YYYYMMDD-XXXXX (e.g., SIG-20260201-00001)
  - Unique, sequential, and date-based for easy tracking
  - Automatically generated on signature completion

  ## Security
  - Agents can send signature requests to their buyers and sellers
  - Both parties can view signature requests they're involved in
  - Serial numbers are immutable once assigned
*/

-- Add serial number and audit fields to document_signatures
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_signatures' AND column_name = 'serial_number'
  ) THEN
    ALTER TABLE document_signatures ADD COLUMN serial_number text UNIQUE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_signatures' AND column_name = 'audit_log'
  ) THEN
    ALTER TABLE document_signatures ADD COLUMN audit_log jsonb DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_signatures' AND column_name = 'user_agent'
  ) THEN
    ALTER TABLE document_signatures ADD COLUMN user_agent text;
  END IF;
END $$;

-- Function to generate unique signature serial number
CREATE OR REPLACE FUNCTION generate_signature_serial_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date_prefix text;
  v_sequence int;
  v_serial_number text;
  v_exists boolean;
BEGIN
  -- Get today's date prefix
  v_date_prefix := 'SIG-' || to_char(now(), 'YYYYMMDD') || '-';

  -- Find the next available sequence number for today
  v_sequence := 1;
  LOOP
    v_serial_number := v_date_prefix || lpad(v_sequence::text, 5, '0');

    -- Check if this serial number exists
    SELECT EXISTS (
      SELECT 1 FROM document_signatures WHERE serial_number = v_serial_number
    ) INTO v_exists;

    -- If it doesn't exist, we found our number
    EXIT WHEN NOT v_exists;

    -- Otherwise, increment and try again
    v_sequence := v_sequence + 1;

    -- Safety check to prevent infinite loop
    IF v_sequence > 99999 THEN
      RAISE EXCEPTION 'Serial number sequence exhausted for today';
    END IF;
  END LOOP;

  RETURN v_serial_number;
END;
$$;

-- Function to add audit log entry
CREATE OR REPLACE FUNCTION add_signature_audit_entry(
  p_signature_id uuid,
  p_action text,
  p_details text,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry jsonb;
BEGIN
  v_entry := jsonb_build_object(
    'timestamp', now(),
    'action', p_action,
    'details', p_details,
    'ip_address', p_ip_address,
    'user_agent', p_user_agent,
    'user_id', auth.uid()
  );

  UPDATE document_signatures
  SET
    audit_log = audit_log || v_entry,
    updated_at = now()
  WHERE id = p_signature_id;
END;
$$;

-- Trigger to automatically assign serial number when signature is completed
CREATE OR REPLACE FUNCTION assign_signature_serial_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only assign serial number when status changes to 'signed'
  IF NEW.status = 'signed' AND OLD.status = 'pending' AND NEW.serial_number IS NULL THEN
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

CREATE TRIGGER on_signature_assign_serial_number
  BEFORE UPDATE OF status ON document_signatures
  FOR EACH ROW
  WHEN (NEW.status = 'signed' AND OLD.status = 'pending')
  EXECUTE FUNCTION assign_signature_serial_number();

-- Add RLS policy for agents to view signature requests they sent
CREATE POLICY "Agents can view signature requests for their clients"
  ON document_signatures FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'agent'
      AND (
        -- Agent is the sender
        auth.uid() = sender_id
        OR
        -- Agent is assigned to the signer (buyer or seller)
        EXISTS (
          SELECT 1 FROM profiles signer_profile
          WHERE signer_profile.id = signer_id
          AND (
            signer_profile.assigned_agent_id = auth.uid()
            OR signer_profile.managed_by_agent_id = auth.uid()
          )
        )
      )
    )
  );

-- Add RLS policy for agents to create signature requests for their clients
CREATE POLICY "Agents can create signature requests for their clients"
  ON document_signatures FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'agent'
      AND (
        -- Agent is the sender
        auth.uid() = sender_id
        OR
        -- Agent is managing the signer
        EXISTS (
          SELECT 1 FROM profiles signer_profile
          WHERE signer_profile.id = signer_id
          AND (
            signer_profile.assigned_agent_id = auth.uid()
            OR signer_profile.managed_by_agent_id = auth.uid()
          )
        )
      )
    )
  );

-- Add index for serial number lookups
CREATE INDEX IF NOT EXISTS idx_document_signatures_serial_number ON document_signatures(serial_number);

-- Add comment to table
COMMENT ON COLUMN document_signatures.serial_number IS 'Unique serial number for audit tracking (format: SIG-YYYYMMDD-XXXXX)';
COMMENT ON COLUMN document_signatures.audit_log IS 'JSON array of audit trail entries for compliance';
