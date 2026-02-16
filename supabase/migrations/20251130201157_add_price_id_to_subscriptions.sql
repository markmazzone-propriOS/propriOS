/*
  # Add price_id to subscriptions table

  1. Changes
    - Add `price_id` column to subscriptions table to track which Stripe price the user subscribed to
    - This is needed to identify whether the user has an agent or service provider plan

  2. Notes
    - Price ID is the Stripe price identifier (e.g., price_1QYAKTLjdPzVHp5tYqy3GfJV)
    - This column will be populated by the Stripe webhook when subscription is created/updated
*/

ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS price_id text;