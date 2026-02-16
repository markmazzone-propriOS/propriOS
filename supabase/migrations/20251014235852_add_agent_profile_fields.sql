/*
  # Add Years of Experience, Brokerage, and Specialization to Agent Profiles

  1. Changes
    - Add `years_experience` column (integer) to track agent's years of experience
    - Add `brokerage` column (text) to store the brokerage firm name
    - Add `specialization` column (text) to store agent's area of specialization
  
  2. Notes
    - All fields are optional and can be null
    - Default values not set to allow agents to fill in their information
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_profiles' AND column_name = 'years_experience'
  ) THEN
    ALTER TABLE agent_profiles ADD COLUMN years_experience integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_profiles' AND column_name = 'brokerage'
  ) THEN
    ALTER TABLE agent_profiles ADD COLUMN brokerage text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_profiles' AND column_name = 'specialization'
  ) THEN
    ALTER TABLE agent_profiles ADD COLUMN specialization text;
  END IF;
END $$;