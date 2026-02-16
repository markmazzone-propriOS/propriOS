import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TicketResponseNotificationRequest {
  response_id: string;
  ticket_id: string;
  message: string;
  is_internal_note: boolean;
  responder_email: string;
  created_at: string;
}

function formatTicketId(id: string): string {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log('=== Ticket Response Notification Edge Function Called ===');

    const { response_id, ticket_id, message, is_internal_note, responder_email, created_at }: TicketResponseNotificationRequest = await req.json();

    console.log('Request payload:', { response_id, ticket_id, is_internal_note, responder_email });

    if (!response_id || !ticket_id || !message || !responder_email || !created_at) {
      console.error('Missing required fields');
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (is_internal_note) {
      console.log('Skipping internal note');
      return new Response(
        JSON.stringify({ success: true, message: "Internal notes are not sent to users" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select(`
        id,
        subject,
        user_id,
        email,
        reply_token
      `)
      .eq('id', ticket_id)
      .maybeSingle();

    if (ticketError || !ticket) {
      throw new Error('Failed to fetch ticket details');
    }

    // Get ticket owner email
    let ticketOwnerEmail = ticket.email; // Default to guest email
    if (ticket.user_id) {
      // Use admin API to get user email for authenticated users
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(ticket.user_id);
      if (!userError && userData?.user?.email) {
        ticketOwnerEmail = userData.user.email;
      }
    }

    // Determine recipient based on responder
    // If the responder is mark.mazzone@proprieta.co (admin), send to ticket owner
    // Otherwise, send to admin
    let recipientEmail: string;
    let isAdminResponder = false;

    if (responder_email === 'mark.mazzone@proprieta.co') {
      isAdminResponder = true;
      recipientEmail = ticketOwnerEmail;
    } else {
      isAdminResponder = false;
      recipientEmail = 'mark.mazzone@proprieta.co';
    }

    const formattedDate = new Date(created_at).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });

    const ticketIdFormatted = formatTicketId(ticket_id);
    const siteUrl = Deno.env.get('SITE_URL') || 'https://proprieta.com';

    const emailContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Response to Your Support Ticket - Proprieta</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">💬 New Response to Your Ticket</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1f2937; font-size: 22px; margin: 0 0 20px 0;">${isAdminResponder ? 'Support team has responded to your ticket' : 'User has responded to their ticket'}</h2>

              <div style="background-color: #dbeafe; border-left-width: 4px; border-left-style: solid; border-left-color: #2563eb; padding: 20px; margin: 20px 0; border-radius: 4px;">
                <p style="color: #1e40af; font-size: 14px; margin: 0; font-weight: bold;">Ticket ID: ${ticketIdFormatted}</p>
                <p style="color: #1e3a8a; font-size: 14px; margin: 8px 0 0 0; font-weight: bold;">Subject: ${ticket.subject}</p>
              </div>

              <div style="background-color: #f3f4f6; border-radius: 8px; padding: 24px; margin: 30px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                      <span style="color: #6b7280; font-size: 14px; font-weight: bold; display: block; margin-bottom: 4px;">From</span>
                      <span style="color: #1f2937; font-size: 16px;">${isAdminResponder ? 'Proprieta Support Team' : responder_email}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                      <span style="color: #6b7280; font-size: 14px; font-weight: bold; display: block; margin-bottom: 4px;">Date</span>
                      <span style="color: #1f2937; font-size: 16px;">${formattedDate}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0;">
                      <span style="color: #6b7280; font-size: 14px; font-weight: bold; display: block; margin-bottom: 8px;">Message</span>
                      <div style="color: #1f2937; font-size: 14px; line-height: 1.6; background-color: #ffffff; padding: 16px; border-radius: 6px; border: 1px solid #e5e7eb;">${message.replace(/\n/g, '<br>')}</div>
                    </td>
                  </tr>
                </table>
              </div>

              ${!isAdminResponder ? `
              <div style="text-align: center; margin: 40px 0 30px 0;">
                <a href="${siteUrl}/#/admin/support" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: bold; display: inline-block;">View Ticket & Reply</a>
              </div>
              ` : ''}

              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0; text-align: center;">
                This is an automated notification from the Proprieta support system.<br>
                Please reference Ticket ID <strong>${ticketIdFormatted}</strong> in your response.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} Proprieta. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    console.log(`=== SENDING EMAIL ===`);
    console.log(`Ticket: ${ticketIdFormatted}`);
    console.log(`Ticket Owner Email: ${ticketOwnerEmail}`);
    console.log(`Responder Email: ${responder_email}`);
    console.log(`Is Admin Responder: ${isAdminResponder}`);
    console.log(`Recipient Email: ${recipientEmail}`);

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Proprieta Support <support@proprieta.co>',
        to: [recipientEmail],
        subject: `💬 New Response: ${ticket.subject} (${ticketIdFormatted})`,
        html: emailContent,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend API error:', data);

      // Log failed attempt
      await supabase.from('email_notification_logs').insert({
        function_name: 'send-ticket-response-notification',
        recipient_email: recipientEmail,
        subject: `💬 New Response: ${ticket.subject} (${ticketIdFormatted})`,
        status: 'error',
        resend_response: data,
        error_message: data.message || 'Failed to send email via Resend'
      });

      throw new Error(data.message || 'Failed to send email via Resend');
    }

    console.log('Ticket response notification sent successfully via Resend:', data);

    // Log successful attempt
    await supabase.from('email_notification_logs').insert({
      function_name: 'send-ticket-response-notification',
      recipient_email: recipientEmail,
      subject: `💬 New Response: ${ticket.subject} (${ticketIdFormatted})`,
      status: 'success',
      resend_response: data
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Ticket response notification sent successfully",
        emailId: data.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error sending ticket response notification:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send ticket response notification", details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
