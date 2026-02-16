import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DocumentSignedPayload {
  ownerEmail: string;
  ownerName: string;
  signerName: string;
  documentName: string;
  signedAt: string;
  propertyAddress?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const payload: DocumentSignedPayload = await req.json();
    console.log("Received document signed notification payload:", payload);

    const {
      ownerEmail,
      ownerName,
      signerName,
      documentName,
      signedAt,
      propertyAddress,
    } = payload;

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not found in environment");
      throw new Error("RESEND_API_KEY not configured");
    }

    console.log("RESEND_API_KEY found, attempting to send email to:", ownerEmail);

    const appUrl = Deno.env.get("APP_URL") || "https://proprieta.co";
    const dashboardUrl = `${appUrl}/#/property-owner-dashboard`;

    const signedDate = new Date(signedAt).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Document Signed</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="padding: 40px 40px 20px 40px;">
                      <h1 style="margin: 0 0 20px 0; color: #1f2937; font-size: 24px; font-weight: bold;">
                        ✅ Document Signed
                      </h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 0 40px 30px 40px;">
                      <p style="margin: 0 0 15px 0; color: #4b5563; font-size: 16px; line-height: 24px;">
                        Hi ${ownerName},
                      </p>
                      <p style="margin: 0 0 15px 0; color: #4b5563; font-size: 16px; line-height: 24px;">
                        Great news! <strong>${signerName}</strong> has signed the document you sent.
                      </p>
                      <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 15px 20px; margin: 20px 0; border-radius: 4px;">
                        <p style="margin: 0 0 8px 0; color: #1f2937; font-size: 16px; font-weight: 600;">
                          ${documentName}
                        </p>
                        ${propertyAddress ? `
                        <p style="margin: 0 0 8px 0; color: #4b5563; font-size: 14px;">
                          📍 ${propertyAddress}
                        </p>
                        ` : ''}
                        <p style="margin: 0; color: #6b7280; font-size: 14px;">
                          Signed on ${signedDate}
                        </p>
                      </div>
                      <p style="margin: 0 0 15px 0; color: #4b5563; font-size: 16px; line-height: 24px;">
                        The signed document is now available in your dashboard. You can view and download it at any time.
                      </p>
                      <table role="presentation" style="margin: 30px 0;">
                        <tr>
                          <td style="border-radius: 6px; background-color: #10b981;">
                            <a href="${dashboardUrl}" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">
                              View Signed Document
                            </a>
                          </td>
                        </tr>
                      </table>
                      <div style="background-color: #eff6ff; border: 2px solid #3b82f6; padding: 15px 20px; margin: 20px 0; border-radius: 6px;">
                        <p style="margin: 0 0 10px 0; color: #1e40af; font-size: 15px; font-weight: 600;">
                          📋 Next Steps:
                        </p>
                        <ul style="margin: 0; padding-left: 20px; color: #1e40af; font-size: 14px; line-height: 22px;">
                          <li style="margin-bottom: 8px;">Review the signed document in your dashboard</li>
                          <li style="margin-bottom: 8px;">Download a copy for your records</li>
                          <li style="margin-bottom: 0;">The lease process is now complete</li>
                        </ul>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 20px 40px 40px 40px; border-top: 1px solid #e5e7eb;">
                      <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 18px;">
                        This is an automated message. Please do not reply to this email.
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

    const emailPayload = {
      from: "Proprieta <noreply@proprieta.co>",
      to: [ownerEmail],
      subject: `✅ ${signerName} signed ${documentName}`,
      html: emailHtml,
    };

    console.log("Sending email via Resend API...");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(emailPayload),
    });

    console.log("Resend API response status:", res.status);

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Resend API error response:", errorText);
      throw new Error(`Resend API error: ${errorText}`);
    }

    const data = await res.json();
    console.log("Email sent successfully, ID:", data.id);

    return new Response(JSON.stringify({ success: true, emailId: data.id }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Error sending document signed notification:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to send notification"
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
