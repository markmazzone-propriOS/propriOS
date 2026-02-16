/*
  # Add Mortgage Lender User Type

  1. Changes
    - Update profiles table user_type constraint to include 'mortgage_lender'
    - Create mortgage_lender_profiles table for lender-specific information
    - Enable RLS on mortgage_lender_profiles

  2. New Table
    - `mortgage_lender_profiles`
      - `id` (uuid, references profiles, primary key)
      - `company_name` (text) - Lending company name
      - `nmls_number` (text) - NMLS license number
      - `logo_url` (text, nullable) - Company logo
      - `bio` (text) - Professional bio
      - `website_url` (text, nullable) - Company website
      - `phone_number` (text, nullable) - Business phone
      - `email` (text, nullable) - Business email
      - `minimum_credit_score` (integer, nullable)
      - `interest_rate_range` (text, nullable)
      - `loan_types` (text[], array) - Types of loans offered
      - `years_experience` (integer, nullable)
      - `total_loans_closed` (integer) - Number of loans closed
      - `average_rating` (decimal) - Average rating
      - `is_featured` (boolean) - Featured on homepage
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  3. Security
    - Enable RLS on mortgage_lender_profiles
    - Lenders can view and update their own profiles
    - Public can view all lender profiles
*/

-- Drop the existing constraint and add the new one
DO $$ 
BEGIN
  -- Drop existing check constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'profiles' 
    AND constraint_name = 'profiles_user_type_check'
  ) THEN
    ALTER TABLE profiles DROP CONSTRAINT profiles_user_type_check;
  END IF;

  -- Add new check constraint with mortgage_lender
  ALTER TABLE profiles ADD CONSTRAINT profiles_user_type_check 
    CHECK (user_type IN ('buyer', 'seller', 'renter', 'agent', 'service_provider', 'mortgage_lender'));
END $$;

-- Create mortgage_lender_profiles table
CREATE TABLE IF NOT EXISTS mortgage_lender_profiles (
  id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  nmls_number text NOT NULL,
  logo_url text,
  bio text NOT NULL DEFAULT '',
  website_url text,
  phone_number text,
  email text,
  minimum_credit_score integer,
  interest_rate_range text,
  loan_types text[] DEFAULT '{}',
  years_experience integer,
  total_loans_closed integer DEFAULT 0,
  average_rating decimal(3,2) DEFAULT 0.0,
  is_featured boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_mortgage_lender_profiles_featured 
  ON mortgage_lender_profiles(is_featured, average_rating DESC);
CREATE INDEX IF NOT EXISTS idx_mortgage_lender_profiles_rating 
  ON mortgage_lender_profiles(average_rating DESC);

-- Enable RLS
ALTER TABLE mortgage_lender_profiles ENABLE ROW LEVEL SECURITY;

-- Public can view all mortgage lender profiles
CREATE POLICY "Anyone can view mortgage lender profiles"
  ON mortgage_lender_profiles
  FOR SELECT
  USING (true);

-- Mortgage lenders can insert their own profile
CREATE POLICY "Mortgage lenders can create own profile"
  ON mortgage_lender_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'mortgage_lender'
    )
  );

-- Mortgage lenders can update their own profile
CREATE POLICY "Mortgage lenders can update own profile"
  ON mortgage_lender_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Mortgage lenders can delete their own profile
CREATE POLICY "Mortgage lenders can delete own profile"
  ON mortgage_lender_profiles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

-- Update invitations table to support mortgage_lender user type
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'invitations' 
    AND constraint_name = 'invitations_user_type_check'
  ) THEN
    ALTER TABLE invitations DROP CONSTRAINT invitations_user_type_check;
  END IF;

  ALTER TABLE invitations ADD CONSTRAINT invitations_user_type_check 
    CHECK (user_type IN ('buyer', 'seller', 'renter', 'agent', 'service_provider', 'mortgage_lender'));
END $$;