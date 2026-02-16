import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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
    const { signature_id } = await req.json();
    console.log("Received signature request for ID:", signature_id);

    if (!signature_id) {
      throw new Error("signature_id is required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: signatureRequest, error: fetchError } = await supabase
      .from("document_signatures")
      .select(`
        *,
        document:documents(file_name),
        signer:profiles!document_signatures_signer_id_fkey(full_name),
        sender:profiles!document_signatures_sender_id_fkey(full_name)
      `)
      .eq("id", signature_id)
      .single();

    if (fetchError) {
      console.error("Error fetching signature request:", fetchError);
      throw new Error("Failed to fetch signature request");
    }

    const { data: signerAuth } = await supabase.auth.admin.getUserById(
      signatureRequest.signer_id
    );

    if (!signerAuth?.user?.email) {
      throw new Error("Signer email not found");
    }

    const signerEmail = signerAuth.user.email;
    const signerName = (signatureRequest.signer as any)?.full_name || "User";
    const senderName = (signatureRequest.sender as any)?.full_name || "Your Agent";
    const documentName = (signatureRequest.document as any)?.file_name || "Document";
    const expiresAt = signatureRequest.expires_at;

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not found in environment");
      throw new Error("RESEND_API_KEY not configured");
    }

    console.log("RESEND_API_KEY found, attempting to send email to:", signerEmail);

    const appUrl = Deno.env.get("APP_URL") || "https://proprieta.co";
    const signatureUrl = `${appUrl}/#/auth?redirect=/pending-signatures`;

    const expiryDate = new Date(expiresAt).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Signature Request</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="padding: 40px 40px 20px 40px;">
                      <h1 style="margin: 0 0 20px 0; color: #1f2937; font-size: 24px; font-weight: bold;">
                        📝 Signature Required
                      </h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 0 40px 30px 40px;">
                      <p style="margin: 0 0 15px 0; color: #4b5563; font-size: 16px; line-height: 24px;">
                        Hi ${signerName},
                      </p>
                      <p style="margin: 0 0 15px 0; color: #4b5563; font-size: 16px; line-height: 24px;">
                        <strong>${senderName}</strong> has sent you a document that requires your signature:
                      </p>
                      <div style="background-color: #f9fafb; border-left: 4px solid #10b981; padding: 15px 20px; margin: 20px 0; border-radius: 4px;">
                        <p style="margin: 0; color: #1f2937; font-size: 16px; font-weight: 600;">
                          ${documentName}
                        </p>
                      </div>
                      <p style="margin: 0 0 15px 0; color: #4b5563; font-size: 14px; line-height: 20px;">
                        ⏰ This request expires on <strong>${expiryDate}</strong>
                      </p>
                      <div style="background-color: #fef3c7; border: 2px solid #fbbf24; padding: 15px 20px; margin: 20px 0; border-radius: 6px;">
                        <p style="margin: 0 0 10px 0; color: #92400e; font-size: 15px; font-weight: 600;">
                          📋 To Sign This Document:
                        </p>
                        <ol style="margin: 0; padding-left: 20px; color: #78350f; font-size: 14px; line-height: 22px;">
                          <li style="margin-bottom: 8px;">Log in to your Proprieta account</li>
                          <li style="margin-bottom: 8px;">Go to your dashboard</li>
                          <li style="margin-bottom: 0;">Look for the <strong>yellow "Pending Signatures"</strong> box at the top of your dashboard</li>
                        </ol>
                      </div>
                      <table role="presentation" style="margin: 30px 0;">
                        <tr>
                          <td style="border-radius: 6px; background-color: #10b981;">
                            <a href="${signatureUrl}" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">
                              Go to My Dashboard
                            </a>
                          </td>
                        </tr>
                      </table>
                      <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 14px; line-height: 20px;">
                        If you have any questions about this document, please contact ${senderName} directly.
                      </p>
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
      to: [signerEmail],
      subject: `📝 Signature Required: ${documentName}`,
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
    console.error("Error sending signature request email:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to send signature request email"
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