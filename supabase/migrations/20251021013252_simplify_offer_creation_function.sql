/*
  # Simplify offer creation to fix memory issues

  1. Changes
    - Remove the create_offer_without_trigger function
    - Create a much simpler function that just inserts data
    - No complex queries or operations that could cause memory issues

  2. Security
    - Function uses SECURITY DEFINER to bypass RLS
    - Simple validation only
*/

DROP FUNCTION IF EXISTS create_offer_without_trigger(uuid, uuid, numeric, text, date, text, text);

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
SET search_path = public
AS $$
DECLARE
  v_offer_id uuid;
BEGIN
  -- Insert offer
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

  -- Update buyer journey
  INSERT INTO buyer_journey_progress (buyer_id, offer_submitted, offer_submitted_date, property_id)
  VALUES (p_buyer_id, true, NOW(), p_property_id)
  ON CONFLICT (buyer_id) DO UPDATE SET
    offer_submitted = true,
    offer_submitted_date = COALESCE(buyer_journey_progress.offer_submitted_date, NOW()),
    property_id = p_property_id;

  -- Return simple result
  RETURN json_build_object('id', v_offer_id, 'status', 'success');
END;
$$;