/*
  # Add Activity Feed Triggers for Service Provider and Lender Leads

  1. Changes
    - Add trigger for service provider lead status updates (notify service provider)
    - Add trigger for lender lead status updates (notify lender)

  2. Activity Types
    - lead_status_updated: When service provider lead or lender lead status changes

  3. Security
    - All triggers use SECURITY DEFINER to ensure they can create activities
    - Activity feed policies already handle read access
*/

-- Trigger for service provider lead status updates (notify service provider)
CREATE OR REPLACE FUNCTION notify_service_provider_lead_status_updated() RETURNS TRIGGER AS $$
DECLARE
  v_title text;
  v_description text;
BEGIN
  IF OLD.status != NEW.status THEN
    v_title := 'Lead Status Updated';
    v_description := NEW.name || '''s status changed from ' || OLD.status || ' to ' || NEW.status;
    
    PERFORM create_activity(
      NEW.service_provider_id,
      auth.uid(),
      'lead_status_updated',
      v_title,
      v_description,
      NEW.id,
      'service_provider_lead',
      jsonb_build_object(
        'lead_name', NEW.name,
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_service_provider_lead_status_updated ON service_provider_leads;
CREATE TRIGGER on_service_provider_lead_status_updated
  AFTER UPDATE ON service_provider_leads
  FOR EACH ROW
  EXECUTE FUNCTION notify_service_provider_lead_status_updated();

-- Trigger for lender lead status updates (notify lender)
CREATE OR REPLACE FUNCTION notify_lender_lead_status_updated() RETURNS TRIGGER AS $$
DECLARE
  v_title text;
  v_description text;
BEGIN
  IF OLD.status != NEW.status THEN
    v_title := 'Lead Status Updated';
    v_description := NEW.name || '''s status changed from ' || OLD.status || ' to ' || NEW.status;
    
    PERFORM create_activity(
      NEW.lender_id,
      auth.uid(),
      'lead_status_updated',
      v_title,
      v_description,
      NEW.id,
      'lender_lead',
      jsonb_build_object(
        'lead_name', NEW.name,
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_lender_lead_status_updated ON lender_leads;
CREATE TRIGGER on_lender_lead_status_updated
  AFTER UPDATE ON lender_leads
  FOR EACH ROW
  EXECUTE FUNCTION notify_lender_lead_status_updated();
