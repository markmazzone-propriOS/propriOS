/*
  # Create Price Change Notification System

  1. Overview
    - Automatically detect property price changes
    - Send email notifications to buyers who have favorited the property
    - Track notification history to avoid duplicate emails

  2. New Tables
    - `price_change_notifications` - Track sent price change notifications
      - `id` (uuid, primary key)
      - `property_id` (uuid, references properties)
      - `buyer_id` (uuid, references auth.users)
      - `old_price` (decimal) - Previous price
      - `new_price` (decimal) - New price
      - `notified_at` (timestamptz) - When notification was sent
      - `created_at` (timestamptz)

  3. Functions
    - `notify_price_change()` - Function to send price change emails to buyers who favorited the property

  4. Triggers
    - Trigger on properties table to detect price changes and send notifications

  5. Security
    - Enable RLS on price_change_notifications table
    - Policies for buyers to view their own notifications
    - Policies for admins to view all notifications
*/

-- Create price_change_notifications table
CREATE TABLE IF NOT EXISTS price_change_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  buyer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  old_price decimal NOT NULL,
  new_price decimal NOT NULL,
  notified_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE price_change_notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for price_change_notifications
CREATE POLICY "Buyers can view their own price change notifications"
  ON price_change_notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = buyer_id);

CREATE POLICY "Admins can view all price change notifications"
  ON price_change_notifications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.user_type = 'admin'
    )
  );

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_price_change_notifications_property_id
  ON price_change_notifications(property_id);

CREATE INDEX IF NOT EXISTS idx_price_change_notifications_buyer_id
  ON price_change_notifications(buyer_id);

-- Create function to notify buyers of price changes
CREATE OR REPLACE FUNCTION notify_price_change()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  favorite_record RECORD;
  buyer_record RECORD;
  property_record RECORD;
BEGIN
  -- Only proceed if price has changed and property is still active
  IF OLD.price IS DISTINCT FROM NEW.price AND NEW.status = 'active' THEN

    -- Get property details
    SELECT
      address,
      city,
      state
    INTO property_record
    FROM properties
    WHERE id = NEW.id;

    -- Loop through all buyers who have favorited this property
    FOR favorite_record IN
      SELECT DISTINCT buyer_id
      FROM favorites
      WHERE property_id = NEW.id
    LOOP
      -- Get buyer details
      SELECT
        u.email,
        us.full_name
      INTO buyer_record
      FROM auth.users u
      LEFT JOIN users us ON us.id = u.id
      WHERE u.id = favorite_record.buyer_id;

      -- Skip if buyer email not found
      IF buyer_record.email IS NULL THEN
        CONTINUE;
      END IF;

      -- Insert notification record
      INSERT INTO price_change_notifications (
        property_id,
        buyer_id,
        old_price,
        new_price
      ) VALUES (
        NEW.id,
        favorite_record.buyer_id,
        OLD.price,
        NEW.price
      );

      -- Call edge function to send email (using pg_net or similar)
      -- Note: This will be called asynchronously
      PERFORM net.http_post(
        url := current_setting('app.supabase_url') || '/functions/v1/send-price-change-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
        ),
        body := jsonb_build_object(
          'buyer_email', buyer_record.email,
          'buyer_name', COALESCE(buyer_record.full_name, 'Valued Buyer'),
          'property_address', property_record.address,
          'property_city', property_record.city,
          'property_state', property_record.state,
          'old_price', OLD.price,
          'new_price', NEW.price,
          'property_id', NEW.id::text
        )
      );

    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for price changes on properties
DROP TRIGGER IF EXISTS trigger_notify_price_change ON properties;

CREATE TRIGGER trigger_notify_price_change
  AFTER UPDATE OF price ON properties
  FOR EACH ROW
  WHEN (OLD.price IS DISTINCT FROM NEW.price)
  EXECUTE FUNCTION notify_price_change();
