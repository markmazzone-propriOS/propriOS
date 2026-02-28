import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface UserContext {
  userType: string;
  profile: any;
  properties?: any[];
  offers?: any[];
  conversations?: any[];
  appointments?: any[];
  clients?: any[];
  prospects?: any[];
  team?: any;
  brokerage?: any;
  analytics?: any;
  lenderProfile?: any;
  loanApplications?: any[];
  serviceProviderProfile?: any;
  jobs?: any[];
  propertyOwnerProfile?: any;
  tenants?: any[];
}

async function getUserContext(supabase: any, userId: string): Promise<UserContext> {
  const context: UserContext = {
    userType: 'unknown',
    profile: null
  };

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (!profile) return context;

  context.profile = profile;
  context.userType = profile.user_type;

  if (profile.user_type === 'agent') {
    const [properties, clients, prospects, offers, team, brokerage] = await Promise.all([
      supabase.from('properties').select('*').eq('agent_id', userId),
      supabase.from('profiles').select('id, full_name, email, user_type').eq('agent_id', userId),
      supabase.from('prospects').select('*').eq('agent_id', userId).order('created_at', { ascending: false }).limit(10),
      supabase.from('offers').select('*, properties(address, price)').eq('agent_id', userId).order('created_at', { ascending: false }).limit(10),
      supabase.from('team_members').select('*, teams(*)').eq('user_id', userId).maybeSingle(),
      supabase.from('brokerage_agents').select('*, brokerages(*)').eq('agent_id', userId).maybeSingle()
    ]);

    context.properties = properties.data || [];
    context.clients = clients.data || [];
    context.prospects = prospects.data || [];
    context.offers = offers.data || [];
    context.team = team.data;
    context.brokerage = brokerage.data;
  }

  if (profile.user_type === 'buyer') {
    const [favorites, offers, appointments, journey, preApprovals] = await Promise.all([
      supabase.from('favorites').select('*, properties(*)').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
      supabase.from('offers').select('*, properties(address, price)').eq('buyer_id', userId).order('created_at', { ascending: false }),
      supabase.from('calendar_events').select('*').eq('user_id', userId).gte('event_date', new Date().toISOString()).order('event_date', { ascending: true }).limit(5),
      supabase.from('buyer_journey').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('pre_approval_requests').select('*').eq('buyer_id', userId).order('created_at', { ascending: false })
    ]);

    context.properties = favorites.data || [];
    context.offers = offers.data || [];
    context.appointments = appointments.data || [];
    context.analytics = { journey: journey.data, preApprovals: preApprovals.data };
  }

  if (profile.user_type === 'seller') {
    const [properties, offers, appointments, journey] = await Promise.all([
      supabase.from('properties').select('*').eq('seller_id', userId),
      supabase.from('offers').select('*, properties(address, price), profiles!offers_buyer_id_fkey(full_name)').in('property_id',
        (await supabase.from('properties').select('id').eq('seller_id', userId)).data?.map((p: any) => p.id) || []
      ),
      supabase.from('calendar_events').select('*').eq('user_id', userId).gte('event_date', new Date().toISOString()).order('event_date', { ascending: true }).limit(5),
      supabase.from('seller_journey').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(5)
    ]);

    context.properties = properties.data || [];
    context.offers = offers.data || [];
    context.appointments = appointments.data || [];
    context.analytics = { journey: journey.data };
  }

  if (profile.user_type === 'service_provider') {
    const [serviceProfile, jobs, leads, appointments] = await Promise.all([
      supabase.from('service_provider_profiles').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('service_provider_jobs').select('*, properties(address)').eq('service_provider_id', userId).order('created_at', { ascending: false }).limit(10),
      supabase.from('service_provider_leads').select('*').eq('service_provider_id', userId).order('created_at', { ascending: false }).limit(10),
      supabase.from('service_provider_appointments').select('*').eq('service_provider_id', userId).gte('scheduled_date', new Date().toISOString()).order('scheduled_date', { ascending: true }).limit(5)
    ]);

    context.serviceProviderProfile = serviceProfile.data;
    context.jobs = jobs.data || [];
    context.prospects = leads.data || [];
    context.appointments = appointments.data || [];
  }

  if (profile.user_type === 'lender') {
    const [lenderProfile, preApprovals, loanApps, leads] = await Promise.all([
      supabase.from('mortgage_lender_profiles').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('pre_approval_requests').select('*, profiles(full_name, email)').eq('lender_id', userId).order('created_at', { ascending: false }).limit(10),
      supabase.from('loan_applications').select('*, profiles(full_name, email)').eq('lender_id', userId).order('created_at', { ascending: false }).limit(10),
      supabase.from('lender_leads').select('*').eq('lender_id', userId).order('created_at', { ascending: false }).limit(10)
    ]);

    context.lenderProfile = lenderProfile.data;
    context.loanApplications = loanApps.data || [];
    context.offers = preApprovals.data || [];
    context.prospects = leads.data || [];
  }

  if (profile.user_type === 'property_owner') {
    const [ownerProfile, properties, tenants, applications, leads] = await Promise.all([
      supabase.from('property_owner_profiles').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('properties').select('*').eq('property_owner_id', userId),
      supabase.from('active_tenants').select('*, properties(address)').eq('property_owner_id', userId),
      supabase.from('rental_applications').select('*, properties(address), profiles(full_name, email)').eq('property_owner_id', userId).order('created_at', { ascending: false }).limit(10),
      supabase.from('property_owner_leads').select('*').eq('property_owner_id', userId).order('created_at', { ascending: false }).limit(10)
    ]);

    context.propertyOwnerProfile = ownerProfile.data;
    context.properties = properties.data || [];
    context.tenants = tenants.data || [];
    context.offers = applications.data || [];
    context.prospects = leads.data || [];
  }

  if (profile.user_type === 'renter') {
    const [favorites, applications, appointments, journey] = await Promise.all([
      supabase.from('favorites').select('*, properties(*)').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
      supabase.from('rental_applications').select('*, properties(address)').eq('renter_id', userId).order('created_at', { ascending: false }),
      supabase.from('calendar_events').select('*').eq('user_id', userId).gte('event_date', new Date().toISOString()).order('event_date', { ascending: true }).limit(5),
      supabase.from('renter_journey').select('*').eq('user_id', userId).maybeSingle()
    ]);

    context.properties = favorites.data || [];
    context.offers = applications.data || [];
    context.appointments = appointments.data || [];
    context.analytics = { journey: journey.data };
  }

  if (profile.user_type === 'brokerage') {
    const [brokerageData, agents, properties] = await Promise.all([
      supabase.from('brokerages').select('*').eq('owner_id', userId).maybeSingle(),
      supabase.from('brokerage_agents').select('*, profiles(full_name, email)').eq('brokerage_id',
        (await supabase.from('brokerages').select('id').eq('owner_id', userId).maybeSingle()).data?.id
      ),
      supabase.from('properties').select('*').eq('brokerage_id',
        (await supabase.from('brokerages').select('id').eq('owner_id', userId).maybeSingle()).data?.id
      )
    ]);

    context.brokerage = brokerageData.data;
    context.clients = agents.data || [];
    context.properties = properties.data || [];
  }

  return context;
}

function buildSystemPrompt(context: UserContext): string {
  let prompt = `You are a helpful AI assistant for a real estate platform. You help users understand their account data and answer questions specific to their role.

User Type: ${context.userType}
User Name: ${context.profile?.full_name || 'User'}

`;

  if (context.userType === 'agent') {
    prompt += `This user is a Real Estate Agent. You have access to:
- ${context.properties?.length || 0} active listings
- ${context.clients?.length || 0} clients (buyers/sellers assigned to them)
- ${context.prospects?.length || 0} prospects in their CRM
- ${context.offers?.length || 0} recent offers
- Team: ${context.team ? context.team.teams?.name : 'Not part of a team'}
- Brokerage: ${context.brokerage ? context.brokerage.brokerages?.name : 'Independent'}

You can answer questions about their listings, clients, upcoming appointments, offers, prospects, and business analytics.`;
  }

  if (context.userType === 'buyer') {
    prompt += `This user is a Property Buyer. You have access to:
- ${context.properties?.length || 0} favorited properties
- ${context.offers?.length || 0} offers submitted
- ${context.appointments?.length || 0} upcoming property viewings
- Journey stage: ${context.analytics?.journey?.current_stage || 'Getting Started'}
- Pre-approval status: ${context.analytics?.preApprovals?.[0]?.status || 'Not started'}

You can answer questions about their favorite properties, scheduled viewings, offer status, and buying progress.`;
  }

  if (context.userType === 'seller') {
    prompt += `This user is a Property Seller. You have access to:
- ${context.properties?.length || 0} properties listed for sale
- ${context.offers?.length || 0} offers received
- ${context.appointments?.length || 0} upcoming showings
- Selling journey stages for their properties

You can answer questions about their listings, offers received, scheduled viewings, and selling progress.`;
  }

  if (context.userType === 'service_provider') {
    prompt += `This user is a Service Provider (${context.serviceProviderProfile?.service_category || 'General'}). You have access to:
- ${context.jobs?.length || 0} jobs (completed and in progress)
- ${context.prospects?.length || 0} leads
- ${context.appointments?.length || 0} upcoming appointments
- Business: ${context.serviceProviderProfile?.business_name || 'Not set'}

You can answer questions about their jobs, appointments, leads, and business performance.`;
  }

  if (context.userType === 'lender') {
    prompt += `This user is a Mortgage Lender. You have access to:
- ${context.loanApplications?.length || 0} loan applications
- ${context.offers?.length || 0} pre-approval requests
- ${context.prospects?.length || 0} leads
- Company: ${context.lenderProfile?.company_name || 'Not set'}

You can answer questions about loan applications, pre-approvals, leads, and lending business.`;
  }

  if (context.userType === 'property_owner') {
    prompt += `This user is a Property Owner/Landlord. You have access to:
- ${context.properties?.length || 0} rental properties
- ${context.tenants?.length || 0} active tenants
- ${context.offers?.length || 0} rental applications
- ${context.prospects?.length || 0} leads

You can answer questions about their rental properties, tenants, applications, and rental income.`;
  }

  if (context.userType === 'renter') {
    prompt += `This user is a Renter. You have access to:
- ${context.properties?.length || 0} favorited rental properties
- ${context.offers?.length || 0} rental applications submitted
- ${context.appointments?.length || 0} upcoming property viewings
- Journey stage: ${context.analytics?.journey?.current_stage || 'Searching'}

You can answer questions about rental searches, applications, and viewing schedules.`;
  }

  if (context.userType === 'brokerage') {
    prompt += `This user is a Brokerage Owner. You have access to:
- Brokerage: ${context.brokerage?.name || 'Not set'}
- ${context.clients?.length || 0} agents in the brokerage
- ${context.properties?.length || 0} total listings

You can answer questions about brokerage performance, agents, and listings.`;
  }

  prompt += `\n\nProvide helpful, concise answers based on the user's data. If asked about specific numbers or details, reference the actual data. Be conversational and friendly. If you don't have certain information, politely explain what data you can see.`;

  return prompt;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");

    console.log('Request headers:', {
      authorization: req.headers.get("Authorization") ? 'present' : 'missing',
      apikey: req.headers.get("apikey") ? 'present' : 'missing',
      contentType: req.headers.get("Content-Type")
    });

    console.log('Environment check:', {
      hasKey: !!anthropicApiKey,
      keyLength: anthropicApiKey?.length || 0,
      keyPrefix: anthropicApiKey?.substring(0, 10)
    });

    if (!anthropicApiKey || anthropicApiKey.trim() === '') {
      console.error('Anthropic API key is missing or empty');
      return new Response(
        JSON.stringify({
          error: "AI service not configured. The Anthropic API key is missing.",
          needsSetup: true
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { message, conversationId } = await req.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const context = await getUserContext(supabase, user.id);

    let conversation;
    if (conversationId) {
      const { data } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .maybeSingle();
      conversation = data;
    }

    if (!conversation) {
      const { data } = await supabase
        .from('ai_conversations')
        .insert({
          user_id: user.id,
          title: message.substring(0, 50) + (message.length > 50 ? '...' : '')
        })
        .select()
        .single();
      conversation = data;
    }

    const { data: previousMessages } = await supabase
      .from('ai_messages')
      .select('role, content')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })
      .limit(10);

    await supabase.from('ai_messages').insert({
      conversation_id: conversation.id,
      role: 'user',
      content: message
    });

    const messages = [
      ...(previousMessages || []).map((m: any) => ({
        role: m.role,
        content: m.content
      })),
      { role: 'user', content: message }
    ];

    console.log('Sending request to Anthropic API...');
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1024,
        system: buildSystemPrompt(context),
        messages: messages
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', response.status, errorText);
      let errorMessage = "AI service error";
      let needsSetup = false;

      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorMessage;

        if (response.status === 401 || response.status === 403 || errorMessage.toLowerCase().includes('api key') || errorMessage.toLowerCase().includes('authentication')) {
          needsSetup = true;
          errorMessage = "Invalid or expired Anthropic API key";
        }
      } catch (e) {
        errorMessage = errorText;
      }

      return new Response(
        JSON.stringify({ error: errorMessage, needsSetup }),
        {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const aiResponse = await response.json();
    const assistantMessage = aiResponse.content[0].text;

    await supabase.from('ai_messages').insert({
      conversation_id: conversation.id,
      role: 'assistant',
      content: assistantMessage,
      context_used: {
        userType: context.userType,
        dataPoints: {
          properties: context.properties?.length || 0,
          offers: context.offers?.length || 0,
          appointments: context.appointments?.length || 0,
          clients: context.clients?.length || 0,
          prospects: context.prospects?.length || 0
        }
      }
    });

    return new Response(
      JSON.stringify({
        message: assistantMessage,
        conversationId: conversation.id,
        context: {
          userType: context.userType
        }
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
