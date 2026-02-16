/*
  # Add SMS Support to Notification Triggers

  1. Changes
    - Create helper function to send SMS via edge function
    - Update existing notification triggers to optionally send SMS
    - Add SMS for: offers, viewings, price changes, prospect reminders, leads

  2. Notes
    - SMS is only sent if user has enabled and verified SMS preferences
    - Uses the send-sms-notification edge function
    - All SMS sends are logged in sms_logs table
*/

-- Helper function to trigger SMS via edge function
CREATE OR REPLACE FUNCTION trigger_sms_notification(
  p_user_id uuid,
  p_notification_type text,
  p_message text,
  p_reference_id uuid DEFAULT NULL,
  p_reference_type text DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_should_send boolean;
  v_function_url text;
BEGIN
  v_should_send := should_send_sms(p_user_id, p_notification_type);
  
  IF NOT v_should_send THEN
    RETURN;
  END IF;

  v_function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-sms-notification';
  
  PERFORM net.http_post(
    url := v_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object(
      'user_id', p_user_id,
      'notification_type', p_notification_type,
      'message', p_message,
      'reference_id', p_reference_id,
      'reference_type', p_reference_type
    )
  );
  
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to trigger SMS: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update offer notification trigger to include SMS
CREATE OR REPLACE FUNCTION notify_offer_received() RETURNS TRIGGER AS $$
DECLARE
  v_property record;
  v_seller_id uuid;
  v_seller_name text;
  v_agent_id uuid;
  v_buyer_name text;
  v_sms_message text;
BEGIN
  SELECT * INTO v_property FROM properties WHERE id = NEW.property_id;
  
  IF v_property.agent_id IS NOT NULL THEN
    v_agent_id := v_property.agent_id;
    
    SELECT full_name INTO v_seller_name FROM profiles WHERE id = v_property.seller_id;
    SELECT full_name INTO v_buyer_name FROM profiles WHERE id = NEW.buyer_id;
    
    PERFORM create_activity(
      v_agent_id,
      NEW.buyer_id,
      'offer_received',
      'New Offer Received',
      'Offer of $' || NEW.offer_amount || ' received from ' || v_buyer_name || ' for ' || v_property.street_address,
      NEW.id,
      'offer',
      jsonb_build_object(
        'offer_amount', NEW.offer_amount,
        'property_id', NEW.property_id,
        'buyer_name', v_buyer_name,
        'property_address', v_property.street_address
      )
    );

    v_sms_message := 'New offer of $' || NEW.offer_amount || ' received on ' || v_property.street_address || ' from ' || v_buyer_name;
    PERFORM trigger_sms_notification(v_agent_id, 'offer', v_sms_message, NEW.id, 'offer');
  END IF;

  IF v_property.seller_id IS NOT NULL THEN
    v_seller_id := v_property.seller_id;
    SELECT full_name INTO v_buyer_name FROM profiles WHERE id = NEW.buyer_id;
    
    PERFORM create_activity(
      v_seller_id,
      NEW.buyer_id,
      'offer_received',
      'New Offer on Your Property',
      'Offer of $' || NEW.offer_amount || ' received from ' || v_buyer_name,
      NEW.id,
      'offer',
      jsonb_build_object(
        'offer_amount', NEW.offer_amount,
        'property_id', NEW.property_id,
        'buyer_name', v_buyer_name
      )
    );

    v_sms_message := 'New offer of $' || NEW.offer_amount || ' received on your property at ' || v_property.street_address;
    PERFORM trigger_sms_notification(v_seller_id, 'offer', v_sms_message, NEW.id, 'offer');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update viewing scheduled trigger to include SMS
CREATE OR REPLACE FUNCTION notify_viewing_scheduled() RETURNS TRIGGER AS $$
DECLARE
  v_property record;
  v_agent_id uuid;
  v_requester_name text;
  v_sms_message text;
BEGIN
  IF NEW.event_type = 'viewing' AND NEW.property_id IS NOT NULL THEN
    SELECT * INTO v_property FROM properties WHERE id = NEW.property_id;
    
    IF v_property.agent_id IS NOT NULL THEN
      v_agent_id := v_property.agent_id;
      
      IF NEW.requester_id IS NOT NULL THEN
        SELECT full_name INTO v_requester_name FROM profiles WHERE id = NEW.requester_id;
      ELSE
        v_requester_name := 'A visitor';
      END IF;
      
      PERFORM create_activity(
        v_agent_id,
        NEW.requester_id,
        'viewing_scheduled',
        'Property Viewing Scheduled',
        v_requester_name || ' scheduled a viewing for ' || v_property.street_address || ' on ' || to_char(NEW.start_time, 'Mon DD at HH:MI AM'),
        NEW.property_id,
        'property',
        jsonb_build_object(
          'property_address', v_property.street_address,
          'viewing_time', NEW.start_time,
          'requester_name', v_requester_name
        )
      );

      v_sms_message := v_requester_name || ' scheduled a viewing for ' || v_property.street_address || ' on ' || to_char(NEW.start_time, 'Mon DD at HH:MI AM');
      PERFORM trigger_sms_notification(v_agent_id, 'viewing_scheduled', v_sms_message, NEW.property_id, 'property');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update price change trigger to include SMS
CREATE OR REPLACE FUNCTION notify_price_change() RETURNS TRIGGER AS $$
DECLARE
  v_favorite record;
  v_user_name text;
  v_sms_message text;
BEGIN
  IF OLD.price != NEW.price AND NEW.status = 'active' THEN
    FOR v_favorite IN 
      SELECT f.user_id, p.full_name
      FROM favorites f
      JOIN profiles p ON f.user_id = p.id
      WHERE f.property_id = NEW.id
    LOOP
      PERFORM create_activity(
        v_favorite.user_id,
        NULL,
        'price_change',
        'Price Change Alert',
        'Price changed for ' || NEW.street_address || ' from $' || OLD.price || ' to $' || NEW.price,
        NEW.id,
        'property',
        jsonb_build_object(
          'property_address', NEW.street_address,
          'old_price', OLD.price,
          'new_price', NEW.price,
          'price_direction', CASE WHEN NEW.price > OLD.price THEN 'increase' ELSE 'decrease' END
        )
      );

      v_sms_message := 'Price ' || CASE WHEN NEW.price > OLD.price THEN 'increased' ELSE 'reduced' END || 
                       ' for ' || NEW.street_address || ' from $' || OLD.price || ' to $' || NEW.price;
      PERFORM trigger_sms_notification(v_favorite.user_id, 'price_change', v_sms_message, NEW.id, 'property');
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update prospect reminder due function to include SMS
CREATE OR REPLACE FUNCTION check_due_prospect_reminders()
RETURNS void AS $$
DECLARE
  v_reminder record;
  v_prospect_name text;
  v_sms_message text;
BEGIN
  FOR v_reminder IN 
    SELECT * FROM prospect_reminders
    WHERE completed = false
      AND reminder_date <= now()
      AND reminder_date > now() - interval '1 hour'
  LOOP
    SELECT full_name INTO v_prospect_name FROM prospects WHERE id = v_reminder.prospect_id;
    
    PERFORM create_activity(
      v_reminder.agent_id,
      NULL,
      'prospect_reminder_due',
      'Reminder: Contact ' || v_prospect_name,
      'Time to ' || v_reminder.reminder_type || ' ' || v_prospect_name || 
        CASE WHEN v_reminder.notes IS NOT NULL THEN '. Notes: ' || v_reminder.notes ELSE '' END,
      v_reminder.prospect_id,
      'prospect',
      jsonb_build_object(
        'reminder_id', v_reminder.id,
        'reminder_type', v_reminder.reminder_type,
        'prospect_name', v_prospect_name,
        'notes', v_reminder.notes
      )
    );

    v_sms_message := 'Reminder: ' || v_reminder.reminder_type || ' ' || v_prospect_name || 
                     CASE WHEN v_reminder.notes IS NOT NULL THEN '. ' || v_reminder.notes ELSE '' END;
    PERFORM trigger_sms_notification(v_reminder.agent_id, 'prospect_reminder', v_sms_message, v_reminder.prospect_id, 'prospect');
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
