/*
  # Remove Agent Offer Update Permissions

  ## Changes
  This migration removes the RLS policies that allowed agents to update offer status.
  Agents should only be able to view offers, not take action on them. Only sellers
  and property listers can accept, reject, or counter offers.

  1. Policies Removed
    - "Agents can update offer status on their listings" - Removed agent update capability

  2. Security
    - Maintains view permissions for agents
    - Only sellers and property listers can now update offer status
    - Buyers can still withdraw their own offers
*/

-- Remove the policy that allows agents to update offer status
DROP POLICY IF EXISTS "Agents can update offer status on their listings" ON property_offers;