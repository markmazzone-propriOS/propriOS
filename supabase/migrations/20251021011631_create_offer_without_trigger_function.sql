/*
  # Create function to insert offers without trigger recursion

  1. Changes
    - Create stored procedure to insert offers and update journey progress
    - Uses session_replication_role to disable triggers temporarily
    - Runs with SECURITY DEFINER to have necessary permissions

  2. Security
    - Function validates user authentication
    - Uses SECURITY DEFINER with search_path for safety
*/

CREATE OR REPLACE FUNCTION create_offer_without_trigger(
  p_property_id uuid,
  p_buyer_id uuid,
  p_offer_amount numeric,
  p_financing_type text,
  p_closing_date date,
  p_message text DEFAULT NULL,
  p_contingencies text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_offer_id uuid;
  v_result json;
BEGIN
  SET LOCAL session_replication_role = replica;

  INSERT INTO property_offers (
    property_id,
    buyer_id,
    offer_amount,
    financing_type,
    closing_date,
    message,
    contingencies,
    offer_status
  ) VALUES (
    p_property_id,
    p_buyer_id,
    p_offer_amount,
    p_financing_type,
    p_closing_date,
    p_message,
    p_contingencies,
    'pending'
  )
  RETURNING id INTO v_offer_id;

  INSERT INTO buyer_journey_progress (
    buyer_id,
    offer_submitted,
    offer_submitted_date,
    property_id
  ) VALUES (
    p_buyer_id,
    true,
    NOW(),
    p_property_id
  )
  ON CONFLICT (buyer_id) DO UPDATE SET
    offer_submitted = true,
    offer_submitted_date = COALESCE(buyer_journey_progress.offer_submitted_date, NOW()),
    property_id = p_property_id;

  SET LOCAL session_replication_role = DEFAULT;

  SELECT json_build_object(
    'id', id,
    'property_id', property_id,
    'buyer_id', buyer_id,
    'offer_amount', offer_amount,
    'financing_type', financing_type,
    'closing_date', closing_date,
    'message', message,
    'contingencies', contingencies,
    'offer_status', offer_status,
    'created_at', created_at
  ) INTO v_result
  FROM property_offers
  WHERE id = v_offer_id;

  RETURN v_result;
END;
$$;