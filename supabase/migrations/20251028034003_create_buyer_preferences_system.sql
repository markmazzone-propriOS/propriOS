/*
  # Create Buyer Preferences System

  1. New Tables
    - `buyer_preferences`
      - `id` (uuid, primary key)
      - `buyer_id` (uuid, references profiles) - The buyer who owns these preferences
      - `min_price` (numeric, nullable) - Minimum price range
      - `max_price` (numeric, nullable) - Maximum price range
      - `min_bedrooms` (integer, nullable) - Minimum number of bedrooms
      - `max_bedrooms` (integer, nullable) - Maximum number of bedrooms
      - `min_bathrooms` (numeric, nullable) - Minimum number of bathrooms
      - `max_bathrooms` (numeric, nullable) - Maximum number of bathrooms
      - `min_sqft` (integer, nullable) - Minimum square footage
      - `max_sqft` (integer, nullable) - Maximum square footage
      - `max_days_on_site` (integer, nullable) - Maximum days property has been listed
      - `property_types` (text[], nullable) - Preferred property types
      - `locations` (text[], nullable) - Preferred locations/cities
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `buyer_preferences` table
    - Buyers can view and update their own preferences
    - Agents can view their clients' preferences
*/

CREATE TABLE IF NOT EXISTS buyer_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  min_price numeric,
  max_price numeric,
  min_bedrooms integer,
  max_bedrooms integer,
  min_bathrooms numeric,
  max_bathrooms numeric,
  min_sqft integer,
  max_sqft integer,
  max_days_on_site integer,
  property_types text[],
  locations text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_buyer_preferences UNIQUE(buyer_id)
);

ALTER TABLE buyer_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers can view own preferences"
  ON buyer_preferences
  FOR SELECT
  TO authenticated
  USING (buyer_id = auth.uid());

CREATE POLICY "Buyers can insert own preferences"
  ON buyer_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "Buyers can update own preferences"
  ON buyer_preferences
  FOR UPDATE
  TO authenticated
  USING (buyer_id = auth.uid())
  WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "Agents can view assigned clients preferences"
  ON buyer_preferences
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = buyer_preferences.buyer_id
      AND profiles.assigned_agent_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_buyer_preferences_buyer_id ON buyer_preferences(buyer_id);
