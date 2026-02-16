/*
  # Update Agent Reviews - Allow All Authenticated User Types
  
  1. Changes
    - Drop the existing insert policy that only allows buyers and sellers
    - Create new policy that allows all authenticated user types to review agents:
      - buyers
      - sellers
      - service_providers
      - mortgage_lenders
      - property_owners
    - Still prevents agents from reviewing themselves
    - Still prevents unauthenticated users from leaving reviews
    
  2. Security
    - Only authenticated users with valid user types can leave reviews
    - Users cannot review themselves if they are also an agent
    - Maintains unique constraint (one review per user per agent)
*/

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Authenticated users can insert reviews" ON agent_reviews;

-- Create new policy allowing all authenticated user types
CREATE POLICY "Authenticated users can insert reviews"
  ON agent_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = reviewer_id
    AND auth.uid() != agent_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND user_type IN ('buyer', 'seller', 'service_provider', 'mortgage_lender', 'property_owner')
    )
  );