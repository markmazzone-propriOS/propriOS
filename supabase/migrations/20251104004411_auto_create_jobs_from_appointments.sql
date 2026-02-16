/*
  # Auto-Create Jobs from Appointments with Property Owners
  
  1. Changes
    - Add trigger to automatically create jobs when appointments are created with property owners
    - Jobs are only created when property_owner_id is set
    - Job details are populated from appointment information
    - Initial job update is created to track job creation
  
  2. Notes
    - Only appointments with property owners create jobs
    - Job status starts as 'scheduled'
    - Job start date matches appointment start time
    - Job is linked back to the appointment via appointment_id
*/

-- Function to auto-create job from appointment
CREATE OR REPLACE FUNCTION auto_create_job_from_appointment()
RETURNS TRIGGER AS $$
DECLARE
  v_job_id uuid;
BEGIN
  -- Only create job if appointment has a property owner
  IF NEW.property_owner_id IS NOT NULL THEN
    -- Create the job
    INSERT INTO service_provider_jobs (
      service_provider_id,
      property_owner_id,
      appointment_id,
      lead_id,
      title,
      description,
      location,
      status,
      priority,
      start_date,
      notes
    ) VALUES (
      NEW.service_provider_id,
      NEW.property_owner_id,
      NEW.id,
      NEW.lead_id,
      NEW.title,
      NEW.description,
      NEW.location,
      'scheduled',
      'normal',
      NEW.start_time,
      'Job automatically created from appointment scheduled on ' || to_char(NEW.created_at, 'YYYY-MM-DD HH24:MI')
    )
    RETURNING id INTO v_job_id;
    
    -- Create initial job update
    INSERT INTO service_provider_job_updates (
      job_id,
      service_provider_id,
      update_type,
      title,
      description
    ) VALUES (
      v_job_id,
      NEW.service_provider_id,
      'note',
      'Job Created',
      'Job automatically created from appointment with ' || NEW.client_name
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new appointments
DROP TRIGGER IF EXISTS auto_create_job_from_appointment_trigger ON service_provider_appointments;
CREATE TRIGGER auto_create_job_from_appointment_trigger
  AFTER INSERT ON service_provider_appointments
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_job_from_appointment();

-- Function to update job when appointment is updated
CREATE OR REPLACE FUNCTION sync_job_from_appointment_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Update linked job if it exists
  IF NEW.property_owner_id IS NOT NULL THEN
    UPDATE service_provider_jobs
    SET
      title = NEW.title,
      description = NEW.description,
      location = NEW.location,
      start_date = NEW.start_time,
      status = CASE 
        WHEN NEW.status = 'cancelled' THEN 'cancelled'
        WHEN NEW.status = 'completed' THEN 'completed'
        ELSE service_provider_jobs.status
      END
    WHERE appointment_id = NEW.id;
    
    -- Log the update if job was found
    IF FOUND THEN
      INSERT INTO service_provider_job_updates (
        job_id,
        service_provider_id,
        update_type,
        title,
        description
      )
      SELECT 
        id,
        NEW.service_provider_id,
        'note',
        'Appointment Updated',
        'Job details synced from appointment update'
      FROM service_provider_jobs
      WHERE appointment_id = NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for appointment updates
DROP TRIGGER IF EXISTS sync_job_from_appointment_update_trigger ON service_provider_appointments;
CREATE TRIGGER sync_job_from_appointment_update_trigger
  AFTER UPDATE ON service_provider_appointments
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION sync_job_from_appointment_update();
