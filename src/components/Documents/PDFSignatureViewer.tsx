import { useState, useEffect, useRef } from 'react';
import { X, ZoomIn, ZoomOut, Check, Pen, Type, Plus, Calendar, FileSignature } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

type FieldType = 'signature' | 'initials' | 'date' | 'text';

type SignatureBox = {
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  signer: string;
  signed: boolean;
  signatureData?: string;
  signatureType?: 'drawn' | 'typed';
  fieldType: FieldType;
};

interface PDFSignatureViewerProps {
  pdfUrl: string;
  documentName: string;
  signerName: string;
  predefinedBoxes?: SignatureBox[];
  userRole?: 'sender' | 'recipient';
  onSign: (signatureData: string, signatureType: 'drawn' | 'typed', signedPdfBlob?: Blob, signatureBoxes?: SignatureBox[]) => void;
  onCancel: () => void;
}

export function PDFSignatureViewer({
  pdfUrl,
  documentName,
  signerName,
  predefinedBoxes,
  userRole = 'recipient',
  onSign,
  onCancel
}: PDFSignatureViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.5);
  const [signatureBoxes, setSignatureBoxes] = useState<SignatureBox[]>(predefinedBoxes || []);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [selectedBox, setSelectedBox] = useState<SignatureBox | null>(null);
  const [signatureType, setSignatureType] = useState<'drawn' | 'typed'>('drawn');
  const [typedSignature, setTypedSignature] = useState(signerName);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [draggingBox, setDraggingBox] = useState<SignatureBox | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [typedInitials, setTypedInitials] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    loadPDF();
  }, [pdfUrl]);

  useEffect(() => {
    console.log('PDFSignatureViewer: predefinedBoxes received:', predefinedBoxes);
    if (predefinedBoxes && predefinedBoxes.length > 0) {
      console.log('PDFSignatureViewer: Setting signature boxes to:', predefinedBoxes);
      setSignatureBoxes(predefinedBoxes);
    } else {
      console.log('PDFSignatureViewer: No predefinedBoxes provided or empty array');
    }
  }, [predefinedBoxes]);

  useEffect(() => {
    if (pdfDoc && currentPage) {
      renderPage(currentPage);
    }
  }, [pdfDoc, currentPage, scale, signatureBoxes]);

  useEffect(() => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [showSignatureModal]);

  const loadPDF = async () => {
    try {
      console.log('PDFSignatureViewer: Starting to load PDF from:', pdfUrl);
      setLoading(true);
      const loadingTask = pdfjsLib.getDocument(pdfUrl);
      const pdf = await loadingTask.promise;
      console.log('PDFSignatureViewer: PDF loaded successfully, pages:', pdf.numPages);
      setPdfDoc(pdf);
      setNumPages(pdf.numPages);

      if (!predefinedBoxes || predefinedBoxes.length === 0) {
        const boxes: SignatureBox[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          boxes.push({
            id: `${i}-signature`,
            page: i,
            x: 50,
            y: 700,
            width: 200,
            height: 60,
            signer: signerName,
            signed: false,
            fieldType: 'signature'
          });
        }
        setSignatureBoxes(boxes);
        console.log('PDFSignatureViewer: No predefined boxes, created default boxes:', boxes.length);
      } else {
        console.log('PDFSignatureViewer: Using predefined boxes from props:', predefinedBoxes.length);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error loading PDF:', error);
      alert('Failed to load PDF: ' + error);
      setLoading(false);
    }
  };

  const renderPage = async (pageNum: number) => {
    if (!pdfDoc) return;

    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }

    const page = await pdfDoc.getPage(pageNum);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const viewport = page.getViewport({ scale });
    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    renderTaskRef.current = page.render({
      canvasContext: context,
      viewport: viewport
    });

    try {
      await renderTaskRef.current.promise;
      renderTaskRef.current = null;
    } catch (error: any) {
      if (error.name !== 'RenderingCancelledException') {
        console.error('Error rendering page:', error);
      }
      return;
    }

    const pageBoxes = signatureBoxes.filter(box => box.page === pageNum);
    pageBoxes.forEach(box => {
      let boxColor = '#ef4444';
      if (box.fieldType === 'initials') boxColor = '#f59e0b';
      if (box.fieldType === 'date') boxColor = '#3b82f6';
      if (box.fieldType === 'text') boxColor = '#8b5cf6';
      if (box.signed) boxColor = '#10b981';

      context.strokeStyle = boxColor;
      context.lineWidth = 2;
      context.strokeRect(box.x * scale, box.y * scale, box.width * scale, box.height * scale);

      const fillOpacity = box.signed ? 0.1 : 0.1;
      if (box.signed) {
        context.fillStyle = 'rgba(16, 185, 129, ' + fillOpacity + ')';
      } else if (box.fieldType === 'initials') {
        context.fillStyle = 'rgba(245, 158, 11, ' + fillOpacity + ')';
      } else if (box.fieldType === 'date') {
        context.fillStyle = 'rgba(59, 130, 246, ' + fillOpacity + ')';
      } else if (box.fieldType === 'text') {
        context.fillStyle = 'rgba(139, 92, 246, ' + fillOpacity + ')';
      } else {
        context.fillStyle = 'rgba(239, 68, 68, ' + fillOpacity + ')';
      }
      context.fillRect(box.x * scale, box.y * scale, box.width * scale, box.height * scale);

      if (box.signed && box.signatureData) {
        const deleteButtonSize = 20 * scale;
        const deleteButtonX = (box.x + box.width - deleteButtonSize / scale - 5) * scale;
        const deleteButtonY = (box.y + 5) * scale;

        context.fillStyle = '#ef4444';
        context.beginPath();
        context.arc(deleteButtonX + deleteButtonSize / 2, deleteButtonY + deleteButtonSize / 2, deleteButtonSize / 2, 0, 2 * Math.PI);
        context.fill();

        context.strokeStyle = 'white';
        context.lineWidth = 2;
        const xSize = 6 * scale;
        context.beginPath();
        context.moveTo(deleteButtonX + deleteButtonSize / 2 - xSize / 2, deleteButtonY + deleteButtonSize / 2 - xSize / 2);
        context.lineTo(deleteButtonX + deleteButtonSize / 2 + xSize / 2, deleteButtonY + deleteButtonSize / 2 + xSize / 2);
        context.moveTo(deleteButtonX + deleteButtonSize / 2 + xSize / 2, deleteButtonY + deleteButtonSize / 2 - xSize / 2);
        context.lineTo(deleteButtonX + deleteButtonSize / 2 - xSize / 2, deleteButtonY + deleteButtonSize / 2 + xSize / 2);
        context.stroke();


        if (box.fieldType === 'date') {
          context.font = `${12 * scale}px sans-serif`;
          context.fillStyle = '#1f2937';
          context.textAlign = 'center';
          context.fillText(
            box.signatureData,
            (box.x + box.width / 2) * scale,
            (box.y + box.height / 2 + 3) * scale
          );
        } else if (box.signatureType === 'drawn') {
          const img = new Image();
          img.src = box.signatureData;
          img.onload = () => {
            context.drawImage(img, box.x * scale, box.y * scale, box.width * scale, box.height * scale);
          };
        } else {
          const fontSize = box.fieldType === 'initials' ? 14 : 16;
          context.font = `${fontSize * scale}px "Brush Script MT", cursive`;
          context.fillStyle = '#1f2937';
          context.textAlign = 'center';
          context.fillText(
            box.signatureData || '',
            (box.x + box.width / 2) * scale,
            (box.y + box.height / 2 + 5) * scale
          );
        }
      } else {
        context.font = `${9 * scale}px sans-serif`;
        context.fillStyle = box.signer === userRole ? '#6b7280' : '#9ca3af';
        context.textAlign = 'center';
        let label = 'Signature';
        if (box.fieldType === 'initials') label = 'Initials';
        if (box.fieldType === 'date') label = 'Date';
        if (box.fieldType === 'text') label = 'Text Field';
        context.fillText(
          label,
          (box.x + box.width / 2) * scale,
          (box.y + box.height / 2 - 6) * scale
        );
        context.font = `${7 * scale}px sans-serif`;
        const signerLabel = box.signer === 'sender' ? 'Sender' : 'Recipient';
        context.fillText(
          signerLabel,
          (box.x + box.width / 2) * scale,
          (box.y + box.height / 2 + 5) * scale
        );
        if (box.signer === userRole) {
          context.font = `${7 * scale}px sans-serif`;
          context.fillText(
            'Click to sign',
            (box.x + box.width / 2) * scale,
            (box.y + box.height / 2 + 13) * scale
          );
        }
      }
    });
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    const clickedBox = signatureBoxes.find(
      box =>
        box.page === currentPage &&
        x >= box.x &&
        x <= box.x + box.width &&
        y >= box.y &&
        y <= box.y + box.height
    );

    if (clickedBox) {
      setDraggingBox(clickedBox);
      setDragOffset({
        x: x - clickedBox.x,
        y: y - clickedBox.y
      });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!draggingBox) return;

    if (predefinedBoxes && predefinedBoxes.length > 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    const newX = Math.max(0, Math.min(canvas.width / scale - draggingBox.width, x - dragOffset.x));
    const newY = Math.max(0, Math.min(canvas.height / scale - draggingBox.height, y - dragOffset.y));

    const updatedBoxes = signatureBoxes.map(box =>
      box.id === draggingBox.id
        ? { ...box, x: newX, y: newY }
        : box
    );

    setSignatureBoxes(updatedBoxes);
    setDraggingBox({ ...draggingBox, x: newX, y: newY });
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggingBox) {
      const canvas = canvasRef.current;
      if (!canvas) {
        setDraggingBox(null);
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top) / scale;

      const hasMoved = Math.abs(draggingBox.x - (signatureBoxes.find(b => b.id === draggingBox.id)?.x || 0)) > 5 ||
                       Math.abs(draggingBox.y - (signatureBoxes.find(b => b.id === draggingBox.id)?.y || 0)) > 5;

      if (!hasMoved) {
        if (draggingBox.signed) {
          const deleteButtonSize = 20;
          const deleteButtonX = draggingBox.x + draggingBox.width - deleteButtonSize - 5;
          const deleteButtonY = draggingBox.y + 5;

          const clickedDelete = x >= deleteButtonX &&
                               x <= deleteButtonX + deleteButtonSize &&
                               y >= deleteButtonY &&
                               y <= deleteButtonY + deleteButtonSize;

          if (clickedDelete) {
            const updatedBoxes = signatureBoxes.map(box =>
              box.id === draggingBox.id
                ? { ...box, signed: false, signatureData: undefined, signatureType: undefined }
                : box
            );
            setSignatureBoxes(updatedBoxes);
            setDraggingBox(null);
            return;
          }
        }

        if (draggingBox.signer !== userRole) {
          setDraggingBox(null);
          return;
        }

        setSelectedBox(draggingBox);
        setShowSignatureModal(true);
        setHasDrawn(false);
        if (draggingBox.fieldType === 'signature') {
          setTypedSignature(signerName);
        } else if (draggingBox.fieldType === 'initials') {
          const initials = signerName.split(' ').map(n => n[0]).join('');
          setTypedInitials(initials);
        } else if (draggingBox.fieldType === 'date') {
          setSelectedDate(new Date().toISOString().split('T')[0]);
        }
      }

      setDraggingBox(null);
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    setIsDrawing(true);
    setHasDrawn(true);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleSignBox = () => {
    if (!selectedBox) return;

    let signatureData: string;
    let sigType: 'drawn' | 'typed';

    if (selectedBox.fieldType === 'date') {
      signatureData = selectedDate;
      sigType = 'typed';
    } else if (selectedBox.fieldType === 'text') {
      if (!typedSignature.trim()) return;
      signatureData = typedSignature.trim();
      sigType = 'typed';
    } else if (signatureType === 'drawn') {
      const canvas = signatureCanvasRef.current;
      if (!canvas || !hasDrawn) return;
      signatureData = canvas.toDataURL('image/png');
      sigType = 'drawn';
    } else {
      if (selectedBox.fieldType === 'initials') {
        if (!typedInitials.trim()) return;
        signatureData = typedInitials.trim();
      } else {
        if (!typedSignature.trim()) return;
        signatureData = typedSignature.trim();
      }
      sigType = 'typed';
    }

    const updatedBoxes = signatureBoxes.map(box =>
      box.id === selectedBox.id
        ? { ...box, signed: true, signatureData, signatureType: sigType }
        : box
    );

    setSignatureBoxes(updatedBoxes);
    setShowSignatureModal(false);
    setSelectedBox(null);
  };

  const addField = (fieldType: FieldType) => {
    const newId = `${currentPage}-${fieldType}-${Date.now()}`;
    let width = 200;
    let height = 60;

    if (fieldType === 'initials') {
      width = 80;
      height = 50;
    } else if (fieldType === 'date') {
      width = 150;
      height = 40;
    }

    const newBox: SignatureBox = {
      id: newId,
      page: currentPage,
      x: 100,
      y: 100,
      width,
      height,
      signer: signerName,
      signed: false,
      fieldType
    };

    setSignatureBoxes([...signatureBoxes, newBox]);
  };

  const handleCompleteDocument = async () => {
    const userBoxes = signatureBoxes.filter(box => box.signer === userRole);
    const allSigned = userBoxes.every(box => box.signed);
    if (!allSigned) {
      alert('Please sign all your signature boxes before completing the document.');
      return;
    }

    const firstBox = signatureBoxes[0];
    if (firstBox.signatureData && firstBox.signatureType) {
      onSign(firstBox.signatureData, firstBox.signatureType, undefined, signatureBoxes);
    }
  };

  const generateSignedPDF = async (): Promise<Blob> => {
    if (!pdfDoc || !canvasRef.current) {
      throw new Error('PDF document or canvas not loaded');
    }

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get canvas context');

    const pdfBlob = await fetch(pdfUrl).then(r => r.blob());
    const pdfArrayBuffer = await pdfBlob.arrayBuffer();
    const loadedPdf = await pdfjsLib.getDocument({ data: pdfArrayBuffer }).promise;

    const pdfPages: ImageData[] = [];

    for (let pageNum = 1; pageNum <= loadedPdf.numPages; pageNum++) {
      const page = await loadedPdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 });

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({ canvasContext: context, viewport }).promise;

      const pageBoxes = signatureBoxes.filter(box => box.page === pageNum);

      for (const box of pageBoxes) {
        if (box.signed && box.signatureData) {
          const scale = 2.0;
          if (box.fieldType === 'date') {
            context.font = `${16 * scale}px sans-serif`;
            context.fillStyle = '#1f2937';
            context.textAlign = 'center';
            context.fillText(
              box.signatureData,
              (box.x + box.width / 2) * scale,
              (box.y + box.height / 2 + 5) * scale
            );
          } else if (box.signatureType === 'drawn') {
            const img = new Image();
            img.src = box.signatureData;
            await new Promise<void>((resolve) => {
              img.onload = () => {
                context.drawImage(img, box.x * scale, box.y * scale, box.width * scale, box.height * scale);
                resolve();
              };
            });
          } else {
            const fontSize = box.fieldType === 'initials' ? 20 : 24;
            context.font = `${fontSize * scale}px "Brush Script MT", cursive`;
            context.fillStyle = '#1f2937';
            context.textAlign = 'center';
            context.fillText(
              box.signatureData || '',
              (box.x + box.width / 2) * scale,
              (box.y + box.height / 2 + 8) * scale
            );
          }
        }
      }

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      pdfPages.push(imageData);
    }

    return new Blob([canvas.toDataURL('image/png')], { type: 'application/pdf' });
  };

  const userBoxes = signatureBoxes.filter(box => box.signer === userRole);
  const allSigned = userBoxes.length > 0 && userBoxes.every(box => box.signed);

  let isValid = false;
  if (selectedBox) {
    if (selectedBox.fieldType === 'date') {
      isValid = selectedDate.length > 0;
    } else if (selectedBox.fieldType === 'text') {
      isValid = typedSignature.trim().length > 0;
    } else if (signatureType === 'drawn') {
      isValid = hasDrawn;
    } else {
      if (selectedBox.fieldType === 'initials') {
        isValid = typedInitials.trim().length > 0;
      } else {
        isValid = typedSignature.trim().length > 0;
      }
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading document...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-900">{documentName}</h2>
          <p className="text-sm text-gray-600 mt-1">
            {predefinedBoxes && predefinedBoxes.length > 0
              ? 'Click on the highlighted fields to sign'
              : 'Add fields, drag to position, then click to fill'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {(!predefinedBoxes || predefinedBoxes.length === 0) && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => addField('signature')}
                className="flex items-center gap-1 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
              >
                <FileSignature className="w-4 h-4" />
                Signature
              </button>
              <button
                onClick={() => addField('initials')}
                className="flex items-center gap-1 px-3 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors text-sm font-medium"
              >
                <Pen className="w-4 h-4" />
                Initials
              </button>
              <button
                onClick={() => addField('date')}
                className="flex items-center gap-1 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
              >
                <Calendar className="w-4 h-4" />
                Date
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setScale(Math.max(0.5, scale - 0.25))}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ZoomOut className="w-5 h-5" />
            </button>
            <span className="text-sm text-gray-600 min-w-[60px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale(Math.min(3, scale + 0.25))}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ZoomIn className="w-5 h-5" />
            </button>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-gray-800 p-8">
        <div ref={containerRef} className="max-w-4xl mx-auto">
          <canvas
            ref={canvasRef}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            className={`bg-white shadow-2xl mx-auto block ${predefinedBoxes && predefinedBoxes.length > 0 ? 'cursor-pointer' : 'cursor-move'}`}
          />

          <div className="flex items-center justify-center gap-4 mt-6">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-white text-gray-700 rounded-lg font-medium hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="text-white font-medium">
              Page {currentPage} of {numPages}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(numPages, currentPage + 1))}
              disabled={currentPage === numPages}
              className="px-4 py-2 bg-white text-gray-700 rounded-lg font-medium hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {signatureBoxes.filter(b => b.signed).length} of {signatureBoxes.length} signatures completed
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="px-6 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCompleteDocument}
            disabled={!allSigned}
            className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Check className="w-5 h-5" />
            Complete Document
          </button>
        </div>
      </div>

      {showSignatureModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">
                {selectedBox?.fieldType === 'date' ? 'Add Date' :
                 selectedBox?.fieldType === 'initials' ? 'Add Initials' :
                 selectedBox?.fieldType === 'text' ? 'Add Text' : 'Add Signature'}
              </h3>
              <button
                onClick={() => setShowSignatureModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {selectedBox?.fieldType === 'date' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Select Date
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              ) : selectedBox?.fieldType === 'text' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Enter Text
                  </label>
                  <input
                    type="text"
                    value={typedSignature}
                    onChange={(e) => setTypedSignature(e.target.value)}
                    placeholder="Type your text here..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              ) : (
                <>
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      {selectedBox?.fieldType === 'initials' ? 'Initials Method' : 'Signature Method'}
                    </label>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setSignatureType('drawn')}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                          signatureType === 'drawn'
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <Pen className="w-5 h-5" />
                        <span className="font-medium">Draw</span>
                      </button>
                      <button
                        onClick={() => setSignatureType('typed')}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                          signatureType === 'typed'
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <Type className="w-5 h-5" />
                        <span className="font-medium">Type</span>
                      </button>
                    </div>
                  </div>

                  {signatureType === 'drawn' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Draw your signature below
                  </label>
                  <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-white">
                    <canvas
                      ref={signatureCanvasRef}
                      width={600}
                      height={200}
                      className="w-full cursor-crosshair touch-none"
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                    />
                  </div>
                  <div className="flex justify-end mt-3">
                    <button
                      onClick={clearCanvas}
                      className="text-sm text-gray-600 hover:text-gray-900 underline"
                    >
                      Clear signature
                    </button>
                  </div>
                </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        {selectedBox?.fieldType === 'initials' ? 'Type your initials' : 'Type your full name'}
                      </label>
                      <input
                        type="text"
                        value={selectedBox?.fieldType === 'initials' ? typedInitials : typedSignature}
                        onChange={(e) => selectedBox?.fieldType === 'initials' ? setTypedInitials(e.target.value) : setTypedSignature(e.target.value)}
                        placeholder={selectedBox?.fieldType === 'initials' ? 'Enter your initials' : 'Enter your full name'}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-2xl font-cursive"
                        style={{ fontFamily: 'Brush Script MT, cursive' }}
                      />
                    </div>
                  )}
                </>
              )}

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setShowSignatureModal(false)}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSignBox}
                  disabled={!isValid}
                  className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5" />
                  {selectedBox?.fieldType === 'date' ? 'Add Date' :
                   selectedBox?.fieldType === 'initials' ? 'Add Initials' :
                   selectedBox?.fieldType === 'text' ? 'Add Text' : 'Add Signature'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
