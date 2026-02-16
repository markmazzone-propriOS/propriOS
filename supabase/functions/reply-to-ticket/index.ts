import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GetTicketRequest {
  reply_token: string;
}

interface AddResponseRequest {
  reply_token: string;
  message: string;
  responder_name?: string;
  responder_email?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (req.method === "GET") {
      const url = new URL(req.url);
      const reply_token = url.searchParams.get('reply_token');

      if (!reply_token) {
        return new Response(
          JSON.stringify({ error: "reply_token is required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data: ticket, error: ticketError } = await supabase
        .from('support_tickets')
        .select(`
          id,
          subject,
          description,
          status,
          priority,
          category,
          created_at,
          updated_at,
          email
        `)
        .eq('reply_token', reply_token)
        .maybeSingle();

      if (ticketError || !ticket) {
        return new Response(
          JSON.stringify({ error: "Invalid reply token or ticket not found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data: responses, error: responsesError } = await supabase
        .from('support_ticket_responses')
        .select(`
          id,
          message,
          created_at,
          user_id
        `)
        .eq('ticket_id', ticket.id)
        .eq('is_internal_note', false)
        .order('created_at', { ascending: true });

      if (responsesError) {
        throw responsesError;
      }

      const responsesWithEmail = await Promise.all(
        (responses || []).map(async (response) => {
          let userEmail = 'User';
          try {
            const { data: userData } = await supabase.auth.admin.getUserById(response.user_id);
            userEmail = userData?.user?.email || 'User';
          } catch (err) {
            console.error('Error fetching user email:', err);
          }

          const { data: adminCheck } = await supabase
            .from('admin_users')
            .select('id')
            .eq('id', response.user_id)
            .maybeSingle();

          return {
            ...response,
            from: adminCheck ? 'Proprieta Support' : userEmail,
            is_admin: !!adminCheck
          };
        })
      );

      return new Response(
        JSON.stringify({
          ticket,
          responses: responsesWithEmail,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (req.method === "POST") {
      const { reply_token, message, responder_name, responder_email }: AddResponseRequest = await req.json();

      if (!reply_token || !message) {
        return new Response(
          JSON.stringify({ error: "reply_token and message are required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data: ticket, error: ticketError } = await supabase
        .from('support_tickets')
        .select('id, user_id, email')
        .eq('reply_token', reply_token)
        .maybeSingle();

      if (ticketError || !ticket) {
        return new Response(
          JSON.stringify({ error: "Invalid reply token or ticket not found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      let responseUserId = ticket.user_id;

      if (!responseUserId) {
        try {
          const { data: { users } } = await supabase.auth.admin.listUsers();
          const guestUser = users?.find(u => u.email === ticket.email);

          if (guestUser) {
            responseUserId = guestUser.id;
          } else {
            const adminUser = users?.find(u => u.email === 'mark.mazzone@proprieta.co');
            if (adminUser) {
              responseUserId = adminUser.id;
            }
          }
        } catch (err) {
          console.error('Error finding user by email:', err);
        }
      }

      const { data: response, error: responseError } = await supabase
        .from('support_ticket_responses')
        .insert({
          ticket_id: ticket.id,
          user_id: responseUserId,
          message: message.trim(),
          is_internal_note: false,
        })
        .select()
        .single();

      if (responseError) {
        throw responseError;
      }

      return new Response(
        JSON.stringify({
          success: true,
          response,
        }),
        {
          status: 201,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in reply-to-ticket:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
