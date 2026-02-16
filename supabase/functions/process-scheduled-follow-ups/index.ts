import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      console.error("Resend API key not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date().toISOString();

    const { data: scheduledFollowUps, error: fetchError } = await supabase
      .from('scheduled_follow_ups')
      .select(`
        id,
        prospect_id,
        template_id,
        scheduled_for,
        follow_up_templates (
          id,
          subject,
          message,
          campaign_id,
          follow_up_campaigns (
            id,
            agent_id
          )
        ),
        prospects (
          id,
          full_name,
          email,
          agent_id
        )
      `)
      .eq('status', 'scheduled')
      .lte('scheduled_for', now)
      .limit(50);

    if (fetchError) {
      console.error('Error fetching scheduled follow-ups:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${scheduledFollowUps?.length || 0} follow-ups to send`);

    let sentCount = 0;
    let failedCount = 0;

    for (const followUp of scheduledFollowUps || []) {
      try {
        const template = followUp.follow_up_templates;
        const prospect = followUp.prospects;
        const agentId = template?.follow_up_campaigns?.agent_id;

        if (!template || !prospect || !agentId) {
          console.error('Missing data for follow-up:', followUp.id);
          await supabase
            .from('scheduled_follow_ups')
            .update({
              status: 'failed',
              error_message: 'Missing required data'
            })
            .eq('id', followUp.id);
          failedCount++;
          continue;
        }

        const { data: agentProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', agentId)
          .maybeSingle();

        const agentEmail = await supabase.rpc('get_user_email', { user_id: agentId });

        const agentName = agentProfile?.full_name || 'Your Real Estate Agent';
        const replyToEmail = agentEmail.data || undefined;

        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #333333;
                margin: 0;
                padding: 0;
                background-color: #f4f4f4;
              }
              .container {
                max-width: 600px;
                margin: 20px auto;
                background-color: #ffffff;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              }
              .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                padding: 30px 20px;
                text-align: center;
              }
              .header h1 {
                color: #ffffff;
                margin: 0;
                font-size: 24px;
                font-weight: 600;
              }
              .content {
                padding: 30px;
              }
              .greeting {
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 20px;
                color: #333333;
              }
              .message {
                margin-bottom: 30px;
                white-space: pre-wrap;
                word-wrap: break-word;
              }
              .signature {
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #e0e0e0;
                color: #666666;
              }
              .signature p {
                margin: 5px 0;
              }
              .footer {
                background-color: #f8f9fa;
                padding: 20px;
                text-align: center;
                font-size: 12px;
                color: #666666;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>${template.subject}</h1>
              </div>
              <div class="content">
                <div class="greeting">Hello ${prospect.full_name},</div>
                <div class="message">${template.message.replace(/\n/g, '<br>')}</div>
                <div class="signature">
                  <p><strong>${agentName}</strong></p>
                  ${replyToEmail ? `<p>${replyToEmail}</p>` : ''}
                </div>
              </div>
              <div class="footer">
                <p>This is an automated follow-up from your real estate agent.</p>
              </div>
            </div>
          </body>
          </html>
        `;

        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Proprieta <noreply@proprieta.co>",
            to: [prospect.email],
            subject: template.subject,
            html: emailHtml,
            reply_to: replyToEmail,
          }),
        });

        if (!emailResponse.ok) {
          const errorData = await emailResponse.json();
          console.error('Email send error:', errorData);

          await supabase
            .from('scheduled_follow_ups')
            .update({
              status: 'failed',
              error_message: errorData.message || 'Failed to send email'
            })
            .eq('id', followUp.id);
          failedCount++;
        } else {
          await supabase
            .from('scheduled_follow_ups')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString()
            })
            .eq('id', followUp.id);
          sentCount++;
          console.log(`Sent follow-up email to ${prospect.email}`);
        }
      } catch (error) {
        console.error('Error processing follow-up:', followUp.id, error);
        await supabase
          .from('scheduled_follow_ups')
          .update({
            status: 'failed',
            error_message: error.message || 'Unknown error'
          })
          .eq('id', followUp.id);
        failedCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${scheduledFollowUps?.length || 0} follow-ups`,
        sent: sentCount,
        failed: failedCount
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error in process-scheduled-follow-ups:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});