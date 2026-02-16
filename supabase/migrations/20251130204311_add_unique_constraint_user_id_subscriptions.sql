/*
  # Add unique constraint on user_id in subscriptions table

  1. Changes
    - Add unique constraint on user_id column
    - This ensures one subscription per user
    - Allows upsert operations based on user_id in checkout session

  2. Notes
    - Each user should only have one active subscription
    - This prevents duplicate subscriptions for the same user
*/

ALTER TABLE subscriptions 
ADD CONSTRAINT subscriptions_user_id_key UNIQUE (user_id);