import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ChatRequest {
  conversationId: string;
  message: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { conversationId, message }: ChatRequest = await req.json();

    // Store user message
    await supabase.from('agent_chat_messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: message,
    });

    // Process the query and generate response
    const response = await processAgentQuery(supabase, user.id, message);

    // Store assistant response
    await supabase.from('agent_chat_messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: response,
    });

    // Update conversation timestamp
    await supabase
      .from('agent_chat_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return new Response(
      JSON.stringify({ response }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error processing chat:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});

async function processAgentQuery(supabase: any, agentId: string, query: string): Promise<string> {
  const lowerQuery = query.toLowerCase();

  // Handle greetings
  if (lowerQuery.match(/^(hi|hello|hey|greetings)/)) {
    return "Hello! I'm your personal assistant. I can help you with information about your listings, clients, appointments, and more. What would you like to know?";
  }

  // Handle property/listing queries
  if (lowerQuery.includes('listing') || lowerQuery.includes('propert')) {
    return await getListingsInfo(supabase, agentId, lowerQuery);
  }

  // Handle client queries
  if (lowerQuery.includes('client') || lowerQuery.includes('buyer') || lowerQuery.includes('seller')) {
    return await getClientsInfo(supabase, agentId, lowerQuery);
  }

  // Handle appointment queries
  if (lowerQuery.includes('appointment') || lowerQuery.includes('viewing') || lowerQuery.includes('schedule')) {
    return await getAppointmentsInfo(supabase, agentId, lowerQuery);
  }

  // Handle offer queries
  if (lowerQuery.includes('offer')) {
    return await getOffersInfo(supabase, agentId, lowerQuery);
  }

  // Handle prospect/lead queries
  if (lowerQuery.includes('prospect') || lowerQuery.includes('lead')) {
    return await getProspectsInfo(supabase, agentId, lowerQuery);
  }

  // Handle activity queries
  if (lowerQuery.includes('activity') || lowerQuery.includes('recent')) {
    return await getActivityInfo(supabase, agentId, lowerQuery);
  }

  // Handle reminder queries
  if (lowerQuery.includes('reminder')) {
    return await getRemindersInfo(supabase, agentId, lowerQuery);
  }

  // Handle message queries
  if (lowerQuery.includes('message') || lowerQuery.includes('unread')) {
    return await getMessagesInfo(supabase, agentId, lowerQuery);
  }

  // Handle document queries
  if (lowerQuery.includes('document') || lowerQuery.includes('signature')) {
    return await getDocumentsInfo(supabase, agentId, lowerQuery);
  }

  // Handle analytics/revenue queries
  if (lowerQuery.includes('revenue') || lowerQuery.includes('commission') ||
      lowerQuery.includes('analytics') || lowerQuery.includes('performance') ||
      lowerQuery.includes('earned') || lowerQuery.includes('made') ||
      lowerQuery.includes('pipeline') || lowerQuery.includes('deals')) {
    return await getAnalyticsInfo(supabase, agentId, lowerQuery);
  }

  // Default response with suggestions
  return "I can help you with:\n\n" +
    "• Listings and properties\n" +
    "• Clients (buyers and sellers)\n" +
    "• Appointments and viewings\n" +
    "• Offers and transactions\n" +
    "• Prospects and leads\n" +
    "• Recent activity\n" +
    "• Reminders and tasks\n" +
    "• Messages\n" +
    "• Documents and signatures\n" +
    "• Revenue and analytics\n\n" +
    "What would you like to know about?";
}

async function getListingsInfo(supabase: any, agentId: string, query: string): Promise<string> {
  const { data: properties, error } = await supabase
    .from('properties')
    .select('id, address_line1, city, state, price, status, listing_type, bedrooms, bathrooms')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error || !properties || properties.length === 0) {
    return "You don't have any listings at the moment.";
  }

  const formatAddress = (p: any) => {
    return `${p.address_line1}, ${p.city}, ${p.state}`;
  };

  if (query.includes('how many') && query.includes('active')) {
    const activeCount = properties.filter((p: any) => p.status === 'active').length;
    return `You have ${activeCount} active listing${activeCount !== 1 ? 's' : ''}.`;
  }

  if (query.includes('how many') && query.includes('pending')) {
    const pendingCount = properties.filter((p: any) => p.status === 'pending').length;
    return `You have ${pendingCount} pending listing${pendingCount !== 1 ? 's' : ''}.`;
  }

  if (query.includes('how many') && query.includes('sold')) {
    const soldCount = properties.filter((p: any) => p.status === 'sold').length;
    return `You have ${soldCount} sold listing${soldCount !== 1 ? 's' : ''}.`;
  }

  if (query.includes('how many')) {
    const activeCount = properties.filter((p: any) => p.status === 'active').length;
    const pendingCount = properties.filter((p: any) => p.status === 'pending').length;
    const soldCount = properties.filter((p: any) => p.status === 'sold').length;

    return `You have ${properties.length} total listings:\n` +
      `• ${activeCount} active\n` +
      `• ${pendingCount} pending\n` +
      `• ${soldCount} sold`;
  }

  if (query.includes('active')) {
    const active = properties.filter((p: any) => p.status === 'active');
    if (active.length === 0) return "You don't have any active listings.";

    return `You have ${active.length} active listing(s):\n\n` +
      active.map((p: any) =>
        `• ${formatAddress(p)} - $${p.price?.toLocaleString()} (${p.bedrooms}bd/${p.bathrooms}ba)`
      ).join('\n');
  }

  return `You have ${properties.length} listings. Here are your most recent:\n\n` +
    properties.slice(0, 5).map((p: any) =>
      `• ${formatAddress(p)} - $${p.price?.toLocaleString()} - ${p.status}`
    ).join('\n');
}

async function getClientsInfo(supabase: any, agentId: string, query: string): Promise<string> {
  const { data: clients, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, user_type')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false });

  if (error || !clients || clients.length === 0) {
    return "You don't have any assigned clients yet.";
  }

  const buyers = clients.filter((c: any) => c.user_type === 'buyer');
  const sellers = clients.filter((c: any) => c.user_type === 'seller');

  if (query.includes('how many') || query.includes('count')) {
    return `You have ${clients.length} total clients:\n` +
      `• ${buyers.length} buyers\n` +
      `• ${sellers.length} sellers`;
  }

  if (query.includes('buyer')) {
    if (buyers.length === 0) return "You don't have any buyers assigned.";
    return `You have ${buyers.length} buyer(s):\n\n` +
      buyers.slice(0, 5).map((c: any) => `• ${c.full_name} (${c.email})`).join('\n');
  }

  if (query.includes('seller')) {
    if (sellers.length === 0) return "You don't have any sellers assigned.";
    return `You have ${sellers.length} seller(s):\n\n` +
      sellers.slice(0, 5).map((c: any) => `• ${c.full_name} (${c.email})`).join('\n');
  }

  return `You have ${clients.length} clients (${buyers.length} buyers, ${sellers.length} sellers).`;
}

async function getAppointmentsInfo(supabase: any, agentId: string, query: string): Promise<string> {
  const now = new Date().toISOString();

  const { data: events, error } = await supabase
    .from('calendar_events')
    .select('id, title, start_time, end_time, event_type, status')
    .eq('agent_id', agentId)
    .gte('start_time', now)
    .order('start_time', { ascending: true })
    .limit(10);

  if (error || !events || events.length === 0) {
    return "You don't have any upcoming appointments.";
  }

  if (query.includes('today')) {
    const today = new Date();
    const todayEvents = events.filter((e: any) => {
      const eventDate = new Date(e.start_time);
      return eventDate.toDateString() === today.toDateString();
    });

    if (todayEvents.length === 0) return "You don't have any appointments today.";

    return `You have ${todayEvents.length} appointment(s) today:\n\n` +
      todayEvents.map((e: any) => {
        const time = new Date(e.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `• ${time} - ${e.title}`;
      }).join('\n');
  }

  return `You have ${events.length} upcoming appointment(s):\n\n` +
    events.slice(0, 5).map((e: any) => {
      const date = new Date(e.start_time).toLocaleDateString();
      const time = new Date(e.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `• ${date} ${time} - ${e.title}`;
    }).join('\n');
}

async function getOffersInfo(supabase: any, agentId: string, query: string): Promise<string> {
  const { data: properties } = await supabase
    .from('properties')
    .select('id')
    .eq('agent_id', agentId);

  if (!properties || properties.length === 0) {
    return "You don't have any properties with offers.";
  }

  const propertyIds = properties.map((p: any) => p.id);

  const { data: offers, error } = await supabase
    .from('offers')
    .select('id, property_id, offer_amount, status, created_at, properties(address_line1, city, state)')
    .in('property_id', propertyIds)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error || !offers || offers.length === 0) {
    return "You don't have any offers on your listings.";
  }

  const formatAddress = (p: any) => {
    if (!p) return 'Unknown property';
    return `${p.address_line1}, ${p.city}, ${p.state}`;
  };

  const pendingOffers = offers.filter((o: any) => o.status === 'pending');
  const acceptedOffers = offers.filter((o: any) => o.status === 'accepted');

  if (query.includes('pending')) {
    if (pendingOffers.length === 0) return "You don't have any pending offers.";
    return `You have ${pendingOffers.length} pending offer(s):\n\n` +
      pendingOffers.slice(0, 5).map((o: any) =>
        `• ${formatAddress(o.properties)} - $${o.offer_amount?.toLocaleString()}`
      ).join('\n');
  }

  return `You have ${offers.length} total offers:\n` +
    `• ${pendingOffers.length} pending\n` +
    `• ${acceptedOffers.length} accepted\n\n` +
    `Recent offers:\n` +
    offers.slice(0, 3).map((o: any) =>
      `• ${formatAddress(o.properties)} - $${o.offer_amount?.toLocaleString()} (${o.status})`
    ).join('\n');
}

async function getProspectsInfo(supabase: any, agentId: string, query: string): Promise<string> {
  const { data: prospects, error } = await supabase
    .from('prospects')
    .select('id, name, email, phone, status, source, created_at')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error || !prospects || prospects.length === 0) {
    return "You don't have any prospects in your CRM.";
  }

  const newProspects = prospects.filter((p: any) => p.status === 'new');
  const contacted = prospects.filter((p: any) => p.status === 'contacted');

  if (query.includes('new')) {
    if (newProspects.length === 0) return "You don't have any new prospects.";
    return `You have ${newProspects.length} new prospect(s):\n\n` +
      newProspects.slice(0, 5).map((p: any) => `• ${p.name} (${p.email})`).join('\n');
  }

  return `You have ${prospects.length} prospects:\n` +
    `• ${newProspects.length} new\n` +
    `• ${contacted.length} contacted\n\n` +
    `Recent prospects:\n` +
    prospects.slice(0, 3).map((p: any) =>
      `• ${p.name} - ${p.status} (${p.source || 'unknown source'})`
    ).join('\n');
}

async function getActivityInfo(supabase: any, agentId: string, query: string): Promise<string> {
  const { data: activities, error } = await supabase
    .from('activity_feed')
    .select('id, activity_type, description, created_at')
    .eq('user_id', agentId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error || !activities || activities.length === 0) {
    return "You don't have any recent activity.";
  }

  return `Your recent activity:\n\n` +
    activities.map((a: any) => {
      const date = new Date(a.created_at).toLocaleDateString();
      return `• ${date} - ${a.description}`;
    }).join('\n');
}

async function getRemindersInfo(supabase: any, agentId: string, query: string): Promise<string> {
  const now = new Date().toISOString();

  const { data: reminders, error } = await supabase
    .from('prospect_reminders')
    .select('id, prospect_id, reminder_date, reminder_type, notes, completed, prospects(name)')
    .eq('agent_id', agentId)
    .eq('completed', false)
    .gte('reminder_date', now)
    .order('reminder_date', { ascending: true })
    .limit(10);

  if (error || !reminders || reminders.length === 0) {
    return "You don't have any upcoming reminders.";
  }

  if (query.includes('today')) {
    const today = new Date();
    const todayReminders = reminders.filter((r: any) => {
      const reminderDate = new Date(r.reminder_date);
      return reminderDate.toDateString() === today.toDateString();
    });

    if (todayReminders.length === 0) return "You don't have any reminders for today.";

    return `You have ${todayReminders.length} reminder(s) for today:\n\n` +
      todayReminders.map((r: any) => {
        const time = new Date(r.reminder_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const prospectName = r.prospects?.name || 'Unknown prospect';
        return `• ${time} - ${r.reminder_type} - ${prospectName}${r.notes ? ': ' + r.notes : ''}`;
      }).join('\n');
  }

  return `You have ${reminders.length} upcoming reminder(s):\n\n` +
    reminders.slice(0, 5).map((r: any) => {
      const date = new Date(r.reminder_date).toLocaleDateString();
      const time = new Date(r.reminder_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const prospectName = r.prospects?.name || 'Unknown prospect';
      return `• ${date} ${time} - ${r.reminder_type} - ${prospectName}`;
    }).join('\n');
}

async function getMessagesInfo(supabase: any, agentId: string, query: string): Promise<string> {
  const { data: conversations, error } = await supabase
    .from('conversation_participants')
    .select(`
      conversation_id,
      conversations (
        id,
        last_message_at,
        messages (
          id,
          content,
          sender_id,
          is_read,
          created_at
        )
      )
    `)
    .eq('user_id', agentId)
    .order('created_at', { ascending: false });

  if (error || !conversations || conversations.length === 0) {
    return "You don't have any messages.";
  }

  let unreadCount = 0;
  for (const conv of conversations) {
    const messages = conv.conversations?.messages || [];
    const unread = messages.filter((m: any) => !m.is_read && m.sender_id !== agentId);
    unreadCount += unread.length;
  }

  if (query.includes('unread')) {
    if (unreadCount === 0) return "You don't have any unread messages.";
    return `You have ${unreadCount} unread message${unreadCount !== 1 ? 's' : ''}.`;
  }

  return `You have ${conversations.length} conversation(s) with ${unreadCount} unread message${unreadCount !== 1 ? 's' : ''}.`;
}

async function getDocumentsInfo(supabase: any, agentId: string, query: string): Promise<string> {
  if (query.includes('signature') || query.includes('pending')) {
    const { data: signatures, error } = await supabase
      .from('document_signatures')
      .select('id, document_id, status, documents(file_name)')
      .eq('sender_id', agentId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error || !signatures || signatures.length === 0) {
      return "You don't have any pending signature requests.";
    }

    return `You have ${signatures.length} pending signature request(s):\n\n` +
      signatures.slice(0, 5).map((s: any) =>
        `• ${s.documents?.file_name || 'Document'}`
      ).join('\n');
  }

  const { data: documents, error } = await supabase
    .from('documents')
    .select('id, file_name, document_type, created_at')
    .eq('uploaded_by', agentId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error || !documents || documents.length === 0) {
    return "You don't have any documents.";
  }

  return `You have ${documents.length} recent document(s):\n\n` +
    documents.map((d: any) => {
      const date = new Date(d.created_at).toLocaleDateString();
      return `• ${d.file_name} (${d.document_type}) - ${date}`;
    }).join('\n');
}

async function getAnalyticsInfo(supabase: any, agentId: string, query: string): Promise<string> {
  // Load closed/won transactions for revenue
  const { data: wonTransactions, error: wonError } = await supabase
    .from('transactions')
    .select('deal_value, commission_amount, actual_close_date, stage')
    .eq('agent_id', agentId)
    .eq('status', 'won');

  // Load active transactions for pipeline
  const { data: activeTransactions, error: activeError } = await supabase
    .from('transactions')
    .select('deal_value, commission_amount, stage')
    .eq('agent_id', agentId)
    .eq('status', 'active');

  // Load properties for additional metrics
  const { data: properties } = await supabase
    .from('properties')
    .select('status, price')
    .or(`agent_id.eq.${agentId},listed_by.eq.${agentId}`);

  const closedDeals = wonTransactions || [];
  const activeDeals = activeTransactions || [];
  const allProperties = properties || [];

  // Calculate total revenue
  const totalRevenue = closedDeals.reduce((sum, t) => sum + (t.commission_amount || 0), 0);
  const totalPipelineValue = activeDeals.reduce((sum, t) => sum + (t.deal_value || 0), 0);
  const totalPipelineCommission = activeDeals.reduce((sum, t) => sum + (t.commission_amount || 0), 0);

  // Count properties
  const activeListings = allProperties.filter(p => p.status === 'active').length;
  const soldListings = allProperties.filter(p => p.status === 'sold').length;

  // Handle revenue queries
  if (query.includes('revenue') || query.includes('earned') || query.includes('made') || query.includes('commission')) {
    if (totalRevenue === 0) {
      return "You haven't earned any commission yet. Keep working on those deals!";
    }

    const averageCommission = closedDeals.length > 0 ? totalRevenue / closedDeals.length : 0;

    return `Your total commission earnings: $${totalRevenue.toLocaleString()}\n\n` +
      `• Closed deals: ${closedDeals.length}\n` +
      `• Average commission per deal: $${averageCommission.toLocaleString()}\n` +
      `• Pipeline commission (potential): $${totalPipelineCommission.toLocaleString()}`;
  }

  // Handle pipeline queries
  if (query.includes('pipeline')) {
    if (activeDeals.length === 0) {
      return "You don't have any active deals in your pipeline.";
    }

    return `Your pipeline overview:\n\n` +
      `• Active deals: ${activeDeals.length}\n` +
      `• Total pipeline value: $${totalPipelineValue.toLocaleString()}\n` +
      `• Potential commission: $${totalPipelineCommission.toLocaleString()}`;
  }

  // Handle deal queries
  if (query.includes('deal')) {
    return `Your deals summary:\n\n` +
      `• Active deals: ${activeDeals.length}\n` +
      `• Closed deals: ${closedDeals.length}\n` +
      `• Total revenue: $${totalRevenue.toLocaleString()}\n` +
      `• Pipeline value: $${totalPipelineValue.toLocaleString()}`;
  }

  // General analytics response
  return `Your performance summary:\n\n` +
    `Revenue:\n` +
    `• Total commission: $${totalRevenue.toLocaleString()}\n` +
    `• Pipeline commission: $${totalPipelineCommission.toLocaleString()}\n\n` +
    `Deals:\n` +
    `• Active: ${activeDeals.length}\n` +
    `• Closed: ${closedDeals.length}\n\n` +
    `Listings:\n` +
    `• Active: ${activeListings}\n` +
    `• Sold: ${soldListings}`;
}