/*
  # Add Sample Mortgage Lenders

  1. Creates sample auth users for mortgage lenders
  2. Creates sample profiles for mortgage lenders
  3. Inserts sample mortgage lender profiles with realistic data
  4. Provides variety in ratings, experience, and loan types

  Note: Sample data for demonstration purposes
*/

-- Create sample UUIDs for mortgage lenders
DO $$
DECLARE
  lender1_id uuid := gen_random_uuid();
  lender2_id uuid := gen_random_uuid();
  lender3_id uuid := gen_random_uuid();
BEGIN
  -- Insert into auth.users
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role
  )
  VALUES
    (
      lender1_id,
      '00000000-0000-0000-0000-000000000000',
      'sarah.johnson@firsthomemortgage.com',
      crypt('password123', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      'authenticated',
      'authenticated'
    ),
    (
      lender2_id,
      '00000000-0000-0000-0000-000000000000',
      'michael.chen@primerate.com',
      crypt('password123', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      'authenticated',
      'authenticated'
    ),
    (
      lender3_id,
      '00000000-0000-0000-0000-000000000000',
      'jennifer.williams@trustedlending.com',
      crypt('password123', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      'authenticated',
      'authenticated'
    )
  ON CONFLICT (id) DO NOTHING;

  -- Insert sample profiles
  INSERT INTO profiles (id, user_type, full_name, phone_number, created_at)
  VALUES
    (lender1_id, 'mortgage_lender', 'Sarah Johnson', '555-0101', now()),
    (lender2_id, 'mortgage_lender', 'Michael Chen', '555-0102', now()),
    (lender3_id, 'mortgage_lender', 'Jennifer Williams', '555-0103', now())
  ON CONFLICT (id) DO NOTHING;

  -- Insert mortgage lender profiles
  INSERT INTO mortgage_lender_profiles (
    id,
    company_name,
    nmls_number,
    bio,
    email,
    phone_number,
    years_experience,
    average_rating,
    total_loans_closed,
    loan_types,
    minimum_credit_score,
    interest_rate_range,
    is_featured
  )
  VALUES
    (
      lender1_id,
      'First Home Mortgage',
      '123456',
      'Specializing in first-time homebuyers and FHA loans. We make the mortgage process simple and stress-free with personalized guidance every step of the way.',
      'sarah.johnson@firsthomemortgage.com',
      '555-0101',
      12,
      4.9,
      450,
      ARRAY['FHA Loans', 'First-Time Buyers', 'Down Payment Assistance'],
      580,
      '3.5% - 4.2%',
      true
    ),
    (
      lender2_id,
      'PrimeRate Lending',
      '234567',
      'Expert in conventional and jumbo loans with competitive rates. Over 15 years of experience helping clients secure the best financing options for their dream homes.',
      'michael.chen@primerate.com',
      '555-0102',
      15,
      4.8,
      720,
      ARRAY['Conventional Loans', 'Jumbo Loans', 'Investment Properties'],
      620,
      '3.2% - 4.5%',
      true
    ),
    (
      lender3_id,
      'Trusted Home Loans',
      '345678',
      'Dedicated to providing excellent service for VA loans and refinancing. We work with military families and homeowners to find the perfect loan solution.',
      'jennifer.williams@trustedlending.com',
      '555-0103',
      10,
      4.7,
      380,
      ARRAY['VA Loans', 'Refinancing', 'Military Benefits'],
      600,
      '3.3% - 4.0%',
      true
    )
  ON CONFLICT (id) DO NOTHING;
END $$;