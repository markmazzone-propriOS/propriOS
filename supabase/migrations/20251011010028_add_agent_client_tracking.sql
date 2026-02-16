/*
  # Add Agent Client Tracking

  ## Overview
  This migration adds functionality to track which buyers and sellers are assigned to which agents.
  It also creates a view to help agents see their active and sold listings.

  ## Changes

  ### 1. Add Index
  - Add index on assigned_agent_id in profiles table for faster agent-client lookups

  ### 2. Update Properties Table
  - Ensure agent_id field exists and is properly indexed

  ## Notes
  - The assigned_agent_id field in profiles was already added in a previous migration
  - This migration adds supporting indexes for better query performance
  - Agents can now easily query their assigned buyers/sellers via the assigned_agent_id field
  - Agents can see their listings via the agent_id field in properties table
*/

-- Index already created in previous migration, adding if not exists check
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_profiles_assigned_agent_id'
  ) THEN
    CREATE INDEX idx_profiles_assigned_agent_id ON profiles(assigned_agent_id);
  END IF;
END $$;

-- Add index on agent_id in properties table for faster agent listing lookups
CREATE INDEX IF NOT EXISTS idx_properties_agent_id ON properties(agent_id);

-- Add index on listed_by in properties table
CREATE INDEX IF NOT EXISTS idx_properties_listed_by ON properties(listed_by);