/*
  # Optimize RLS Policies - Part 1 (Properties Table)
  
  ## Performance Optimization
  Wraps auth.uid() calls in SELECT subqueries to prevent re-evaluation for each row.
  This dramatically improves query performance at scale.
  
  ## Tables Updated
  - properties: 11 policies optimized
  
  ## Reference
  https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
*/

-- Drop and recreate properties policies with optimized auth checks
DROP POLICY IF EXISTS "Agents can assign sellers to own listings" ON properties;
DROP POLICY IF EXISTS "Agents can view own properties" ON properties;
DROP POLICY IF EXISTS "Assigned agent can update property" ON properties;
DROP POLICY IF EXISTS "Authenticated users can create properties" ON properties;
DROP POLICY IF EXISTS "Property owner can delete own property" ON properties;
DROP POLICY IF EXISTS "Property owner can update own property" ON properties;
DROP POLICY IF EXISTS "Property owners can delete own listings" ON properties;
DROP POLICY IF EXISTS "Property owners can update own listings" ON properties;
DROP POLICY IF EXISTS "Property owners can view own listings" ON properties;
DROP POLICY IF EXISTS "Sellers can update own properties" ON properties;
DROP POLICY IF EXISTS "Sellers can view own properties" ON properties;

CREATE POLICY "Agents can assign sellers to own listings"
  ON properties FOR UPDATE
  TO authenticated
  USING (agent_id = (SELECT auth.uid()))
  WITH CHECK (agent_id = (SELECT auth.uid()));

CREATE POLICY "Agents can view own properties"
  ON properties FOR SELECT
  TO authenticated
  USING (agent_id = (SELECT auth.uid()));

CREATE POLICY "Assigned agent can update property"
  ON properties FOR UPDATE
  TO authenticated
  USING (agent_id = (SELECT auth.uid()))
  WITH CHECK (agent_id = (SELECT auth.uid()));

CREATE POLICY "Authenticated users can create properties"
  ON properties FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "Property owner can delete own property"
  ON properties FOR DELETE
  TO authenticated
  USING (property_owner_id = (SELECT auth.uid()));

CREATE POLICY "Property owner can update own property"
  ON properties FOR UPDATE
  TO authenticated
  USING (property_owner_id = (SELECT auth.uid()))
  WITH CHECK (property_owner_id = (SELECT auth.uid()));

CREATE POLICY "Property owners can delete own listings"
  ON properties FOR DELETE
  TO authenticated
  USING (property_owner_id = (SELECT auth.uid()));

CREATE POLICY "Property owners can update own listings"
  ON properties FOR UPDATE
  TO authenticated
  USING (property_owner_id = (SELECT auth.uid()))
  WITH CHECK (property_owner_id = (SELECT auth.uid()));

CREATE POLICY "Property owners can view own listings"
  ON properties FOR SELECT
  TO authenticated
  USING (property_owner_id = (SELECT auth.uid()));

CREATE POLICY "Sellers can update own properties"
  ON properties FOR UPDATE
  TO authenticated
  USING (seller_id = (SELECT auth.uid()))
  WITH CHECK (seller_id = (SELECT auth.uid()));

CREATE POLICY "Sellers can view own properties"
  ON properties FOR SELECT
  TO authenticated
  USING (seller_id = (SELECT auth.uid()));
