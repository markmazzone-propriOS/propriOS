import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  customer_address?: string;
  issue_date: string;
  due_date: string;
  status: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  notes?: string;
}

interface SendInvoiceRequest {
  invoice: Invoice;
  items: InvoiceItem[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { invoice, items }: SendInvoiceRequest = await req.json();

    if (!invoice || !items) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const itemsRows = items.map(item => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #1f2937;">${item.description}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #6b7280;">${item.quantity}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #6b7280;">$${item.unit_price.toFixed(2)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; color: #1f2937;">$${item.amount.toFixed(2)}</td>
      </tr>
    `).join('');

    const emailContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invoice.invoice_number}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold;">INVOICE</h1>
              <p style="margin: 10px 0 0 0; color: #e0e7ff; font-size: 18px;">${invoice.invoice_number}</p>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 40px 30px;">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
                <div style="background-color: #f9fafb; padding: 20px; border-radius: 6px;">
                  <h3 style="color: #374151; font-size: 14px; margin: 0 0 12px 0; font-weight: 600;">Bill To:</h3>
                  <p style="color: #1f2937; font-size: 16px; font-weight: 600; margin: 0 0 8px 0;">${invoice.customer_name}</p>
                  <p style="color: #6b7280; font-size: 14px; margin: 0 0 4px 0;">${invoice.customer_email}</p>
                  ${invoice.customer_phone ? `<p style="color: #6b7280; font-size: 14px; margin: 0 0 4px 0;">${invoice.customer_phone}</p>` : ''}
                  ${invoice.customer_address ? `<p style="color: #6b7280; font-size: 14px; margin: 0;">${invoice.customer_address}</p>` : ''}
                </div>
                <div style="background-color: #f9fafb; padding: 20px; border-radius: 6px;">
                  <div style="margin-bottom: 12px;">
                    <p style="color: #6b7280; font-size: 12px; margin: 0 0 4px 0;">Issue Date</p>
                    <p style="color: #1f2937; font-size: 14px; font-weight: 500; margin: 0;">${new Date(invoice.issue_date).toLocaleDateString()}</p>
                  </div>
                  <div style="margin-bottom: 12px;">
                    <p style="color: #6b7280; font-size: 12px; margin: 0 0 4px 0;">Due Date</p>
                    <p style="color: #1f2937; font-size: 14px; font-weight: 500; margin: 0;">${new Date(invoice.due_date).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                <thead>
                  <tr style="background-color: #f9fafb;">
                    <th style="padding: 12px; text-align: left; font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Description</th>
                    <th style="padding: 12px; text-align: right; font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Quantity</th>
                    <th style="padding: 12px; text-align: right; font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Unit Price</th>
                    <th style="padding: 12px; text-align: right; font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsRows}
                </tbody>
              </table>

              <div style="display: flex; justify-content: flex-end; margin-top: 30px;">
                <div style="width: 250px;">
                  <div style="display: flex; justify-content: space-between; padding: 8px 0; color: #6b7280;">
                    <span>Subtotal:</span>
                    <span>$${invoice.subtotal.toFixed(2)}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; padding: 8px 0; color: #6b7280;">
                    <span>Tax (${invoice.tax_rate}%):</span>
                    <span>$${invoice.tax_amount.toFixed(2)}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; padding: 12px 0; font-size: 20px; font-weight: bold; color: #1f2937; border-top: 2px solid #e5e7eb;">
                    <span>Total:</span>
                    <span>$${invoice.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              ${invoice.notes ? `
                <div style="background-color: #f9fafb; padding: 20px; border-radius: 6px; margin-top: 30px;">
                  <h3 style="color: #374151; font-size: 14px; margin: 0 0 12px 0; font-weight: 600;">Notes:</h3>
                  <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${invoice.notes}</p>
                </div>
              ` : ''}

              <div style="background-color: #eff6ff; padding: 20px; border-radius: 6px; margin-top: 30px; border-left: 4px solid #2563eb;">
                <p style="color: #1e40af; font-size: 14px; margin: 0; line-height: 1.6;">
                  <strong>Payment Instructions:</strong><br>
                  Please remit payment by the due date shown above. If you have any questions about this invoice, please don't hesitate to contact us.
                </p>
              </div>

              <p style="color: #6b7280; font-size: 14px; margin: 30px 0 0 0; text-align: center;">
                Thank you for your business!
              </p>
            </td>
          </tr>
          
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
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

    console.log(`Sending invoice ${invoice.invoice_number} to: ${invoice.customer_email}`);

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
        to: [invoice.customer_email],
        subject: `Invoice ${invoice.invoice_number} - $${invoice.total.toFixed(2)}`,
        html: emailContent,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend API error:', data);
      throw new Error(data.message || 'Failed to send email via Resend');
    }

    console.log('Invoice email sent successfully via Resend:', data);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Invoice sent successfully",
        emailId: data.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error sending invoice:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send invoice", details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});