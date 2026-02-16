import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  propertyOwnerId: string;
  propertyId?: string;
  leadName: string;
  leadEmail: string;
  leadPhone?: string;
  message: string;
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
    const { propertyOwnerId, propertyId, leadName, leadEmail, leadPhone, message } = body;

    if (!propertyOwnerId || !leadName || !leadEmail || !message) {
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

    const { data: ownerProfile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', propertyOwnerId)
      .maybeSingle();

    if (profileError || !ownerProfile) {
      console.error('Error fetching property owner profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'Property owner not found' }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(propertyOwnerId);

    if (authError || !authUser.user || !authUser.user.email) {
      console.error('Error fetching property owner email:', authError);
      return new Response(
        JSON.stringify({ error: 'Property owner email not found' }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const recipientEmail = authUser.user.email;

    let propertyAddress = 'your property';
    if (propertyId) {
      const { data: property } = await supabase
        .from('properties')
        .select('address_line1, address_line2, city, state, zip_code')
        .eq('id', propertyId)
        .maybeSingle();

      if (property) {
        propertyAddress = `${property.address_line1}${property.address_line2 ? ', ' + property.address_line2 : ''}, ${property.city}, ${property.state} ${property.zip_code}`;
      }
    }

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
  <title>New Rental Inquiry</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f3f4f6;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">
                New Rental Inquiry
              </h1>
            </td>
          </tr>

          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 24px; color: #1f2937; font-size: 16px; line-height: 1.5;">
                Hi <strong>${ownerProfile.full_name || 'there'}</strong>,
              </p>

              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Great news! You have received a new rental inquiry for <strong>${propertyAddress}</strong> through your Proprieta listing.
              </p>

              <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 24px 0; border-radius: 4px;">
                <h2 style="margin: 0 0 16px; color: #059669; font-size: 18px; font-weight: 600;">
                  Prospective Tenant Details
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
                      <a href="mailto:${leadEmail}" style="color: #10b981; text-decoration: none;">
                        ${leadEmail}
                      </a>
                    </td>
                  </tr>
                  ${phoneSection}
                </table>
              </div>

              <div style="margin: 24px 0;">
                <h3 style="margin: 0 0 12px; color: #1f2937; font-size: 16px; font-weight: 600;">
                  Their Message:
                </h3>
                <div style="background-color: #ffffff; border: 1px solid #e5e7eb; padding: 16px; border-radius: 4px; color: #374151; font-size: 15px; line-height: 1.6;">
                  ${message.replace(/\n/g, '<br>')}
                </div>
              </div>

              <div style="text-align: center; margin: 32px 0;">
                <a href="${Deno.env.get('SITE_URL') || 'https://proprieta.com'}/property-owner/leads"
                   style="display: inline-block; background-color: #10b981; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);">
                  View Lead in Dashboard
                </a>
              </div>

              <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0 0 12px; color: #4b5563; font-size: 14px; line-height: 1.6;">
                  <strong>Next Steps:</strong>
                </p>
                <ul style="margin: 0; padding-left: 20px; color: #4b5563; font-size: 14px; line-height: 1.6;">
                  <li style="margin-bottom: 8px;">Respond within 24 hours for the best results</li>
                  <li style="margin-bottom: 8px;">Review the lead details in your dashboard</li>
                  <li style="margin-bottom: 8px;">Contact them via email or phone to discuss the rental</li>
                  <li style="margin-bottom: 8px;">Schedule a property viewing if they're interested</li>
                  <li>Update the lead status as you progress through the rental process</li>
                </ul>
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; border-radius: 0 0 8px 8px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">
                This lead was generated from your Proprieta property listing
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
        subject: `New Rental Inquiry: ${leadName} is interested in your property`,
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

    console.log('Property owner lead notification sent successfully via Resend:', data);

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
    console.error('Error in send-property-owner-lead-notification function:', error);
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