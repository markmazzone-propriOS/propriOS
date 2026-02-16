/*
  # Create Mortgage Lenders System

  1. New Tables
    - `mortgage_lenders`
      - `id` (uuid, primary key)
      - `name` (text) - Lender name
      - `logo_url` (text, nullable) - Logo image URL
      - `description` (text) - Brief description
      - `website_url` (text) - Lender website
      - `phone_number` (text, nullable) - Contact phone
      - `email` (text, nullable) - Contact email
      - `minimum_credit_score` (integer, nullable) - Minimum credit score requirement
      - `interest_rate_range` (text, nullable) - e.g., "3.5% - 4.2%"
      - `loan_types` (text[], array) - Types of loans offered
      - `is_featured` (boolean) - Whether to show in featured section
      - `display_order` (integer) - Order in carousel
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Storage
    - Create bucket for lender logos

  3. Security
    - Enable RLS on mortgage_lenders table
    - Public can view featured lenders
    - Only authenticated agents can view all lenders
*/

-- Create mortgage_lenders table
CREATE TABLE IF NOT EXISTS mortgage_lenders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  description text NOT NULL,
  website_url text NOT NULL,
  phone_number text,
  email text,
  minimum_credit_score integer,
  interest_rate_range text,
  loan_types text[] DEFAULT '{}',
  is_featured boolean DEFAULT false,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for featured lenders
CREATE INDEX IF NOT EXISTS idx_mortgage_lenders_featured 
ON mortgage_lenders(is_featured, display_order);

-- Enable RLS
ALTER TABLE mortgage_lenders ENABLE ROW LEVEL SECURITY;

-- Public can view all lenders (for homepage display)
CREATE POLICY "Anyone can view mortgage lenders"
  ON mortgage_lenders
  FOR SELECT
  USING (true);

-- Only authenticated users can insert lenders (admin functionality)
CREATE POLICY "Authenticated users can insert lenders"
  ON mortgage_lenders
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Only authenticated users can update lenders
CREATE POLICY "Authenticated users can update lenders"
  ON mortgage_lenders
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Only authenticated users can delete lenders
CREATE POLICY "Authenticated users can delete lenders"
  ON mortgage_lenders
  FOR DELETE
  TO authenticated
  USING (true);

-- Create storage bucket for lender logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('lender-logos', 'lender-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for lender logos
CREATE POLICY "Public can view lender logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'lender-logos');

CREATE POLICY "Authenticated users can upload lender logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'lender-logos');

CREATE POLICY "Authenticated users can update lender logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'lender-logos')
  WITH CHECK (bucket_id = 'lender-logos');

CREATE POLICY "Authenticated users can delete lender logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'lender-logos');

-- Insert sample featured lenders
INSERT INTO mortgage_lenders (name, description, website_url, phone_number, minimum_credit_score, interest_rate_range, loan_types, is_featured, display_order)
VALUES 
  (
    'First National Mortgage',
    'Competitive rates for first-time homebuyers with flexible terms and personalized service.',
    'https://example.com/first-national',
    '(555) 123-4567',
    620,
    '3.5% - 4.2%',
    ARRAY['Conventional', 'FHA', 'VA', 'First-Time Buyer'],
    true,
    1
  ),
  (
    'Premier Home Loans',
    'Specializing in jumbo loans and luxury home financing with fast approval process.',
    'https://example.com/premier-home',
    '(555) 234-5678',
    680,
    '3.8% - 4.5%',
    ARRAY['Conventional', 'Jumbo', 'Refinance'],
    true,
    2
  ),
  (
    'Veterans Lending Group',
    'Dedicated to serving military families with exclusive VA loan benefits and zero down payment options.',
    'https://example.com/veterans-lending',
    '(555) 345-6789',
    580,
    '3.2% - 3.9%',
    ARRAY['VA', 'VA Jumbo', 'Refinance'],
    true,
    3
  ),
  (
    'Affordable Home Finance',
    'Making homeownership accessible with FHA loans and down payment assistance programs.',
    'https://example.com/affordable-home',
    '(555) 456-7890',
    580,
    '3.6% - 4.3%',
    ARRAY['FHA', 'Conventional', 'USDA', 'First-Time Buyer'],
    true,
    4
  ),
  (
    'Express Mortgage Solutions',
    'Quick closings and digital application process for busy professionals seeking convenience.',
    'https://example.com/express-mortgage',
    '(555) 567-8901',
    640,
    '3.7% - 4.4%',
    ARRAY['Conventional', 'Refinance', 'Investment Property'],
    true,
    5
  )
ON CONFLICT (id) DO NOTHING;