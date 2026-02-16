/*
  # Create Agent Teams System

  1. New Tables
    - `teams`
      - `id` (uuid, primary key)
      - `name` (text) - Team name
      - `description` (text, nullable) - Team description
      - `owner_id` (uuid) - References profiles, the agent who created the team
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `team_members`
      - `id` (uuid, primary key)
      - `team_id` (uuid) - References teams
      - `agent_id` (uuid) - References profiles (must be an agent)
      - `role` (text) - 'owner', 'admin', or 'member'
      - `joined_at` (timestamptz)
      - `invited_by` (uuid) - References profiles
      - `created_at` (timestamptz)
    
    - `team_invitations`
      - `id` (uuid, primary key)
      - `team_id` (uuid) - References teams
      - `inviter_id` (uuid) - References profiles (the agent sending invitation)
      - `invitee_email` (text) - Email of the agent being invited
      - `invitee_name` (text) - Name of the agent being invited
      - `status` (text) - 'pending', 'accepted', 'declined', 'cancelled'
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Agents can view their own teams
    - Team owners and admins can manage team members
    - Team members can view team information
    - Only agents can create teams and be team members
*/

-- Create teams table
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  owner_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create team_members table
CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  agent_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at timestamptz DEFAULT now(),
  invited_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(team_id, agent_id)
);

-- Create team_invitations table
CREATE TABLE IF NOT EXISTS team_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  inviter_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  invitee_email text NOT NULL,
  invitee_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_teams_owner ON teams(owner_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_agent ON team_members(agent_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_team ON team_invitations(team_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(invitee_email);

-- Enable RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for teams table

-- Agents can view teams they own or are members of
CREATE POLICY "Agents can view their teams"
  ON teams
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = teams.id
      AND team_members.agent_id = auth.uid()
    )
  );

-- Only agents can create teams
CREATE POLICY "Agents can create teams"
  ON teams
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = owner_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'agent'
    )
  );

-- Team owners can update their teams
CREATE POLICY "Team owners can update teams"
  ON teams
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Team owners can delete their teams
CREATE POLICY "Team owners can delete teams"
  ON teams
  FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- RLS Policies for team_members table

-- Team members can view members of their teams
CREATE POLICY "Team members can view team members"
  ON team_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_members.team_id
      AND (
        teams.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM team_members tm
          WHERE tm.team_id = teams.id
          AND tm.agent_id = auth.uid()
        )
      )
    )
  );

-- Team owners and admins can add members
CREATE POLICY "Team owners and admins can add members"
  ON team_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_members.team_id
      AND teams.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_members.team_id
      AND tm.agent_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
  );

-- Team owners and admins can update member roles
CREATE POLICY "Team owners and admins can update members"
  ON team_members
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_members.team_id
      AND teams.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_members.team_id
      AND tm.agent_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_members.team_id
      AND teams.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_members.team_id
      AND tm.agent_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
  );

-- Team owners and admins can remove members
CREATE POLICY "Team owners and admins can remove members"
  ON team_members
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_members.team_id
      AND teams.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_members.team_id
      AND tm.agent_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
    OR team_members.agent_id = auth.uid()
  );

-- RLS Policies for team_invitations table

-- Team members can view invitations for their teams, and invitees can see their own invitations
CREATE POLICY "Team members can view team invitations"
  ON team_invitations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_invitations.team_id
      AND (
        teams.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM team_members
          WHERE team_members.team_id = teams.id
          AND team_members.agent_id = auth.uid()
        )
      )
    )
    OR EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = team_invitations.invitee_email
    )
  );

-- Team owners and admins can send invitations
CREATE POLICY "Team owners and admins can send invitations"
  ON team_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = inviter_id
    AND (
      EXISTS (
        SELECT 1 FROM teams
        WHERE teams.id = team_invitations.team_id
        AND teams.owner_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM team_members
        WHERE team_members.team_id = team_invitations.team_id
        AND team_members.agent_id = auth.uid()
        AND team_members.role IN ('owner', 'admin')
      )
    )
  );

-- Team owners, admins, and invitees can update invitations
CREATE POLICY "Team owners and admins can update invitations"
  ON team_invitations
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = inviter_id
    OR EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_invitations.team_id
      AND teams.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = team_invitations.team_id
      AND team_members.agent_id = auth.uid()
      AND team_members.role IN ('owner', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = team_invitations.invitee_email
    )
  )
  WITH CHECK (
    auth.uid() = inviter_id
    OR EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_invitations.team_id
      AND teams.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = team_invitations.team_id
      AND team_members.agent_id = auth.uid()
      AND team_members.role IN ('owner', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = team_invitations.invitee_email
    )
  );

-- Team owners and admins can delete invitations
CREATE POLICY "Team owners and admins can delete invitations"
  ON team_invitations
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = inviter_id
    OR EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_invitations.team_id
      AND teams.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = team_invitations.team_id
      AND team_members.agent_id = auth.uid()
      AND team_members.role IN ('owner', 'admin')
    )
  );

-- Function to automatically add owner as team member when team is created
CREATE OR REPLACE FUNCTION add_team_owner_as_member()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO team_members (team_id, agent_id, role, invited_by)
  VALUES (NEW.id, NEW.owner_id, 'owner', NEW.owner_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to add owner as member
DROP TRIGGER IF EXISTS trigger_add_team_owner_as_member ON teams;
CREATE TRIGGER trigger_add_team_owner_as_member
  AFTER INSERT ON teams
  FOR EACH ROW
  EXECUTE FUNCTION add_team_owner_as_member();

-- Function to handle team invitation acceptance
CREATE OR REPLACE FUNCTION accept_team_invitation(p_invitation_id uuid)
RETURNS void AS $$
DECLARE
  v_invitation team_invitations;
  v_invitee_id uuid;
  v_invitee_email text;
BEGIN
  SELECT * INTO v_invitation
  FROM team_invitations
  WHERE id = p_invitation_id
  AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found or already processed';
  END IF;

  SELECT email INTO v_invitee_email
  FROM auth.users
  WHERE id = auth.uid();

  IF v_invitee_email != v_invitation.invitee_email THEN
    RAISE EXCEPTION 'You are not the invitee';
  END IF;

  SELECT id INTO v_invitee_id
  FROM profiles
  WHERE id = auth.uid()
  AND user_type = 'agent';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only agents can accept team invitations';
  END IF;

  INSERT INTO team_members (team_id, agent_id, invited_by)
  VALUES (v_invitation.team_id, v_invitee_id, v_invitation.inviter_id)
  ON CONFLICT (team_id, agent_id) DO NOTHING;

  UPDATE team_invitations
  SET status = 'accepted',
      updated_at = now()
  WHERE id = p_invitation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;