/*
  # Create Offers System

  1. New Tables
    - `property_offers`
      - `id` (uuid, primary key)
      - `property_id` (uuid, references properties)
      - `buyer_id` (uuid, references profiles)
      - `offer_amount` (numeric)
      - `offer_status` (text) - pending, accepted, rejected, withdrawn, countered
      - `message` (text) - optional message from buyer
      - `contingencies` (text) - optional contingencies or conditions
      - `financing_type` (text) - cash, conventional, fha, va, etc.
      - `closing_date` (date) - proposed closing date
      - `counter_amount` (numeric) - optional counter offer amount
      - `counter_message` (text) - optional counter offer message
      - `responded_at` (timestamptz) - when seller/agent responded
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `property_offers` table
    - Buyers can create offers and view their own offers
    - Property listers (sellers) can view offers on their properties
    - Agents can view offers on properties they list
    - Only listers and agents can update offer status (accept, reject, counter)
*/

CREATE TABLE IF NOT EXISTS property_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  buyer_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  offer_amount numeric NOT NULL CHECK (offer_amount > 0),
  offer_status text NOT NULL DEFAULT 'pending' CHECK (offer_status IN ('pending', 'accepted', 'rejected', 'withdrawn', 'countered')),
  message text DEFAULT '',
  contingencies text DEFAULT '',
  financing_type text NOT NULL DEFAULT 'conventional' CHECK (financing_type IN ('cash', 'conventional', 'fha', 'va', 'usda', 'other')),
  closing_date date,
  counter_amount numeric CHECK (counter_amount > 0),
  counter_message text DEFAULT '',
  responded_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE property_offers ENABLE ROW LEVEL SECURITY;

-- Buyers can insert their own offers
CREATE POLICY "Buyers can create offers"
  ON property_offers FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = buyer_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'buyer'
    )
  );

-- Buyers can view their own offers
CREATE POLICY "Buyers can view own offers"
  ON property_offers FOR SELECT
  TO authenticated
  USING (auth.uid() = buyer_id);

-- Property listers can view offers on their properties
CREATE POLICY "Property listers can view offers on their properties"
  ON property_offers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_offers.property_id
      AND properties.listed_by = auth.uid()
    )
  );

-- Agents can view offers on properties they list
CREATE POLICY "Agents can view offers on properties they list"
  ON property_offers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_offers.property_id
      AND properties.agent_id = auth.uid()
    )
  );

-- Property listers can update offer status
CREATE POLICY "Property listers can update offer status"
  ON property_offers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_offers.property_id
      AND properties.listed_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_offers.property_id
      AND properties.listed_by = auth.uid()
    )
  );

-- Agents can update offer status
CREATE POLICY "Agents can update offer status on their listings"
  ON property_offers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_offers.property_id
      AND properties.agent_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_offers.property_id
      AND properties.agent_id = auth.uid()
    )
  );

-- Buyers can withdraw their own offers
CREATE POLICY "Buyers can update own offers to withdrawn"
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

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_property_offers_property_id ON property_offers(property_id);
CREATE INDEX IF NOT EXISTS idx_property_offers_buyer_id ON property_offers(buyer_id);
CREATE INDEX IF NOT EXISTS idx_property_offers_status ON property_offers(offer_status);

-- Update updated_at timestamp on row update
CREATE OR REPLACE FUNCTION update_property_offers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_property_offers_updated_at ON property_offers;
CREATE TRIGGER update_property_offers_updated_at
  BEFORE UPDATE ON property_offers
  FOR EACH ROW
  EXECUTE FUNCTION update_property_offers_updated_at();
