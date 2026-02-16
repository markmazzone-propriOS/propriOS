import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface LoanApprovalRequest {
  buyerEmail: string;
  buyerName: string;
  loanAmount: number;
  loanType: string;
  interestRate?: number;
  estimatedClosingDate?: string;
  propertyAddress?: string;
  lenderName: string;
  lenderPhone?: string;
  lenderEmail?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const {
      buyerEmail,
      buyerName,
      loanAmount,
      loanType,
      interestRate,
      estimatedClosingDate,
      propertyAddress,
      lenderName,
      lenderPhone,
      lenderEmail
    }: LoanApprovalRequest = await req.json();

    if (!buyerEmail || !buyerName || !loanAmount || !loanType || !lenderName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const formattedLoanAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(loanAmount);

    const formattedInterestRate = interestRate ? `${interestRate.toFixed(3)}%` : 'To be determined';

    const loanTypeLabels: Record<string, string> = {
      'conventional': 'Conventional Loan',
      'fha': 'FHA Loan',
      'va': 'VA Loan',
      'usda': 'USDA Loan',
      'jumbo': 'Jumbo Loan'
    };

    const loanTypeLabel = loanTypeLabels[loanType] || loanType;

    let formattedClosingDate = 'To be determined';
    if (estimatedClosingDate) {
      const closingDate = new Date(estimatedClosingDate);
      formattedClosingDate = closingDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }

    const emailContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mortgage Loan Approved!</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 50px 30px; text-align: center;">
              <div style="font-size: 80px; margin-bottom: 15px;">🎉</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 36px; font-weight: bold;">Congratulations!</h1>
              <h2 style="margin: 15px 0 0 0; color: #ffffff; font-size: 24px; font-weight: normal;">Your Mortgage Loan is Approved!</h2>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1f2937; font-size: 24px; margin: 0 0 20px 0;">Hello ${buyerName}!</h2>
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                We're thrilled to inform you that your mortgage loan application has been <strong style="color: #16a34a;">approved</strong>! This is a major milestone in your home buying journey, and we're excited to help you move forward.
              </p>

              <div style="background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%); border: 2px solid #16a34a; border-radius: 12px; padding: 30px; margin: 30px 0;">
                <h3 style="color: #15803d; font-size: 20px; margin: 0 0 25px 0; font-weight: bold; text-align: center;">📋 Loan Approval Details</h3>

                <table style="width: 100%; margin-bottom: 15px;">
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid rgba(22, 163, 74, 0.2);">
                      <span style="color: #15803d; font-size: 14px; font-weight: 600;">Approved Loan Amount</span>
                    </td>
                    <td style="padding: 12px 0; text-align: right; border-bottom: 1px solid rgba(22, 163, 74, 0.2);">
                      <span style="color: #1f2937; font-size: 18px; font-weight: bold;">${formattedLoanAmount}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid rgba(22, 163, 74, 0.2);">
                      <span style="color: #15803d; font-size: 14px; font-weight: 600;">Loan Type</span>
                    </td>
                    <td style="padding: 12px 0; text-align: right; border-bottom: 1px solid rgba(22, 163, 74, 0.2);">
                      <span style="color: #1f2937; font-size: 16px; font-weight: 600;">${loanTypeLabel}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid rgba(22, 163, 74, 0.2);">
                      <span style="color: #15803d; font-size: 14px; font-weight: 600;">Interest Rate</span>
                    </td>
                    <td style="padding: 12px 0; text-align: right; border-bottom: 1px solid rgba(22, 163, 74, 0.2);">
                      <span style="color: #1f2937; font-size: 16px; font-weight: 600;">${formattedInterestRate}</span>
                    </td>
                  </tr>
                  ${estimatedClosingDate ? `
                  <tr>
                    <td style="padding: 12px 0;">
                      <span style="color: #15803d; font-size: 14px; font-weight: 600;">Estimated Closing Date</span>
                    </td>
                    <td style="padding: 12px 0; text-align: right;">
                      <span style="color: #1f2937; font-size: 16px; font-weight: 600;">${formattedClosingDate}</span>
                    </td>
                  </tr>
                  ` : ''}
                </table>

                ${propertyAddress ? `
                <div style="background-color: #ffffff; border-radius: 8px; padding: 20px; margin-top: 20px;">
                  <h4 style="color: #15803d; font-size: 14px; margin: 0 0 10px 0; font-weight: 600;">Property Address</h4>
                  <p style="color: #1f2937; font-size: 16px; margin: 0; font-weight: 600;">
                    ${propertyAddress}
                  </p>
                </div>
                ` : ''}
              </div>

              <div style="background-color: #fffbeb; border: 2px solid #f59e0b; border-radius: 8px; padding: 25px; margin: 30px 0;">
                <h3 style="color: #d97706; font-size: 18px; margin: 0 0 15px 0; font-weight: bold;">⏰ Next Steps</h3>
                <ol style="color: #78350f; font-size: 15px; line-height: 1.8; margin: 0; padding-left: 20px;">
                  <li style="margin-bottom: 12px;">Review your loan approval documents carefully</li>
                  <li style="margin-bottom: 12px;">Sign and return any required paperwork by the deadline</li>
                  <li style="margin-bottom: 12px;">Schedule your final property appraisal if not yet completed</li>
                  <li style="margin-bottom: 12px;">Prepare for your closing appointment</li>
                  <li style="margin-bottom: 12px;">Arrange for homeowner's insurance before closing</li>
                  <li style="margin-bottom: 12px;">Contact your lender if you have any questions</li>
                </ol>
              </div>

              <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 25px; margin: 30px 0;">
                <h3 style="color: #1e40af; font-size: 18px; margin: 0 0 15px 0; font-weight: bold;">💼 Your Lender</h3>
                <p style="color: #1f2937; font-size: 16px; margin: 0 0 10px 0;">
                  <strong>${lenderName}</strong>
                </p>
                ${lenderEmail ? `
                <p style="color: #4b5563; font-size: 15px; margin: 0 0 8px 0;">
                  📧 Email: <a href="mailto:${lenderEmail}" style="color: #2563eb; text-decoration: none;">${lenderEmail}</a>
                </p>
                ` : ''}
                ${lenderPhone ? `
                <p style="color: #4b5563; font-size: 15px; margin: 0;">
                  📞 Phone: ${lenderPhone}
                </p>
                ` : ''}
              </div>

              <div style="background-color: #f0fdf4; border: 2px solid #16a34a; border-radius: 8px; padding: 20px; margin: 30px 0;">
                <p style="color: #15803d; font-size: 15px; margin: 0; line-height: 1.6;">
                  <strong>Important:</strong> This approval is subject to final verification of your financial information and a satisfactory appraisal of the property. Please maintain your current financial status and avoid making any large purchases or opening new credit accounts before closing.
                </p>
              </div>

              <div style="text-align: center; margin: 40px 0 30px 0;">
                <a href="${Deno.env.get('SITE_URL') || 'https://proprieta.com'}/buyer/loan-applications" style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 17px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px rgba(22, 163, 74, 0.3);">View Loan Application Details</a>
              </div>

              <h3 style="color: #1f2937; font-size: 20px; margin: 30px 0 15px 0;">Questions or Concerns?</h3>
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                If you have any questions about your loan approval or the next steps in the closing process, please don't hesitate to contact ${lenderName} directly. They're here to help make your home buying journey as smooth as possible.
              </p>

              <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin: 30px 0;">
                <p style="color: #991b1b; font-size: 14px; margin: 0; line-height: 1.6;">
                  <strong>Time Sensitive:</strong> Some of the documents and next steps may have deadlines. Please review all materials carefully and respond promptly to any requests from your lender to avoid delays in your closing.
                </p>
              </div>

              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 30px 0 0 0;">
                Congratulations again on this exciting milestone! You're one step closer to owning your new home.<br><br>
                <strong>The Proprieta Team</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;">
                This notification was sent to ${buyerEmail}
              </p>
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

    console.log(`Sending loan approval notification to: ${buyerEmail}`);
    console.log(`Loan Amount: ${formattedLoanAmount}`);
    console.log(`Loan Type: ${loanTypeLabel}`);

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
        to: [buyerEmail],
        subject: `🎉 Congratulations! Your ${loanTypeLabel} is Approved`,
        html: emailContent,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend API error:', data);
      throw new Error(data.message || 'Failed to send email via Resend');
    }

    console.log('Loan approval notification sent successfully via Resend:', data);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Loan approval notification sent successfully",
        emailId: data.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error sending loan approval notification:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send loan approval notification", details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});