/*
  # Create Brokerage Management System
  
  1. New Tables
    - `brokerages`
      - `id` (uuid, primary key)
      - `super_admin_id` (uuid, references profiles)
      - `company_name` (text)
      - `license_number` (text)
      - `phone_number` (text)
      - `email` (text)
      - `address_line1` (text)
      - `address_line2` (text)
      - `city` (text)
      - `state` (text)
      - `zip_code` (text)
      - `logo_url` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `brokerage_agents`
      - `id` (uuid, primary key)
      - `brokerage_id` (uuid, references brokerages)
      - `agent_id` (uuid, references profiles)
      - `joined_at` (timestamptz)
      - `status` (text: active, inactive)
    
    - `brokerage_invitations`
      - `id` (uuid, primary key)
      - `brokerage_id` (uuid, references brokerages)
      - `inviter_id` (uuid, references profiles)
      - `invitee_email` (text)
      - `invitee_name` (text)
      - `status` (text: pending, accepted, declined, cancelled)
      - `created_at` (timestamptz)
      - `accepted_at` (timestamptz)
  
  2. Changes
    - Add 'brokerage' to user_type constraint
  
  3. Security
    - Enable RLS on all tables
    - Super admins can manage their brokerage
    - Agents can view their brokerage info
    - Super admins can view all agents in their brokerage
*/

-- Add brokerage to user_type constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_user_type_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_user_type_check 
  CHECK (user_type IN ('buyer', 'seller', 'agent', 'renter', 'service_provider', 'property_owner', 'admin', 'managed_user', 'mortgage_lender', 'brokerage'));

-- Create brokerages table
CREATE TABLE IF NOT EXISTS brokerages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  company_name text NOT NULL,
  license_number text,
  phone_number text,
  email text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  zip_code text,
  logo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(super_admin_id)
);

-- Create brokerage_agents table
CREATE TABLE IF NOT EXISTS brokerage_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brokerage_id uuid REFERENCES brokerages(id) ON DELETE CASCADE NOT NULL,
  agent_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at timestamptz DEFAULT now(),
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  UNIQUE(brokerage_id, agent_id)
);

-- Create brokerage_invitations table
CREATE TABLE IF NOT EXISTS brokerage_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brokerage_id uuid REFERENCES brokerages(id) ON DELETE CASCADE NOT NULL,
  inviter_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  invitee_email text NOT NULL,
  invitee_name text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  accepted_at timestamptz
);

-- Enable RLS
ALTER TABLE brokerages ENABLE ROW LEVEL SECURITY;
ALTER TABLE brokerage_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE brokerage_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for brokerages
CREATE POLICY "Super admins can view own brokerage"
  ON brokerages FOR SELECT
  TO authenticated
  USING (super_admin_id = auth.uid());

CREATE POLICY "Super admins can insert own brokerage"
  ON brokerages FOR INSERT
  TO authenticated
  WITH CHECK (
    super_admin_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'brokerage'
    )
  );

CREATE POLICY "Super admins can update own brokerage"
  ON brokerages FOR UPDATE
  TO authenticated
  USING (super_admin_id = auth.uid())
  WITH CHECK (super_admin_id = auth.uid());

CREATE POLICY "Agents can view their brokerage"
  ON brokerages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM brokerage_agents
      WHERE brokerage_agents.brokerage_id = brokerages.id
      AND brokerage_agents.agent_id = auth.uid()
      AND brokerage_agents.status = 'active'
    )
  );

-- RLS Policies for brokerage_agents
CREATE POLICY "Super admins can view their brokerage agents"
  ON brokerage_agents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM brokerages
      WHERE brokerages.id = brokerage_agents.brokerage_id
      AND brokerages.super_admin_id = auth.uid()
    )
  );

CREATE POLICY "Agents can view own brokerage membership"
  ON brokerage_agents FOR SELECT
  TO authenticated
  USING (agent_id = auth.uid());

CREATE POLICY "Agents can view other agents in same brokerage"
  ON brokerage_agents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM brokerage_agents ba2
      WHERE ba2.brokerage_id = brokerage_agents.brokerage_id
      AND ba2.agent_id = auth.uid()
      AND ba2.status = 'active'
    )
  );

CREATE POLICY "Super admins can insert agents to their brokerage"
  ON brokerage_agents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM brokerages
      WHERE brokerages.id = brokerage_agents.brokerage_id
      AND brokerages.super_admin_id = auth.uid()
    )
  );

CREATE POLICY "Super admins can update their brokerage agents"
  ON brokerage_agents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM brokerages
      WHERE brokerages.id = brokerage_agents.brokerage_id
      AND brokerages.super_admin_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM brokerages
      WHERE brokerages.id = brokerage_agents.brokerage_id
      AND brokerages.super_admin_id = auth.uid()
    )
  );

CREATE POLICY "Super admins can delete agents from their brokerage"
  ON brokerage_agents FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM brokerages
      WHERE brokerages.id = brokerage_agents.brokerage_id
      AND brokerages.super_admin_id = auth.uid()
    )
  );

-- RLS Policies for brokerage_invitations
CREATE POLICY "Super admins can view their brokerage invitations"
  ON brokerage_invitations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM brokerages
      WHERE brokerages.id = brokerage_invitations.brokerage_id
      AND brokerages.super_admin_id = auth.uid()
    )
  );

CREATE POLICY "Invitees can view their invitations"
  ON brokerage_invitations FOR SELECT
  TO authenticated
  USING (
    invitee_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Super admins can insert invitations"
  ON brokerage_invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM brokerages
      WHERE brokerages.id = brokerage_invitations.brokerage_id
      AND brokerages.super_admin_id = auth.uid()
    )
  );

CREATE POLICY "Super admins can update their invitations"
  ON brokerage_invitations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM brokerages
      WHERE brokerages.id = brokerage_invitations.brokerage_id
      AND brokerages.super_admin_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM brokerages
      WHERE brokerages.id = brokerage_invitations.brokerage_id
      AND brokerages.super_admin_id = auth.uid()
    )
  );

CREATE POLICY "Invitees can update their own invitations"
  ON brokerage_invitations FOR UPDATE
  TO authenticated
  USING (
    invitee_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
  WITH CHECK (
    invitee_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_brokerages_super_admin ON brokerages(super_admin_id);
CREATE INDEX IF NOT EXISTS idx_brokerage_agents_brokerage ON brokerage_agents(brokerage_id);
CREATE INDEX IF NOT EXISTS idx_brokerage_agents_agent ON brokerage_agents(agent_id);
CREATE INDEX IF NOT EXISTS idx_brokerage_invitations_brokerage ON brokerage_invitations(brokerage_id);
CREATE INDEX IF NOT EXISTS idx_brokerage_invitations_email ON brokerage_invitations(invitee_email);

-- Add brokerage_id to agent_profiles for easier querying
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_profiles' AND column_name = 'brokerage_id'
  ) THEN
    ALTER TABLE agent_profiles ADD COLUMN brokerage_id uuid REFERENCES brokerages(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_agent_profiles_brokerage ON agent_profiles(brokerage_id);
  END IF;
END $$;

-- Create storage bucket for brokerage logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('brokerage-logos', 'brokerage-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for brokerage logos
CREATE POLICY "Super admins can upload brokerage logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'brokerage-logos' AND
    EXISTS (
      SELECT 1 FROM brokerages
      WHERE brokerages.super_admin_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view brokerage logos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'brokerage-logos');

CREATE POLICY "Super admins can update their brokerage logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'brokerage-logos' AND
    EXISTS (
      SELECT 1 FROM brokerages
      WHERE brokerages.super_admin_id = auth.uid()
    )
  );

CREATE POLICY "Super admins can delete their brokerage logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'brokerage-logos' AND
    EXISTS (
      SELECT 1 FROM brokerages
      WHERE brokerages.super_admin_id = auth.uid()
    )
  );
