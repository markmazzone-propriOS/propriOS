/*
  # Fix Invoice Trigger Column Names

  1. Changes
    - Update `notify_invoice_sent` function to use `provider_id` instead of `service_provider_id`
    - Update `notify_invoice_paid` function to use `provider_id` instead of `service_provider_id`
    - Fix column references to match actual table schema

  2. Notes
    - The invoices table uses `provider_id` not `service_provider_id`
    - The invoices table uses `customer_name` not `client_name`
    - This fixes the "record has no field" error when creating invoices
*/

-- Fix the notify_invoice_sent trigger function
CREATE OR REPLACE FUNCTION notify_invoice_sent() RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_activity(
    NEW.provider_id,
    NULL,
    'invoice_sent',
    'Invoice Sent',
    'Invoice #' || NEW.invoice_number || ' sent to ' || NEW.customer_name,
    NEW.id,
    'invoices'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix the notify_invoice_paid trigger function
CREATE OR REPLACE FUNCTION notify_invoice_paid() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status != 'paid' AND NEW.status = 'paid' THEN
    PERFORM create_activity(
      NEW.provider_id,
      NULL,
      'invoice_paid',
      'Invoice Paid',
      'Invoice #' || NEW.invoice_number || ' has been paid',
      NEW.id,
      'invoices'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
