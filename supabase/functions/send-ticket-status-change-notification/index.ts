import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TicketStatusChangeRequest {
  ticket_id: string;
  subject: string;
  old_status: string;
  new_status: string;
  user_email: string;
  updated_at: string;
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    'open': '#2563eb',
    'in_progress': '#ca8a04',
    'resolved': '#16a34a',
    'closed': '#6b7280'
  };
  return colors[status] || '#6b7280';
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    'open': 'Open',
    'in_progress': 'In Progress',
    'resolved': 'Resolved',
    'closed': 'Closed'
  };
  return labels[status] || status;
}

function getStatusIcon(status: string): string {
  const icons: Record<string, string> = {
    'open': '🔵',
    'in_progress': '🟡',
    'resolved': '✅',
    'closed': '⚫'
  };
  return icons[status] || '📋';
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { ticket_id, subject, old_status, new_status, user_email, updated_at }: TicketStatusChangeRequest = await req.json();

    if (!ticket_id || !subject || !old_status || !new_status || !user_email || !updated_at) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const oldStatusColor = getStatusColor(old_status);
    const newStatusColor = getStatusColor(new_status);
    const oldStatusLabel = getStatusLabel(old_status);
    const newStatusLabel = getStatusLabel(new_status);
    const newStatusIcon = getStatusIcon(new_status);

    const formattedDate = new Date(updated_at).toLocaleString('en-US', {
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
  <title>Support Ticket Status Update - Proprieta</title>
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
              <p style="margin: 10px 0 0 0; color: #fecaca; font-size: 16px;">Ticket Status Update</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1f2937; font-size: 22px; margin: 0 0 10px 0;">Your Support Ticket Has Been Updated</h2>
              <p style="color: #6b7280; font-size: 16px; margin: 0 0 30px 0; line-height: 1.6;">
                Your support ticket status has been changed. Here are the details:
              </p>

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
                      <span style="color: #6b7280; font-size: 14px; font-weight: bold; display: block; margin-bottom: 8px;">Status Change</span>
                      <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="background-color: ${oldStatusColor}; color: #ffffff; padding: 6px 16px; border-radius: 12px; font-size: 13px; font-weight: bold; display: inline-block;">${oldStatusLabel.toUpperCase()}</span>
                        <span style="color: #9ca3af; font-size: 20px;">→</span>
                        <span style="background-color: ${newStatusColor}; color: #ffffff; padding: 6px 16px; border-radius: 12px; font-size: 13px; font-weight: bold; display: inline-block;">${newStatusIcon} ${newStatusLabel.toUpperCase()}</span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0;">
                      <span style="color: #6b7280; font-size: 14px; font-weight: bold; display: block; margin-bottom: 4px;">Updated On</span>
                      <span style="color: #1f2937; font-size: 16px;">${formattedDate}</span>
                    </td>
                  </tr>
                </table>
              </div>

              ${new_status === 'resolved' ? `
              <div style="background-color: #d1fae5; border-left: 4px solid #16a34a; padding: 20px; margin: 30px 0; border-radius: 4px;">
                <p style="color: #065f46; font-size: 14px; margin: 0; font-weight: bold;">✅ Great News!</p>
                <p style="color: #047857; font-size: 14px; margin: 8px 0 0 0;">Your support ticket has been resolved. If you have any additional questions or concerns, please feel free to reach out to us again.</p>
              </div>
              ` : new_status === 'in_progress' ? `
              <div style="background-color: #fef3c7; border-left: 4px solid #ca8a04; padding: 20px; margin: 30px 0; border-radius: 4px;">
                <p style="color: #92400e; font-size: 14px; margin: 0; font-weight: bold;">🟡 In Progress</p>
                <p style="color: #78350f; font-size: 14px; margin: 8px 0 0 0;">Our support team is actively working on your ticket. We'll keep you updated on the progress.</p>
              </div>
              ` : new_status === 'closed' ? `
              <div style="background-color: #f3f4f6; border-left: 4px solid #6b7280; padding: 20px; margin: 30px 0; border-radius: 4px;">
                <p style="color: #374151; font-size: 14px; margin: 0; font-weight: bold;">⚫ Ticket Closed</p>
                <p style="color: #4b5563; font-size: 14px; margin: 8px 0 0 0;">This ticket has been closed. If you need further assistance, please submit a new support ticket.</p>
              </div>
              ` : ''}

              <div style="text-align: center; margin: 40px 0 30px 0;">
                <a href="${Deno.env.get('SITE_URL') || 'https://proprieta.com'}/settings/support" style="background-color: #dc2626; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: bold; display: inline-block;">View Ticket Details</a>
              </div>

              <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 30px 0 0 0;">
                <p style="color: #6b7280; font-size: 13px; line-height: 1.6; margin: 0;">
                  <strong style="color: #1f2937;">Need Help?</strong><br>
                  If you have any questions about this update, please reply to this email or contact us at <a href="mailto:support@proprieta.co" style="color: #dc2626; text-decoration: none;">support@proprieta.co</a>
                </p>
              </div>

              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0; text-align: center;">
                This is an automated notification from Proprieta.
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
                You're receiving this email because you submitted a support ticket.
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

    console.log(`Sending status change notification for ticket #${ticket_id.slice(0, 8)}: ${old_status} → ${new_status}`);

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
        subject: `${newStatusIcon} Your Support Ticket Status: ${newStatusLabel}`,
        html: emailContent,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend API error:', data);
      throw new Error(data.message || 'Failed to send email via Resend');
    }

    console.log('Ticket status change notification sent successfully via Resend:', data);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Ticket status change notification sent successfully",
        emailId: data.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error sending ticket status change notification:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send notification", details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
