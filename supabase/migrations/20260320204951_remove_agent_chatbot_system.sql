/*
  # Remove Agent Chatbot System

  1. Changes
    - Drop `agent_chat_messages` table
    - Drop `agent_chat_conversations` table
    - Remove all associated indexes and policies

  2. Notes
    - This removes the AI chatbot functionality for agents
    - All existing chatbot data will be permanently deleted
*/

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS agent_chat_messages CASCADE;
DROP TABLE IF EXISTS agent_chat_conversations CASCADE;
