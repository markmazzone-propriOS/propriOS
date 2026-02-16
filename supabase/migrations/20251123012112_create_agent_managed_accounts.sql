/*
  # Create Agent-Managed User Accounts System

  1. New Tables
    - `agent_managed_accounts`
      - `id` (uuid, primary key)
      - `agent_id` (uuid, references agent_profiles) - The agent who manages this account
      - `managed_user_id` (uuid, references profiles) - The managed user account
      - `account_name` (text) - Descriptive name for this managed account
      - `can_create_listings` (boolean) - Permission to create listings
      - `can_edit_listings` (boolean) - Permission to edit listings
      - `can_delete_listings` (boolean) - Permission to delete listings
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes
    - Add `managed_by_agent_id` column to `profiles` table to track managed accounts
    - Update properties RLS policies to allow managed users to create/edit listings on behalf of agent
    - Update property_photos RLS policies to allow managed users to upload photos

  3. Security
    - Enable RLS on `agent_managed_accounts` table
    - Add policies for agents to manage their managed accounts
    - Add policies for managed users to view their permissions
    - Update existing property policies to include managed account permissions
*/

-- Add managed_by_agent_id column to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'managed_by_agent_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN managed_by_agent_id uuid REFERENCES agent_profiles ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_managed_by_agent ON profiles(managed_by_agent_id);

-- Create agent_managed_accounts table
CREATE TABLE IF NOT EXISTS agent_managed_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agent_profiles ON DELETE CASCADE,
  managed_user_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  account_name text NOT NULL,
  can_create_listings boolean DEFAULT true,
  can_edit_listings boolean DEFAULT true,
  can_delete_listings boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(agent_id, managed_user_id)
);

ALTER TABLE agent_managed_accounts ENABLE ROW LEVEL SECURITY;

-- Agents can view their own managed accounts
CREATE POLICY "Agents can view own managed accounts"
  ON agent_managed_accounts FOR SELECT
  TO authenticated
  USING (auth.uid() = agent_id);

-- Agents can create managed accounts
CREATE POLICY "Agents can create managed accounts"
  ON agent_managed_accounts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = agent_id);

-- Agents can update their managed accounts
CREATE POLICY "Agents can update own managed accounts"
  ON agent_managed_accounts FOR UPDATE
  TO authenticated
  USING (auth.uid() = agent_id)
  WITH CHECK (auth.uid() = agent_id);

-- Agents can delete their managed accounts
CREATE POLICY "Agents can delete own managed accounts"
  ON agent_managed_accounts FOR DELETE
  TO authenticated
  USING (auth.uid() = agent_id);

-- Managed users can view their own managed account info
CREATE POLICY "Managed users can view own account info"
  ON agent_managed_accounts FOR SELECT
  TO authenticated
  USING (auth.uid() = managed_user_id);

-- Add policy for managed accounts to create properties for their agent
CREATE POLICY "Managed accounts can create properties for agent"
  ON properties FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agent_managed_accounts ama
      WHERE ama.managed_user_id = auth.uid()
      AND ama.agent_id = agent_id
      AND ama.can_create_listings = true
    )
  );

-- Add policy for managed accounts to update properties for their agent
CREATE POLICY "Managed accounts can update agent properties"
  ON properties FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agent_managed_accounts ama
      WHERE ama.managed_user_id = auth.uid()
      AND ama.agent_id = agent_id
      AND ama.can_edit_listings = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agent_managed_accounts ama
      WHERE ama.managed_user_id = auth.uid()
      AND ama.agent_id = agent_id
      AND ama.can_edit_listings = true
    )
  );

-- Add policy for managed accounts to delete properties for their agent
CREATE POLICY "Managed accounts can delete agent properties"
  ON properties FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agent_managed_accounts ama
      WHERE ama.managed_user_id = auth.uid()
      AND ama.agent_id = agent_id
      AND ama.can_delete_listings = true
    )
  );

-- Add policy for managed accounts to manage property photos
CREATE POLICY "Managed accounts can manage property photos"
  ON property_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties p
      JOIN agent_managed_accounts ama ON ama.agent_id = p.agent_id
      WHERE p.id = property_id
      AND ama.managed_user_id = auth.uid()
      AND ama.can_edit_listings = true
    )
  );

CREATE POLICY "Managed accounts can update property photos"
  ON property_photos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      JOIN agent_managed_accounts ama ON ama.agent_id = p.agent_id
      WHERE p.id = property_id
      AND ama.managed_user_id = auth.uid()
      AND ama.can_edit_listings = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties p
      JOIN agent_managed_accounts ama ON ama.agent_id = p.agent_id
      WHERE p.id = property_id
      AND ama.managed_user_id = auth.uid()
      AND ama.can_edit_listings = true
    )
  );

CREATE POLICY "Managed accounts can delete property photos"
  ON property_photos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      JOIN agent_managed_accounts ama ON ama.agent_id = p.agent_id
      WHERE p.id = property_id
      AND ama.managed_user_id = auth.uid()
      AND ama.can_edit_listings = true
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_managed_accounts_agent_id ON agent_managed_accounts(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_managed_accounts_managed_user_id ON agent_managed_accounts(managed_user_id);
