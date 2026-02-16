/*
  # Fix Seller Journey to Support Multiple Properties

  1. Changes
    - Drop the unique constraint on seller_id only
    - Add a new unique constraint on (seller_id, property_id) to allow multiple properties per seller
    - Each property can have its own journey progress

  2. Purpose
    - Allow sellers to track progress for multiple properties simultaneously
    - Each property gets its own independent journey tracker
*/

-- Drop the constraint that only allows one journey per seller
ALTER TABLE seller_journey_progress
DROP CONSTRAINT IF EXISTS unique_seller_journey;

-- Add new constraint allowing one journey per property per seller
ALTER TABLE seller_journey_progress
ADD CONSTRAINT unique_seller_property_journey UNIQUE (seller_id, property_id);
