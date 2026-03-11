/*
  # Remove AI Assistant System

  1. Changes
    - Drop ai_messages table
    - Drop ai_conversations table
    
  2. Notes
    - This removes all AI assistant functionality from the platform
    - All conversation history will be permanently deleted
*/

DROP TABLE IF EXISTS ai_messages CASCADE;
DROP TABLE IF EXISTS ai_conversations CASCADE;