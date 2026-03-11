/*
  # Create Agent Chatbot System

  1. New Tables
    - `agent_chat_conversations`
      - `id` (uuid, primary key)
      - `agent_id` (uuid, references profiles)
      - `title` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `agent_chat_messages`
      - `id` (uuid, primary key)
      - `conversation_id` (uuid, references agent_chat_conversations)
      - `role` (text) - 'user' or 'assistant'
      - `content` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Agents can only access their own conversations and messages
*/

-- Create agent_chat_conversations table
CREATE TABLE IF NOT EXISTS agent_chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL DEFAULT 'New Conversation',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create agent_chat_messages table
CREATE TABLE IF NOT EXISTS agent_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES agent_chat_conversations(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_agent_chat_conversations_agent_id ON agent_chat_conversations(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_chat_messages_conversation_id ON agent_chat_messages(conversation_id);

-- Enable RLS
ALTER TABLE agent_chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for agent_chat_conversations
CREATE POLICY "Agents can view own conversations"
  ON agent_chat_conversations FOR SELECT
  TO authenticated
  USING (agent_id = auth.uid());

CREATE POLICY "Agents can create own conversations"
  ON agent_chat_conversations FOR INSERT
  TO authenticated
  WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents can update own conversations"
  ON agent_chat_conversations FOR UPDATE
  TO authenticated
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents can delete own conversations"
  ON agent_chat_conversations FOR DELETE
  TO authenticated
  USING (agent_id = auth.uid());

-- RLS Policies for agent_chat_messages
CREATE POLICY "Agents can view messages in own conversations"
  ON agent_chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agent_chat_conversations
      WHERE agent_chat_conversations.id = agent_chat_messages.conversation_id
      AND agent_chat_conversations.agent_id = auth.uid()
    )
  );

CREATE POLICY "Agents can create messages in own conversations"
  ON agent_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agent_chat_conversations
      WHERE agent_chat_conversations.id = agent_chat_messages.conversation_id
      AND agent_chat_conversations.agent_id = auth.uid()
    )
  );

CREATE POLICY "Agents can delete messages in own conversations"
  ON agent_chat_messages FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agent_chat_conversations
      WHERE agent_chat_conversations.id = agent_chat_messages.conversation_id
      AND agent_chat_conversations.agent_id = auth.uid()
    )
  );