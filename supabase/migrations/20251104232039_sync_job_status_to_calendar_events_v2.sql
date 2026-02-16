/*
  # Sync Job Status to Calendar Events

  1. Changes
    - Add 'in_progress' status to calendar_events valid statuses
    - Create function to update calendar event status when job status changes
    - Add trigger to automatically sync job status to calendar events
    - Map job statuses to appropriate calendar event statuses

  2. Status Mapping
    - Job 'scheduled' → Calendar 'confirmed' (appointment is confirmed)
    - Job 'in_progress' → Calendar 'in_progress' (work has started)
    - Job 'completed' → Calendar 'completed' (work is done)
    - Job 'cancelled' → Calendar 'cancelled' (appointment cancelled)
    - Job 'on_hold' → Calendar 'confirmed' (still scheduled, just paused)

  3. Notes
    - Only syncs for service appointments (event_type = 'appointment')
    - Updates happen automatically when job status changes
    - Ensures calendar reflects actual work progress
*/

-- Drop the existing constraint and add the new one with 'in_progress' status
ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS valid_status;
ALTER TABLE calendar_events ADD CONSTRAINT valid_status 
  CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'in_progress'));

-- Function to sync job status to calendar event
CREATE OR REPLACE FUNCTION sync_job_status_to_calendar()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_calendar_status text;
BEGIN
  -- Map job status to calendar event status
  CASE NEW.status
    WHEN 'scheduled' THEN v_calendar_status := 'confirmed';
    WHEN 'in_progress' THEN v_calendar_status := 'in_progress';
    WHEN 'completed' THEN v_calendar_status := 'completed';
    WHEN 'cancelled' THEN v_calendar_status := 'cancelled';
    WHEN 'on_hold' THEN v_calendar_status := 'confirmed';
    ELSE v_calendar_status := 'confirmed';
  END CASE;

  -- Update the calendar event if it exists and is an appointment
  UPDATE calendar_events
  SET 
    status = v_calendar_status,
    updated_at = now()
  WHERE appointment_id = NEW.appointment_id
    AND event_type = 'appointment'
    AND status != v_calendar_status; -- Only update if status actually changed

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for job status changes
DROP TRIGGER IF EXISTS sync_job_status_to_calendar_trigger ON service_provider_jobs;
CREATE TRIGGER sync_job_status_to_calendar_trigger
  AFTER INSERT OR UPDATE OF status ON service_provider_jobs
  FOR EACH ROW
  WHEN (NEW.appointment_id IS NOT NULL)
  EXECUTE FUNCTION sync_job_status_to_calendar();

-- Update existing calendar events to match their job statuses
UPDATE calendar_events ce
SET status = CASE 
  WHEN spj.status = 'scheduled' THEN 'confirmed'
  WHEN spj.status = 'in_progress' THEN 'in_progress'
  WHEN spj.status = 'completed' THEN 'completed'
  WHEN spj.status = 'cancelled' THEN 'cancelled'
  WHEN spj.status = 'on_hold' THEN 'confirmed'
  ELSE 'confirmed'
END,
updated_at = now()
FROM service_provider_jobs spj
WHERE ce.appointment_id = spj.appointment_id
  AND ce.event_type = 'appointment'
  AND ce.status != CASE 
    WHEN spj.status = 'scheduled' THEN 'confirmed'
    WHEN spj.status = 'in_progress' THEN 'in_progress'
    WHEN spj.status = 'completed' THEN 'completed'
    WHEN spj.status = 'cancelled' THEN 'cancelled'
    WHEN spj.status = 'on_hold' THEN 'confirmed'
    ELSE 'confirmed'
  END;
