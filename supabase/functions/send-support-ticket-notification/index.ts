import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SupportTicketNotificationRequest {
  ticket_id: string;
  subject: string;
  description: string;
  priority: string;
  category: string;
  user_email: string;
  created_at: string;
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
    const { ticket_id, subject, description, priority, category, user_email, created_at }: SupportTicketNotificationRequest = await req.json();

    if (!ticket_id || !subject || !description || !priority || !category || !user_email || !created_at) {
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
  <title>New Support Ticket - Proprieta</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">🎫 New Support Ticket</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1f2937; font-size: 22px; margin: 0 0 20px 0;">A new support ticket has been submitted</h2>

              <div style="background-color: #f3f4f6; border-radius: 8px; padding: 30px; margin: 30px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                      <span style="color: #6b7280; font-size: 14px; font-weight: bold; display: block; margin-bottom: 4px;">Ticket ID</span>
                      <span style="color: #1f2937; font-size: 16px; font-family: monospace;">#${ticket_id.slice(0, 8)}</span>
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
                      <span style="background-color: ${priorityColor}; color: #ffffff; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; display: inline-block;">${priorityLabel.toUpperCase()}</span>
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
                      <span style="color: #6b7280; font-size: 14px; font-weight: bold; display: block; margin-bottom: 4px;">User Email</span>
                      <span style="color: #1f2937; font-size: 16px;">${user_email}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                      <span style="color: #6b7280; font-size: 14px; font-weight: bold; display: block; margin-bottom: 4px;">Submitted</span>
                      <span style="color: #1f2937; font-size: 16px;">${formattedDate}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0;">
                      <span style="color: #6b7280; font-size: 14px; font-weight: bold; display: block; margin-bottom: 8px;">Description</span>
                      <div style="color: #1f2937; font-size: 14px; line-height: 1.6; background-color: #ffffff; padding: 16px; border-radius: 6px; border: 1px solid #e5e7eb;">${description.replace(/\n/g, '<br>')}</div>
                    </td>
                  </tr>
                </table>
              </div>

              <div style="background-color: ${priority === 'urgent' ? '#fee2e2' : '#dbeafe'}; border-left: 4px solid ${priority === 'urgent' ? '#dc2626' : '#2563eb'}; padding: 20px; margin: 30px 0; border-radius: 4px;">
                <p style="color: ${priority === 'urgent' ? '#991b1b' : '#1e40af'}; font-size: 14px; margin: 0; font-weight: bold;">${priority === 'urgent' ? '🚨 URGENT' : '📊'} Action Required</p>
                <p style="color: ${priority === 'urgent' ? '#7f1d1d' : '#1e3a8a'}; font-size: 14px; margin: 8px 0 0 0;">${priority === 'urgent' ? 'This is a high-priority ticket that requires immediate attention.' : 'Please review and respond to this support ticket as soon as possible.'}</p>
              </div>

              <div style="text-align: center; margin: 40px 0 30px 0;">
                <a href="${Deno.env.get('SITE_URL') || 'https://proprieta.com'}/admin/support" style="background-color: #dc2626; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: bold; display: inline-block;">View Ticket & Respond</a>
              </div>

              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0; text-align: center;">
                This is an automated notification from the Proprieta support system.
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

    console.log(`Sending support ticket notification for ticket #${ticket_id.slice(0, 8)} (Priority: ${priority})`);

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    const ADMIN_EMAIL = 'mark.mazzone@proprieta.co';

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Proprieta Support <support@proprieta.co>',
        to: [ADMIN_EMAIL],
        subject: `${priority === 'urgent' ? '🚨 URGENT' : '🎫'} Support Ticket: ${subject}`,
        html: emailContent,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend API error:', data);
      throw new Error(data.message || 'Failed to send email via Resend');
    }

    console.log('Support ticket notification sent successfully via Resend:', data);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Support ticket notification sent successfully",
        emailId: data.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error sending support ticket notification:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send support ticket notification", details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
