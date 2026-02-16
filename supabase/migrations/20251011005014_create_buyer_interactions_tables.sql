/*
  # Create Buyer Interactions Tables

  ## Overview
  This migration creates tables to track buyer interactions with properties including favorites, views, and rejections.
  It also adds an assigned_agent field to buyer profiles.

  ## New Tables

  ### 1. `property_favorites`
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid, foreign key) - References profiles table
  - `property_id` (uuid, foreign key) - References properties table
  - `created_at` (timestamptz) - When the property was favorited

  ### 2. `property_views`
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid, foreign key) - References profiles table
  - `property_id` (uuid, foreign key) - References properties table
  - `viewed_at` (timestamptz) - When the property was viewed
  - `view_count` (integer) - Number of times viewed

  ### 3. `property_rejections`
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid, foreign key) - References profiles table
  - `property_id` (uuid, foreign key) - References properties table
  - `rejected_at` (timestamptz) - When the property was rejected
  - `reason` (text, nullable) - Optional reason for rejection

  ## Profile Updates
  - Add `assigned_agent_id` field to profiles table for buyers to have an assigned agent

  ## Security
  - Enable RLS on all tables
  - Users can only view and manage their own interactions
  - Users can view their assigned agent information

  ## Indexes
  - Indexes on user_id and property_id for faster lookups
*/

-- Add assigned_agent_id to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'assigned_agent_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN assigned_agent_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create property_favorites table
CREATE TABLE IF NOT EXISTS property_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, property_id)
);

ALTER TABLE property_favorites ENABLE ROW LEVEL SECURITY;

-- Create property_views table
CREATE TABLE IF NOT EXISTS property_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  viewed_at timestamptz DEFAULT now(),
  view_count integer DEFAULT 1,
  UNIQUE(user_id, property_id)
);

ALTER TABLE property_views ENABLE ROW LEVEL SECURITY;

-- Create property_rejections table
CREATE TABLE IF NOT EXISTS property_rejections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  rejected_at timestamptz DEFAULT now(),
  reason text,
  UNIQUE(user_id, property_id)
);

ALTER TABLE property_rejections ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_property_favorites_user_id ON property_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_property_favorites_property_id ON property_favorites(property_id);
CREATE INDEX IF NOT EXISTS idx_property_views_user_id ON property_views(user_id);
CREATE INDEX IF NOT EXISTS idx_property_views_property_id ON property_views(property_id);
CREATE INDEX IF NOT EXISTS idx_property_rejections_user_id ON property_rejections(user_id);
CREATE INDEX IF NOT EXISTS idx_property_rejections_property_id ON property_rejections(property_id);
CREATE INDEX IF NOT EXISTS idx_profiles_assigned_agent_id ON profiles(assigned_agent_id);

-- RLS Policies for property_favorites
CREATE POLICY "Users can view their own favorites"
  ON property_favorites
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can add their own favorites"
  ON property_favorites
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own favorites"
  ON property_favorites
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for property_views
CREATE POLICY "Users can view their own views"
  ON property_views
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can add their own views"
  ON property_views
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own views"
  ON property_views
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for property_rejections
CREATE POLICY "Users can view their own rejections"
  ON property_rejections
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can add their own rejections"
  ON property_rejections
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own rejections"
  ON property_rejections
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());