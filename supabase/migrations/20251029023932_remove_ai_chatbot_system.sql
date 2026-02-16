/*
  # Remove AI Chatbot System

  1. Changes
    - Drop chat_conversations table
    - Drop chat_messages table
    - Remove all chatbot-related functionality

  2. Tables Removed
    - `chat_conversations` - Stored user chat conversation sessions
    - `chat_messages` - Stored individual messages in conversations
*/

-- Drop tables if they exist
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_conversations CASCADE;