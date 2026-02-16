/*
  # Add Buyer Respond to Counter Offer Policy

  1. Changes
    - Add policy allowing buyers to update their offers when responding to counteroffers
    - Buyers can update offer_amount, message, and change status from 'countered' back to 'pending'
    - This enables the negotiation flow where buyers can accept or counter the seller's counteroffer

  2. Security
    - Only buyers can update their own offers
    - Only allowed when current status is 'countered'
    - Can only change status to 'pending' (submitting a new/updated offer)
*/

-- Allow buyers to respond to counteroffers
CREATE POLICY "Buyers can respond to counteroffers"
  ON property_offers FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = buyer_id
    AND offer_status = 'countered'
  )
  WITH CHECK (
    auth.uid() = buyer_id
    AND offer_status = 'pending'
  );
