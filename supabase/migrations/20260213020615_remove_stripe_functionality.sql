/*
  # Remove Stripe Functionality

  ## Overview
  Removes all Stripe-related tables from the database as the platform
  is no longer using Stripe for payments or subscriptions.

  ## Changes
  - Drop stripe_customers table
  - Drop stripe_subscriptions table
  - Drop stripe_orders table
  - Drop subscriptions table
  - Drop subscription_plans table

  ## Notes
  This is a destructive operation but is safe as we're removing
  the entire Stripe integration from the platform.
*/

-- Drop all Stripe-related tables
DROP TABLE IF EXISTS stripe_orders CASCADE;
DROP TABLE IF EXISTS stripe_subscriptions CASCADE;
DROP TABLE IF EXISTS stripe_customers CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS subscription_plans CASCADE;