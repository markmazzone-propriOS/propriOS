# AI Assistant for Real Estate Agents

## Overview
An AI-powered assistant specifically designed for real estate agents to help them manage their business, answer questions about their account, and provide insights based on their actual data.

## Features

### Agent-Only Access
- The AI assistant is **exclusively available to agent accounts**
- Other user types (buyers, sellers, renters, etc.) will not see the AI assistant
- Access is restricted at both the frontend (component visibility) and backend (API validation)

### Data Access
The AI assistant has access to comprehensive agent information:

#### Agent Profile
- License number
- Specialization
- Years of experience
- Service areas
- Bio/description

#### Listings & Properties
- All active property listings
- Property addresses, prices, and status
- Property details (bedrooms, bathrooms, square footage, etc.)

#### Clients
- All assigned buyers and sellers
- Client names, email, phone numbers
- Client user types and assignment dates

#### Prospects (CRM)
- Up to 20 recent prospects
- Contact information
- Status and notes

#### Offers
- Up to 20 recent offers on properties
- Offer amounts and status
- Associated property information

#### Appointments
- Next 10 upcoming appointments
- Event titles, dates, and times
- Calendar details

#### Recent Activity
- Last 15 activities from the activity feed
- Activity types and descriptions

#### Documents
- Up to 10 most recent documents
- File names and types

#### Team & Brokerage
- Team membership information
- Brokerage affiliation

## How to Use

### For Agents
1. **Access**: Click the floating AI assistant button (sparkles icon) in the bottom-right corner
2. **Ask Questions**: Type questions about your business, such as:
   - "How many active listings do I have?"
   - "What appointments do I have this week?"
   - "Show me my recent offers"
   - "Who are my newest clients?"
   - "What's the status of my prospects?"
   - "How many documents do I have on file?"

3. **Conversations**: The assistant maintains conversation history
   - Previous conversations are saved and can be revisited
   - Start new conversations at any time
   - Delete old conversations when no longer needed

### Example Questions
- "How many properties am I listing?"
- "What's my next appointment?"
- "Tell me about my recent client activity"
- "Which properties have received offers?"
- "Show me my top prospects"
- "Am I part of a team or brokerage?"

## Technical Implementation

### Database Tables
- `ai_conversations` - Stores conversation sessions
- `ai_messages` - Stores individual messages within conversations

### Edge Function
- **Endpoint**: `/functions/v1/ai-agent-chat`
- **Authentication**: Requires valid user session token
- **Access Control**: Restricted to agent user types only
- **AI Model**: Claude 3 Haiku (via Anthropic API)

### Frontend Component
- **Location**: `src/components/AI/AIAssistant.tsx`
- **Visibility**: Only renders for authenticated agents
- **Features**:
  - Floating chat interface
  - Conversation management
  - Message history
  - Real-time responses

### Security
- Row Level Security (RLS) enabled on all AI tables
- Users can only access their own conversations
- Agent-only validation at API level
- All data queries respect existing RLS policies

## API Key Configuration
The AI assistant requires the `ANTHROPIC_API_KEY` environment variable to be set. This is automatically configured in the Supabase environment.

## Future Enhancements
Potential improvements for future versions:
- Voice input/output
- Suggested questions based on context
- Proactive insights and recommendations
- Integration with calendar for scheduling
- Automated follow-up reminders
- Multi-language support
