/*
  # Add policy for agents to view their own properties
  
  1. Changes
    - Add SELECT policy allowing agents to view properties they listed or are assigned to
    - This enables agents to see all their properties regardless of status
  
  2. Security
    - Policy checks that the user is either the listing agent (listed_by) or assigned agent (agent_id)
    - Restricted to authenticated users only
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'properties' 
    AND policyname = 'Agents can view own properties'
  ) THEN
    CREATE POLICY "Agents can view own properties"
      ON properties
      FOR SELECT
      TO authenticated
      USING (auth.uid() = listed_by OR auth.uid() = agent_id);
  END IF;
END $$;
