/*
  # Create Phone Verification System

  1. New Tables
    - `phone_verification_codes`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `phone_number` (text) - Phone being verified
      - `code` (text) - 6-digit verification code
      - `expires_at` (timestamptz) - Code expiration time (10 minutes)
      - `verified` (boolean) - Whether code was successfully verified
      - `attempts` (integer) - Number of verification attempts
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on table
    - Users can only access their own verification codes
    - Codes expire after 10 minutes
    - Maximum 3 verification attempts per code

  3. Functions
    - Generate random 6-digit verification code
    - Check if code is valid and not expired
*/

-- Create phone verification codes table
CREATE TABLE IF NOT EXISTS phone_verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  verified boolean DEFAULT false,
  attempts integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_phone_verification_user ON phone_verification_codes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_phone_verification_expires ON phone_verification_codes(expires_at) WHERE verified = false;

-- Enable RLS
ALTER TABLE phone_verification_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own verification codes"
  ON phone_verification_codes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own verification codes"
  ON phone_verification_codes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own verification codes"
  ON phone_verification_codes FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Function to generate a random 6-digit code
CREATE OR REPLACE FUNCTION generate_verification_code()
RETURNS text AS $$
BEGIN
  RETURN LPAD(FLOOR(RANDOM() * 1000000)::text, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to create a new verification code
CREATE OR REPLACE FUNCTION create_verification_code(
  p_user_id uuid,
  p_phone_number text
)
RETURNS text AS $$
DECLARE
  v_code text;
BEGIN
  -- Invalidate any existing unverified codes for this user/phone
  UPDATE phone_verification_codes
  SET verified = true
  WHERE user_id = p_user_id
    AND phone_number = p_phone_number
    AND verified = false;

  -- Generate new code
  v_code := generate_verification_code();

  -- Insert new verification code
  INSERT INTO phone_verification_codes (user_id, phone_number, code)
  VALUES (p_user_id, p_phone_number, v_code);

  RETURN v_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify a code
CREATE OR REPLACE FUNCTION verify_phone_code(
  p_user_id uuid,
  p_phone_number text,
  p_code text
)
RETURNS jsonb AS $$
DECLARE
  v_record record;
  v_result jsonb;
BEGIN
  -- Find the most recent unverified code for this user/phone
  SELECT * INTO v_record
  FROM phone_verification_codes
  WHERE user_id = p_user_id
    AND phone_number = p_phone_number
    AND verified = false
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  -- If no code found
  IF v_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No valid verification code found or code has expired'
    );
  END IF;

  -- Check if too many attempts
  IF v_record.attempts >= 3 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Too many attempts. Please request a new code'
    );
  END IF;

  -- Increment attempts
  UPDATE phone_verification_codes
  SET attempts = attempts + 1
  WHERE id = v_record.id;

  -- Check if code matches
  IF v_record.code = p_code THEN
    -- Mark code as verified
    UPDATE phone_verification_codes
    SET verified = true
    WHERE id = v_record.id;

    -- Update SMS preferences to mark phone as verified
    UPDATE sms_notification_preferences
    SET verified = true
    WHERE user_id = p_user_id
      AND phone_number = p_phone_number;

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Phone number verified successfully'
    );
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid verification code',
      'attempts_remaining', 3 - (v_record.attempts + 1)
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired verification codes (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_verification_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM phone_verification_codes
  WHERE expires_at < now() - interval '1 day';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
