/*
  # Backfill Seller Agent Assignments

  ## Overview
  Some properties have agents assigned but the seller's assigned_agent_id field
  was never set. This migration backfills those assignments so sellers appear
  in their agent's client list.

  ## Changes
  - Update all sellers whose properties have agents assigned
  - Set their assigned_agent_id to match their property's agent_id
*/

-- Backfill seller agent assignments
UPDATE profiles
SET assigned_agent_id = subq.agent_id
FROM (
  SELECT DISTINCT 
    p.seller_id,
    p.agent_id
  FROM properties p
  WHERE p.agent_id IS NOT NULL 
    AND p.seller_id IS NOT NULL
) AS subq
WHERE profiles.id = subq.seller_id
  AND (profiles.assigned_agent_id IS NULL OR profiles.assigned_agent_id != subq.agent_id);