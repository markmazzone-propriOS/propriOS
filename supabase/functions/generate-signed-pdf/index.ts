import { createClient } from 'npm:@supabase/supabase-js@2';
import { PDFDocument, rgb, StandardFonts } from 'npm:pdf-lib@1.17.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

async function base64ToUint8Array(base64: string): Promise<Uint8Array> {
  try {
    // Remove the data URL prefix if present
    const base64Data = base64.replace(/^data:image\/png;base64,/, '');

    // Decode base64 to binary string
    const binaryString = atob(base64Data);

    // Convert binary string to Uint8Array
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    console.log('Successfully converted base64 to Uint8Array, length:', bytes.length);
    return bytes;
  } catch (error) {
    console.error('Error converting base64 to Uint8Array:', error);
    throw error;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { signatureRequestId } = await req.json();

    if (!signatureRequestId) {
      return new Response(
        JSON.stringify({ error: 'signatureRequestId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching signature request:', signatureRequestId);

    const { data: signatureRequest, error: sigError } = await supabase
      .from('document_signatures')
      .select(`
        id,
        document_id,
        signer_id,
        sender_id,
        signature_data,
        signature_type,
        signature_boxes,
        signed_at,
        signed_document_url,
        sender_needs_to_sign,
        sender_signature_data,
        sender_signature_type,
        sender_signed_at,
        signer_signed_at,
        serial_number,
        document:documents(file_name, storage_path)
      `)
      .eq('id', signatureRequestId)
      .eq('status', 'signed')
      .single();

    if (sigError || !signatureRequest) {
      console.error('Signature request not found:', sigError);
      return new Response(
        JSON.stringify({ error: 'Signature request not found or not signed' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Signature request found:', {
      id: signatureRequest.id,
      has_signature_data: !!signatureRequest.signature_data,
      signature_type: signatureRequest.signature_type,
      has_sender_signature: !!signatureRequest.sender_signature_data,
      sender_signature_type: signatureRequest.sender_signature_type,
      signature_boxes_count: signatureRequest.signature_boxes?.length || 0,
      signature_boxes_raw: JSON.stringify(signatureRequest.signature_boxes)
    });

    if (signatureRequest.signed_document_url) {
      console.log('Signed document already exists:', signatureRequest.signed_document_url);
      return new Response(
        JSON.stringify({
          message: 'Signed PDF already exists',
          signed_document_url: signatureRequest.signed_document_url
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: originalPdfBlob, error: downloadError } = await supabase.storage
      .from('agent-documents')
      .download(signatureRequest.document.storage_path);

    if (downloadError || !originalPdfBlob) {
      console.error('Failed to download original document:', downloadError);
      return new Response(
        JSON.stringify({ error: 'Failed to download original document' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Original PDF downloaded, size:', originalPdfBlob.size);

    const originalPdfBytes = await originalPdfBlob.arrayBuffer();
    const pdfDoc = await PDFDocument.load(originalPdfBytes);
    const pages = pdfDoc.getPages();

    console.log('PDF loaded, pages:', pages.length);

    const signatureBoxes = signatureRequest.signature_boxes || [];

    console.log('Processing signature boxes:', signatureBoxes.length);

    if (signatureBoxes.length > 0) {
      const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

      for (const box of signatureBoxes) {
        // Handle both camelCase and snake_case field names
        const boxId = box.id;
        const boxSigned = box.signed;
        const boxSigner = box.signer; // 'sender' or 'recipient'
        const boxFieldType = box.fieldType || box.field_type;
        const boxPage = box.page;
        const boxX = box.x;
        const boxY = box.y;
        const boxWidth = box.width;
        const boxHeight = box.height;

        // Determine which signature data to use based on signer role
        let boxSignatureData;
        let boxSignatureType;

        if (boxSigner === 'sender') {
          boxSignatureData = signatureRequest.sender_signature_data;
          boxSignatureType = signatureRequest.sender_signature_type;
        } else {
          boxSignatureData = signatureRequest.signature_data;
          boxSignatureType = signatureRequest.signature_type;
        }

        console.log('Processing box:', {
          id: boxId,
          signer: boxSigner,
          signed: boxSigned,
          has_signature_data: !!boxSignatureData,
          signature_type: boxSignatureType,
          field_type: boxFieldType
        });

        if (!boxSigned || !boxSignatureData) {
          console.log('Box not signed or no signature data, skipping');
          continue;
        }

        const pageIndex = boxPage - 1;
        if (pageIndex < 0 || pageIndex >= pages.length) {
          console.log('Invalid page index, skipping');
          continue;
        }

        const page = pages[pageIndex];
        const { height: pageHeight } = page.getSize();

        const pdfX = boxX;
        const pdfY = pageHeight - boxY - boxHeight;

        const isDrawnSignature = boxSignatureData.startsWith('data:image/png;base64,');
        console.log('Is drawn signature:', isDrawnSignature);

        if (boxFieldType === 'signature') {
          if (isDrawnSignature) {
            try {
              console.log('Attempting to embed signature image');
              const imageBytes = await base64ToUint8Array(boxSignatureData);
              const signatureImage = await pdfDoc.embedPng(imageBytes);
              const imgWidth = boxWidth - 10;
              const imgHeight = boxHeight - 10;

              console.log('Image embedded successfully, dimensions:', imgWidth, 'x', imgHeight);

              page.drawImage(signatureImage, {
                x: pdfX + 5,
                y: pdfY + 5,
                width: imgWidth,
                height: imgHeight,
              });

              console.log('Image drawn at position:', pdfX + 5, pdfY + 5);
            } catch (err) {
              console.error('Failed to embed signature image:', err);
            }
          } else {
            console.log('Drawing typed signature');
            const fontSize = Math.min(20, boxHeight * 0.6);
            page.drawText(boxSignatureData, {
              x: pdfX + 5,
              y: pdfY + (boxHeight * 0.3),
              size: fontSize,
              font: italicFont,
              color: rgb(0, 0, 0),
            });
          }
        } else if (boxFieldType === 'initials') {
          if (isDrawnSignature) {
            try {
              console.log('Attempting to embed initials image');
              const imageBytes = await base64ToUint8Array(boxSignatureData);
              const initialsImage = await pdfDoc.embedPng(imageBytes);
              const imgWidth = boxWidth - 10;
              const imgHeight = boxHeight - 10;

              page.drawImage(initialsImage, {
                x: pdfX + 5,
                y: pdfY + 5,
                width: imgWidth,
                height: imgHeight,
              });

              console.log('Initials image drawn at position:', pdfX + 5, pdfY + 5);
            } catch (err) {
              console.error('Failed to embed initials image:', err);
            }
          } else {
            const fontSize = Math.min(16, boxHeight * 0.5);
            page.drawText(boxSignatureData, {
              x: pdfX + (boxWidth / 2) - (fontSize * boxSignatureData.length / 4),
              y: pdfY + (boxHeight * 0.3),
              size: fontSize,
              font: regularFont,
              color: rgb(0, 0, 0),
            });
          }
        } else if (boxFieldType === 'date') {
          const fontSize = Math.min(12, boxHeight * 0.5);
          page.drawText(boxSignatureData, {
            x: pdfX + 5,
            y: pdfY + (boxHeight * 0.3),
            size: fontSize,
            font: regularFont,
            color: rgb(0, 0, 0),
          });
        }
      }
    } else {
      console.log('No signature boxes, using fallback placement');
      const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
      const lastPage = pages[pages.length - 1];
      let x = 50;
      let y = 150;

      if (signatureRequest.signature_data) {
        console.log('Processing recipient signature for fallback');
        lastPage.drawText('Recipient Signature:', {
          x: x,
          y: y + 65,
          size: 10,
          font: regularFont,
          color: rgb(0.3, 0.3, 0.3),
        });

        const isDrawn = signatureRequest.signature_data.startsWith('data:image/png;base64,');
        console.log('Recipient signature is drawn:', isDrawn);

        if (isDrawn) {
          try {
            const imageBytes = await base64ToUint8Array(signatureRequest.signature_data);
            const signatureImage = await pdfDoc.embedPng(imageBytes);

            lastPage.drawImage(signatureImage, {
              x: x,
              y: y + 10,
              width: 150,
              height: 50,
            });
            console.log('Recipient signature image embedded successfully');
          } catch (err) {
            console.error('Failed to embed recipient signature:', err);
            lastPage.drawText('[Signature image error]', {
              x: x,
              y: y + 30,
              size: 12,
              font: regularFont,
              color: rgb(0.5, 0, 0),
            });
          }
        } else {
          lastPage.drawText(signatureRequest.signature_data, {
            x: x,
            y: y + 30,
            size: 20,
            font: italicFont,
            color: rgb(0, 0, 0),
          });
        }

        const signedDate = new Date(signatureRequest.signer_signed_at || signatureRequest.signed_at).toLocaleDateString();
        lastPage.drawText(`Date: ${signedDate}`, {
          x: x,
          y: y,
          size: 10,
          font: regularFont,
          color: rgb(0.3, 0.3, 0.3),
        });

        y = y - 100;
      }

      if (signatureRequest.sender_needs_to_sign && signatureRequest.sender_signature_data) {
        console.log('Processing sender signature for fallback');
        lastPage.drawText('Sender Signature:', {
          x: x,
          y: y + 65,
          size: 10,
          font: regularFont,
          color: rgb(0.3, 0.3, 0.3),
        });

        const isDrawn = signatureRequest.sender_signature_data.startsWith('data:image/png;base64,');
        console.log('Sender signature is drawn:', isDrawn);

        if (isDrawn) {
          try {
            const imageBytes = await base64ToUint8Array(signatureRequest.sender_signature_data);
            const signatureImage = await pdfDoc.embedPng(imageBytes);

            lastPage.drawImage(signatureImage, {
              x: x,
              y: y + 10,
              width: 150,
              height: 50,
            });
            console.log('Sender signature image embedded successfully');
          } catch (err) {
            console.error('Failed to embed sender signature:', err);
            lastPage.drawText('[Signature image error]', {
              x: x,
              y: y + 30,
              size: 12,
              font: regularFont,
              color: rgb(0.5, 0, 0),
            });
          }
        } else {
          lastPage.drawText(signatureRequest.sender_signature_data, {
            x: x,
            y: y + 30,
            size: 20,
            font: italicFont,
            color: rgb(0, 0, 0),
          });
        }

        const senderSignedDate = new Date(signatureRequest.sender_signed_at!).toLocaleDateString();
        lastPage.drawText(`Date: ${senderSignedDate}`, {
          x: x,
          y: y,
          size: 10,
          font: regularFont,
          color: rgb(0.3, 0.3, 0.3),
        });
      }
    }

    // Add serial number to the document if it exists
    if (signatureRequest.serial_number) {
      console.log('Adding serial number to PDF:', signatureRequest.serial_number);
      const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const firstPage = pages[0];
      const { width: pageWidth, height: pageHeight } = firstPage.getSize();

      // Add serial number in top right corner
      const serialText = `Document Serial: ${signatureRequest.serial_number}`;
      const fontSize = 9;
      const textWidth = regularFont.widthOfTextAtSize(serialText, fontSize);

      firstPage.drawText(serialText, {
        x: pageWidth - textWidth - 30,
        y: pageHeight - 30,
        size: fontSize,
        font: regularFont,
        color: rgb(0.4, 0.4, 0.4),
      });

      // Add border around serial number
      firstPage.drawRectangle({
        x: pageWidth - textWidth - 35,
        y: pageHeight - 35,
        width: textWidth + 10,
        height: 15,
        borderColor: rgb(0.7, 0.7, 0.7),
        borderWidth: 0.5,
      });
    }

    console.log('Saving PDF with signatures');
    const signedPdfBytes = await pdfDoc.save();
    const signedPdfBlob = new Blob([signedPdfBytes], { type: 'application/pdf' });

    const timestamp = Date.now();
    const fileName = `signed_${signatureRequest.document_id}_${timestamp}.pdf`;
    const filePath = `${signatureRequest.signer_id}/signed/${fileName}`;

    console.log('Uploading signed PDF to:', filePath);

    const { error: uploadError } = await supabase.storage
      .from('agent-documents')
      .upload(filePath, signedPdfBlob, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to upload signed PDF', details: uploadError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Signed PDF uploaded successfully');

    const { error: updateError } = await supabase
      .from('document_signatures')
      .update({ signed_document_url: filePath })
      .eq('id', signatureRequestId);

    if (updateError) {
      console.error('Update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update signature request' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Signature request updated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Signed PDF generated successfully',
        signed_document_url: filePath,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error generating signed PDF:', error);
    return new Response(
      JSON.stringify({ error: error.message, stack: error.stack }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
