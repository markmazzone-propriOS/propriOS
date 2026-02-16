/*
  # Allow buyers to cancel pending offers

  1. Changes
    - Add policy allowing buyers to update their own offers from 'pending' to 'withdrawn'
    - Buyers can only cancel offers that are still in pending status

  2. Security
    - Buyers can only cancel their own offers
    - Only pending offers can be cancelled
*/

-- Allow buyers to cancel their own pending offers
CREATE POLICY "Buyers can cancel own pending offers"
  ON property_offers FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = buyer_id 
    AND offer_status = 'pending'
  )
  WITH CHECK (
    auth.uid() = buyer_id 
    AND offer_status = 'withdrawn'
  );