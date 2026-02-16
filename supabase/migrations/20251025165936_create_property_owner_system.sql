/*
  # Create Property Owner System

  1. New Tables
    - `property_owner_profiles`
      - `id` (uuid, primary key, references profiles)
      - `business_name` (text, optional)
      - `properties_owned` (integer, default 0)
      - `total_rental_income` (numeric, default 0)
      - `bio` (text, optional)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `rental_agreements`
      - `id` (uuid, primary key)
      - `property_id` (uuid, references properties)
      - `property_owner_id` (uuid, references property_owner_profiles)
      - `renter_id` (uuid, references profiles)
      - `monthly_rent` (numeric)
      - `security_deposit` (numeric)
      - `lease_start_date` (date)
      - `lease_end_date` (date)
      - `status` (enum: 'active', 'pending', 'expired', 'terminated')
      - `payment_due_day` (integer, 1-31)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `rent_payments`
      - `id` (uuid, primary key)
      - `rental_agreement_id` (uuid, references rental_agreements)
      - `amount` (numeric)
      - `due_date` (date)
      - `paid_date` (date, nullable)
      - `status` (enum: 'pending', 'paid', 'late', 'partial')
      - `payment_method` (text, nullable)
      - `notes` (text, nullable)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Property owners can view and manage their own profile
    - Property owners can view rental agreements for their properties
    - Property owners and renters can view rent payment information
    - Renters can view their own rental agreements
*/

-- Create property owner profiles table
CREATE TABLE IF NOT EXISTS property_owner_profiles (
  id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  business_name text,
  properties_owned integer DEFAULT 0,
  total_rental_income numeric DEFAULT 0,
  bio text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create rental agreements table
CREATE TABLE IF NOT EXISTS rental_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
  property_owner_id uuid REFERENCES property_owner_profiles(id) ON DELETE CASCADE,
  renter_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  monthly_rent numeric NOT NULL,
  security_deposit numeric DEFAULT 0,
  lease_start_date date NOT NULL,
  lease_end_date date NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'expired', 'terminated')),
  payment_due_day integer DEFAULT 1 CHECK (payment_due_day >= 1 AND payment_due_day <= 31),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create rent payments table
CREATE TABLE IF NOT EXISTS rent_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_agreement_id uuid REFERENCES rental_agreements(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  due_date date NOT NULL,
  paid_date date,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'late', 'partial')),
  payment_method text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE property_owner_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE rent_payments ENABLE ROW LEVEL SECURITY;

-- Property Owner Profiles Policies
CREATE POLICY "Property owners can view own profile"
  ON property_owner_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Property owners can update own profile"
  ON property_owner_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Property owners can insert own profile"
  ON property_owner_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Anyone can view property owner profiles"
  ON property_owner_profiles FOR SELECT
  TO authenticated
  USING (true);

-- Rental Agreements Policies
CREATE POLICY "Property owners can view their rental agreements"
  ON rental_agreements FOR SELECT
  TO authenticated
  USING (auth.uid() = property_owner_id);

CREATE POLICY "Renters can view their rental agreements"
  ON rental_agreements FOR SELECT
  TO authenticated
  USING (auth.uid() = renter_id);

CREATE POLICY "Property owners can create rental agreements"
  ON rental_agreements FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = property_owner_id);

CREATE POLICY "Property owners can update their rental agreements"
  ON rental_agreements FOR UPDATE
  TO authenticated
  USING (auth.uid() = property_owner_id)
  WITH CHECK (auth.uid() = property_owner_id);

-- Rent Payments Policies
CREATE POLICY "Property owners can view rent payments for their properties"
  ON rent_payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rental_agreements
      WHERE rental_agreements.id = rent_payments.rental_agreement_id
      AND rental_agreements.property_owner_id = auth.uid()
    )
  );

CREATE POLICY "Renters can view their rent payments"
  ON rent_payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rental_agreements
      WHERE rental_agreements.id = rent_payments.rental_agreement_id
      AND rental_agreements.renter_id = auth.uid()
    )
  );

CREATE POLICY "Property owners can create rent payments"
  ON rent_payments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rental_agreements
      WHERE rental_agreements.id = rent_payments.rental_agreement_id
      AND rental_agreements.property_owner_id = auth.uid()
    )
  );

CREATE POLICY "Property owners can update rent payments"
  ON rent_payments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rental_agreements
      WHERE rental_agreements.id = rent_payments.rental_agreement_id
      AND rental_agreements.property_owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rental_agreements
      WHERE rental_agreements.id = rent_payments.rental_agreement_id
      AND rental_agreements.property_owner_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rental_agreements_owner ON rental_agreements(property_owner_id);
CREATE INDEX IF NOT EXISTS idx_rental_agreements_renter ON rental_agreements(renter_id);
CREATE INDEX IF NOT EXISTS idx_rental_agreements_property ON rental_agreements(property_id);
CREATE INDEX IF NOT EXISTS idx_rent_payments_agreement ON rent_payments(rental_agreement_id);
CREATE INDEX IF NOT EXISTS idx_rent_payments_due_date ON rent_payments(due_date);
