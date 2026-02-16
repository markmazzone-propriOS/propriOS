import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TicketConfirmationRequest {
  ticket_id: string;
  subject: string;
  description: string;
  priority: string;
  category: string;
  user_email: string;
  created_at: string;
  reply_token: string;
}

function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    'urgent': '#dc2626',
    'high': '#ea580c',
    'medium': '#ca8a04',
    'low': '#16a34a'
  };
  return colors[priority] || '#6b7280';
}

function getPriorityLabel(priority: string): string {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    'technical': 'Technical Issue',
    'billing': 'Billing Question',
    'sales_inquiry': 'Sales Inquiry',
    'feature_request': 'Feature Request',
    'other': 'Other'
  };
  return labels[category] || category;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { ticket_id, subject, description, priority, category, user_email, created_at, reply_token }: TicketConfirmationRequest = await req.json();

    if (!ticket_id || !subject || !description || !priority || !category || !user_email || !created_at || !reply_token) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const priorityColor = getPriorityColor(priority);
    const priorityLabel = getPriorityLabel(priority);
    const categoryLabel = getCategoryLabel(category);
    const formattedDate = new Date(created_at).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });

    const emailContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Support Ticket Confirmation - Proprieta</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">Proprieta Support</h1>
              <p style="margin: 10px 0 0 0; color: #fecaca; font-size: 16px;">Support Ticket Confirmation</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1f2937; font-size: 22px; margin: 0 0 10px 0;">Thank You for Contacting Us!</h2>
              <p style="color: #6b7280; font-size: 16px; margin: 0 0 30px 0; line-height: 1.6;">
                We've received your support ticket and our team will review it shortly. Here's a summary of your submission:
              </p>

              <div style="background-color: #f3f4f6; border-radius: 8px; padding: 30px; margin: 30px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                      <span style="color: #6b7280; font-size: 14px; font-weight: bold; display: block; margin-bottom: 4px;">Ticket ID</span>
                      <span style="color: #1f2937; font-size: 16px; font-family: monospace; font-weight: bold;">#${ticket_id.slice(0, 8).toUpperCase()}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                      <span style="color: #6b7280; font-size: 14px; font-weight: bold; display: block; margin-bottom: 4px;">Subject</span>
                      <span style="color: #1f2937; font-size: 16px; font-weight: bold;">${subject}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                      <span style="color: #6b7280; font-size: 14px; font-weight: bold; display: block; margin-bottom: 4px;">Priority</span>
                      <span style="background-color: ${priorityColor}; color: #ffffff; padding: 6px 16px; border-radius: 12px; font-size: 13px; font-weight: bold; display: inline-block;">${priorityLabel.toUpperCase()}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                      <span style="color: #6b7280; font-size: 14px; font-weight: bold; display: block; margin-bottom: 4px;">Category</span>
                      <span style="color: #1f2937; font-size: 16px;">${categoryLabel}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                      <span style="color: #6b7280; font-size: 14px; font-weight: bold; display: block; margin-bottom: 4px;">Submitted On</span>
                      <span style="color: #1f2937; font-size: 16px;">${formattedDate}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0;">
                      <span style="color: #6b7280; font-size: 14px; font-weight: bold; display: block; margin-bottom: 8px;">Your Message</span>
                      <div style="color: #1f2937; font-size: 14px; line-height: 1.6; background-color: #ffffff; padding: 16px; border-radius: 6px; border: 1px solid #e5e7eb;">${description.replace(/\n/g, '<br>')}</div>
                    </td>
                  </tr>
                </table>
              </div>

              ${priority === 'urgent' ? `
              <div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 20px; margin: 30px 0; border-radius: 4px;">
                <p style="color: #991b1b; font-size: 14px; margin: 0; font-weight: bold;">⚡ Urgent Priority</p>
                <p style="color: #7f1d1d; font-size: 14px; margin: 8px 0 0 0;">We've flagged your ticket as urgent. Our support team will prioritize your request and respond as quickly as possible.</p>
              </div>
              ` : `
              <div style="background-color: #dbeafe; border-left: 4px solid #2563eb; padding: 20px; margin: 30px 0; border-radius: 4px;">
                <p style="color: #1e40af; font-size: 14px; margin: 0; font-weight: bold;">📬 What Happens Next?</p>
                <p style="color: #1e3a8a; font-size: 14px; margin: 8px 0 0 0;">Our support team will review your ticket and respond to your email address. You'll receive updates via email as your ticket progresses.</p>
              </div>
              `}

              <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 30px 0 0 0;">
                <p style="color: #6b7280; font-size: 13px; line-height: 1.6; margin: 0;">
                  <strong style="color: #1f2937;">Keep This Email:</strong><br>
                  Save this email for your records. You can reference your Ticket ID (#${ticket_id.slice(0, 8).toUpperCase()}) when following up with our support team.
                </p>
              </div>

              <div style="background-color: #fef3c7; border-radius: 8px; padding: 20px; margin: 30px 0 0 0; border-left: 4px solid #ca8a04;">
                <p style="color: #92400e; font-size: 13px; line-height: 1.6; margin: 0;">
                  <strong style="color: #78350f;">Expected Response Time:</strong><br>
                  ${priority === 'urgent' ? 'Urgent tickets: Within 4 hours during business hours' : priority === 'high' ? 'High priority: Within 24 hours' : 'Standard tickets: Within 1-2 business days'}
                </p>
              </div>

              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0; text-align: center;">
                Questions? Reply to this email or contact us at <a href="mailto:support@proprieta.co" style="color: #dc2626; text-decoration: none;">support@proprieta.co</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} Proprieta. All rights reserved.
              </p>
              <p style="color: #9ca3af; font-size: 11px; margin: 8px 0 0 0;">
                This confirmation email was sent because you submitted a support ticket.
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

    console.log(`Sending ticket confirmation for ticket #${ticket_id.slice(0, 8)} to ${user_email}`);

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
        to: [user_email],
        subject: `Ticket Confirmed: ${subject} [#${ticket_id.slice(0, 8).toUpperCase()}]`,
        html: emailContent,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend API error:', data);
      throw new Error(data.message || 'Failed to send email via Resend');
    }

    console.log('Ticket confirmation sent successfully via Resend:', data);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Ticket confirmation sent successfully",
        emailId: data.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error sending ticket confirmation:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send confirmation", details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
