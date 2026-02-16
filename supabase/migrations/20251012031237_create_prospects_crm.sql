/*
  # Create Prospects CRM System

  1. New Tables
    - `prospects`
      - `id` (uuid, primary key)
      - `agent_id` (uuid, references profiles) - The agent receiving the inquiry
      - `full_name` (text) - Prospect's full name
      - `email` (text) - Prospect's email address
      - `phone_number` (text) - Prospect's phone number
      - `message` (text) - Inquiry message
      - `status` (text) - Lead status: new, contacted, qualified, converted, closed
      - `source` (text) - Where the lead came from: homepage, property_inquiry, referral
      - `property_id` (uuid, nullable, references properties) - If inquiry is about a specific property
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `contacted_at` (timestamptz, nullable) - When agent first contacted the prospect

  2. Security
    - Enable RLS on `prospects` table
    - Add policy for agents to view their own prospects
    - Add policy for agents to update their own prospects
    - Add policy for anyone to insert prospects (public contact form)
*/

CREATE TABLE IF NOT EXISTS prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  phone_number text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  source text NOT NULL DEFAULT 'homepage',
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  contacted_at timestamptz,
  CONSTRAINT valid_status CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'closed'))
);

ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view their own prospects"
  ON prospects
  FOR SELECT
  TO authenticated
  USING (
    agent_id = auth.uid()
  );

CREATE POLICY "Agents can update their own prospects"
  ON prospects
  FOR UPDATE
  TO authenticated
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Anyone can create prospects"
  ON prospects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_prospects_agent_id ON prospects(agent_id);
CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status);
CREATE INDEX IF NOT EXISTS idx_prospects_created_at ON prospects(created_at DESC);
