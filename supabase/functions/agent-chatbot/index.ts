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

  // Default response with suggestions
  return "I can help you with:\n\n" +
    "• Listings and properties\n" +
    "• Clients (buyers and sellers)\n" +
    "• Appointments and viewings\n" +
    "• Offers and transactions\n" +
    "• Prospects and leads\n" +
    "• Recent activity\n\n" +
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