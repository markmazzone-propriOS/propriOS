import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  providerId: string;
  leadName: string;
  leadEmail: string;
  leadPhone?: string;
  message: string;
  isAuthenticated: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body: RequestBody = await req.json();
    const { providerId, leadName, leadEmail, leadPhone, message, isAuthenticated } = body;

    if (!providerId || !leadName || !leadEmail || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const { data: provider, error: providerError } = await supabase
      .from('service_provider_profiles')
      .select('business_name, business_email')
      .eq('id', providerId)
      .maybeSingle();

    if (providerError || !provider) {
      console.error('Error fetching provider:', providerError);
      return new Response(
        JSON.stringify({ error: 'Service provider not found' }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const { data: providerUser, error: userError } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', providerId)
      .maybeSingle();

    if (userError || !providerUser) {
      console.error('Error fetching provider user:', userError);
      return new Response(
        JSON.stringify({ error: 'Provider user not found' }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const recipientEmail = provider.business_email || providerUser.email;
    const accountType = isAuthenticated ? 'registered user' : 'visitor';
    const phoneSection = leadPhone ? `
      <tr>
        <td style="padding: 8px 0; color: #4b5563;">
          <strong>Phone:</strong>
        </td>
        <td style="padding: 8px 0; color: #1f2937;">
          ${leadPhone}
        </td>
      </tr>` : '';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Lead Inquiry</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f3f4f6;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">
                New Lead Inquiry
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 24px; color: #1f2937; font-size: 16px; line-height: 1.5;">
                Hi <strong>${providerUser.full_name || provider.business_name}</strong>,
              </p>

              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Great news! You have received a new inquiry from a potential client through your Proprieta profile.
              </p>

              <!-- Lead Details Box -->
              <div style="background-color: #f9fafb; border-left: 4px solid #2563eb; padding: 20px; margin: 24px 0; border-radius: 4px;">
                <h2 style="margin: 0 0 16px; color: #1f2937; font-size: 18px; font-weight: 600;">
                  Lead Details
                </h2>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #4b5563;">
                      <strong>Name:</strong>
                    </td>
                    <td style="padding: 8px 0; color: #1f2937;">
                      ${leadName}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #4b5563;">
                      <strong>Email:</strong>
                    </td>
                    <td style="padding: 8px 0; color: #1f2937;">
                      <a href="mailto:${leadEmail}" style="color: #2563eb; text-decoration: none;">
                        ${leadEmail}
                      </a>
                    </td>
                  </tr>
                  ${phoneSection}
                  <tr>
                    <td style="padding: 8px 0; color: #4b5563;">
                      <strong>Status:</strong>
                    </td>
                    <td style="padding: 8px 0; color: #1f2937;">
                      ${accountType === 'registered user' ? '✓ Registered User' : 'Website Visitor'}
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Message Box -->
              <div style="margin: 24px 0;">
                <h3 style="margin: 0 0 12px; color: #1f2937; font-size: 16px; font-weight: 600;">
                  Their Message:
                </h3>
                <div style="background-color: #ffffff; border: 1px solid #e5e7eb; padding: 16px; border-radius: 4px; color: #374151; font-size: 15px; line-height: 1.6;">
                  ${message.replace(/\n/g, '<br>')}
                </div>
              </div>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="${Deno.env.get('SUPABASE_URL')?.replace('/v1', '')}/leads"
                   style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);">
                  View Lead in Dashboard
                </a>
              </div>

              <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0 0 12px; color: #4b5563; font-size: 14px; line-height: 1.6;">
                  <strong>Next Steps:</strong>
                </p>
                <ul style="margin: 0; padding-left: 20px; color: #4b5563; font-size: 14px; line-height: 1.6;">
                  <li style="margin-bottom: 8px;">Respond within 24 hours for the best conversion rate</li>
                  <li style="margin-bottom: 8px;">Review the lead details in your dashboard</li>
                  <li style="margin-bottom: 8px;">Update the lead status as you progress</li>
                  ${isAuthenticated ? '<li>Reply to them directly through the Messages section</li>' : '<li>Contact them via email or phone to discuss their project</li>'}
                </ul>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; border-radius: 0 0 8px 8px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">
                This lead was generated from your Proprieta profile
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                © ${new Date().getFullYear()} Proprieta. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const textContent = `
New Lead Inquiry - Proprieta

Hi ${providerUser.full_name || provider.business_name},

Great news! You have received a new inquiry from a potential client through your Proprieta profile.

LEAD DETAILS
Name: ${leadName}
Email: ${leadEmail}
${leadPhone ? `Phone: ${leadPhone}` : ''}
Status: ${accountType}

THEIR MESSAGE:
${message}

NEXT STEPS:
- Respond within 24 hours for the best conversion rate
- Review the lead details in your dashboard
- Update the lead status as you progress
${isAuthenticated ? '- Reply to them directly through the Messages section' : '- Contact them via email or phone to discuss their project'}

View this lead in your dashboard: ${Deno.env.get('SUPABASE_URL')?.replace('/v1', '')}/leads

---
This lead was generated from your Proprieta profile
© ${new Date().getFullYear()} Proprieta. All rights reserved.
    `.trim();

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
        from: 'Proprieta <noreply@proprieta.co>',
        to: [recipientEmail],
        subject: `New Lead: ${leadName} contacted you on Proprieta`,
        html: htmlContent,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend API error:', data);
      return new Response(
        JSON.stringify({ error: 'Failed to send email notification' }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    console.log('Lead notification sent successfully via Resend:', data);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email notification sent successfully'
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error in send-lead-notification function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
