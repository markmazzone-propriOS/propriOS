import { useState, useEffect, useRef } from 'react';
import { X, ZoomIn, ZoomOut, Plus, Ligature as FileSignature, Pen, Calendar, Check, Type } from 'lucide-react';
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
  fieldType: FieldType;
};

interface PDFFieldPlacerProps {
  pdfUrl: string;
  documentName: string;
  signerName: string;
  senderName?: string;
  onComplete: (signatureBoxes: SignatureBox[]) => void;
  onCancel: () => void;
}

export function PDFFieldPlacer({
  pdfUrl,
  documentName,
  signerName,
  onComplete,
  onCancel
}: PDFFieldPlacerProps) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.5);
  const [signatureBoxes, setSignatureBoxes] = useState<SignatureBox[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingBox, setDraggingBox] = useState<SignatureBox | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [currentSigner, setCurrentSigner] = useState<'sender' | 'recipient'>('recipient');
  const [resizingBox, setResizingBox] = useState<{ box: SignatureBox; handle: string } | null>(null);
  const [hoveredBox, setHoveredBox] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    loadPDF();
  }, [pdfUrl]);

  useEffect(() => {
    if (pdfDoc && currentPage) {
      renderPage(currentPage);
    }
  }, [pdfDoc, currentPage, scale, signatureBoxes]);

  const loadPDF = async () => {
    try {
      setLoading(true);
      const loadingTask = pdfjsLib.getDocument(pdfUrl);
      const pdf = await loadingTask.promise;
      setPdfDoc(pdf);
      setNumPages(pdf.numPages);
      setLoading(false);
    } catch (error) {
      console.error('Error loading PDF:', error);
      setLoading(false);
    }
  };

  const renderPage = async (pageNum: number) => {
    if (!pdfDoc || !canvasRef.current) return;

    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }

    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas = canvasRef.current;
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

      context.strokeStyle = boxColor;
      context.lineWidth = 2;
      context.setLineDash(box.signer === 'sender' ? [10, 5] : [5, 5]);
      context.strokeRect(box.x * scale, box.y * scale, box.width * scale, box.height * scale);
      context.setLineDash([]);

      context.fillStyle = `${boxColor}33`;
      context.fillRect(box.x * scale, box.y * scale, box.width * scale, box.height * scale);

      // Only show labels if box is large enough
      if (box.width > 40 && box.height > 15) {
        context.fillStyle = boxColor;
        context.font = `bold ${Math.min(8 * scale, box.height * scale * 0.3)}px sans-serif`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';

        let label = 'SIGNATURE';
        if (box.fieldType === 'initials') label = 'INITIALS';
        if (box.fieldType === 'date') label = 'DATE';
        if (box.fieldType === 'text') label = 'TEXT';

        const signerLabel = box.signer === 'sender' ? 'SENDER' : 'RECIPIENT';

        context.fillText(
          label,
          (box.x + box.width / 2) * scale,
          (box.y + box.height / 2 - 5) * scale
        );

        context.font = `${Math.min(7 * scale, box.height * scale * 0.25)}px sans-serif`;
        context.fillText(
          signerLabel,
          (box.x + box.width / 2) * scale,
          (box.y + box.height / 2 + 6) * scale
        );
      }

      // Draw resize handles if box is hovered or being resized
      const isActiveBox = hoveredBox === box.id || resizingBox?.box.id === box.id;
      if (isActiveBox) {
        const handleSize = 10;

        // White border for handles
        context.strokeStyle = 'white';
        context.lineWidth = 2;
        context.fillStyle = boxColor;

        // Corner handles
        const corners = [
          { x: box.x * scale, y: box.y * scale }, // top-left
          { x: (box.x + box.width) * scale, y: box.y * scale }, // top-right
          { x: box.x * scale, y: (box.y + box.height) * scale }, // bottom-left
          { x: (box.x + box.width) * scale, y: (box.y + box.height) * scale }, // bottom-right
        ];

        corners.forEach(corner => {
          context.fillRect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize);
          context.strokeRect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize);
        });

        // Edge handles
        const edges = [
          { x: (box.x + box.width / 2) * scale, y: box.y * scale }, // top
          { x: (box.x + box.width / 2) * scale, y: (box.y + box.height) * scale }, // bottom
          { x: box.x * scale, y: (box.y + box.height / 2) * scale }, // left
          { x: (box.x + box.width) * scale, y: (box.y + box.height / 2) * scale }, // right
        ];

        edges.forEach(edge => {
          context.fillRect(edge.x - handleSize / 2, edge.y - handleSize / 2, handleSize, handleSize);
          context.strokeRect(edge.x - handleSize / 2, edge.y - handleSize / 2, handleSize, handleSize);
        });

        // Show dimensions when resizing
        if (resizingBox?.box.id === box.id) {
          context.fillStyle = 'rgba(0, 0, 0, 0.75)';
          context.font = `${10 * scale}px sans-serif`;
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          const dimensionText = `${Math.round(box.width)} × ${Math.round(box.height)}`;
          const textWidth = context.measureText(dimensionText).width;
          const padding = 4 * scale;

          // Draw background
          context.fillRect(
            (box.x + box.width / 2) * scale - textWidth / 2 - padding,
            (box.y - 20) * scale - padding,
            textWidth + padding * 2,
            12 * scale + padding * 2
          );

          // Draw text
          context.fillStyle = 'white';
          context.fillText(
            dimensionText,
            (box.x + box.width / 2) * scale,
            (box.y - 20) * scale + 6 * scale
          );
        }
      }
    });
  };

  const getResizeHandle = (x: number, y: number, box: SignatureBox): string | null => {
    // Edge thickness for clicking (10 pixels in screen space)
    const edgeTolerance = 10 / scale;
    // Corner handle size (12 pixels in screen space for easier clicking)
    const cornerTolerance = 12 / scale;

    // Check corners first (higher priority) - use larger tolerance
    if (Math.abs(x - box.x) <= cornerTolerance && Math.abs(y - box.y) <= cornerTolerance) {
      return 'top-left';
    }
    if (Math.abs(x - (box.x + box.width)) <= cornerTolerance && Math.abs(y - box.y) <= cornerTolerance) {
      return 'top-right';
    }
    if (Math.abs(x - box.x) <= cornerTolerance && Math.abs(y - (box.y + box.height)) <= cornerTolerance) {
      return 'bottom-left';
    }
    if (Math.abs(x - (box.x + box.width)) <= cornerTolerance && Math.abs(y - (box.y + box.height)) <= cornerTolerance) {
      return 'bottom-right';
    }

    // Check edges - extend tolerance slightly outside box bounds for easier grabbing
    // Top edge: anywhere along the top within tolerance
    if (Math.abs(y - box.y) <= edgeTolerance && x >= box.x - edgeTolerance && x <= box.x + box.width + edgeTolerance) {
      return 'top';
    }
    // Bottom edge: anywhere along the bottom within tolerance
    if (Math.abs(y - (box.y + box.height)) <= edgeTolerance && x >= box.x - edgeTolerance && x <= box.x + box.width + edgeTolerance) {
      return 'bottom';
    }
    // Left edge: anywhere along the left within tolerance
    if (Math.abs(x - box.x) <= edgeTolerance && y >= box.y - edgeTolerance && y <= box.y + box.height + edgeTolerance) {
      return 'left';
    }
    // Right edge: anywhere along the right within tolerance
    if (Math.abs(x - (box.x + box.width)) <= edgeTolerance && y >= box.y - edgeTolerance && y <= box.y + box.height + edgeTolerance) {
      return 'right';
    }

    return null;
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    // Use expanded bounds for click detection to match hover detection
    const clickTolerance = 12 / scale;
    const clickedBox = signatureBoxes.find(
      box =>
        box.page === currentPage &&
        x >= box.x - clickTolerance &&
        x <= box.x + box.width + clickTolerance &&
        y >= box.y - clickTolerance &&
        y <= box.y + box.height + clickTolerance
    );

    if (clickedBox) {
      const resizeHandle = getResizeHandle(x, y, clickedBox);
      console.log('Clicked box:', clickedBox.id, 'Handle:', resizeHandle, 'Coords:', x, y);

      if (resizeHandle) {
        e.preventDefault();
        console.log('Starting resize with handle:', resizeHandle);
        setResizingBox({ box: clickedBox, handle: resizeHandle });
      } else {
        // Only start dragging if we're actually inside the box (not just near edges)
        if (x >= clickedBox.x && x <= clickedBox.x + clickedBox.width &&
            y >= clickedBox.y && y <= clickedBox.y + clickedBox.height) {
          e.preventDefault();
          console.log('Starting drag');
          setDragOffset({
            x: x - clickedBox.x,
            y: y - clickedBox.y
          });
          setDraggingBox(clickedBox);
        }
      }
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    // Handle resizing
    if (resizingBox) {
      e.preventDefault();
      const { box, handle } = resizingBox;

      // Keep the box hovered while resizing so handles stay visible
      setHoveredBox(box.id);

      // Get the current box from the array to ensure we have the latest state
      const currentBox = signatureBoxes.find(b => b.id === box.id);
      if (!currentBox) {
        console.log('Resize error: current box not found');
        return;
      }

      let newX = currentBox.x;
      let newY = currentBox.y;
      let newWidth = currentBox.width;
      let newHeight = currentBox.height;

      // Calculate the anchor point (opposite corner/edge from the handle being dragged)
      const anchorX = currentBox.x + (handle.includes('right') ? 0 : currentBox.width);
      const anchorY = currentBox.y + (handle.includes('bottom') ? 0 : currentBox.height);

      switch (handle) {
        case 'top-left':
          newX = Math.min(x, anchorX);
          newY = Math.min(y, anchorY);
          newWidth = Math.abs(anchorX - x);
          newHeight = Math.abs(anchorY - y);
          break;
        case 'top-right':
          newX = Math.min(anchorX, x);
          newY = Math.min(y, anchorY);
          newWidth = Math.abs(x - anchorX);
          newHeight = Math.abs(anchorY - y);
          break;
        case 'bottom-left':
          newX = Math.min(x, anchorX);
          newY = Math.min(anchorY, y);
          newWidth = Math.abs(anchorX - x);
          newHeight = Math.abs(y - anchorY);
          break;
        case 'bottom-right':
          newX = Math.min(anchorX, x);
          newY = Math.min(anchorY, y);
          newWidth = Math.abs(x - anchorX);
          newHeight = Math.abs(y - anchorY);
          break;
        case 'top':
          newY = Math.min(y, anchorY);
          newHeight = Math.abs(anchorY - y);
          break;
        case 'bottom':
          newY = Math.min(anchorY, y);
          newHeight = Math.abs(y - anchorY);
          break;
        case 'left':
          newX = Math.min(x, anchorX);
          newWidth = Math.abs(anchorX - x);
          break;
        case 'right':
          newX = Math.min(anchorX, x);
          newWidth = Math.abs(x - anchorX);
          break;
      }

      // Ensure minimum dimensions
      newWidth = Math.max(1, newWidth);
      newHeight = Math.max(1, newHeight);

      console.log('Resizing:', handle, 'New dims:', newWidth, newHeight);

      const updatedBoxes = signatureBoxes.map(b =>
        b.id === currentBox.id
          ? { ...b, x: newX, y: newY, width: newWidth, height: newHeight }
          : b
      );

      setSignatureBoxes(updatedBoxes);

      // Update cursor during resize
      const cursorMap: Record<string, string> = {
        'top-left': 'nw-resize',
        'top-right': 'ne-resize',
        'bottom-left': 'sw-resize',
        'bottom-right': 'se-resize',
        'top': 'n-resize',
        'bottom': 's-resize',
        'left': 'w-resize',
        'right': 'e-resize',
      };
      if (canvas) {
        canvas.style.cursor = cursorMap[handle] || 'move';
      }

      return;
    }

    // Handle dragging
    if (draggingBox) {
      e.preventDefault();

      // Keep the box hovered while dragging
      setHoveredBox(draggingBox.id);

      const currentBox = signatureBoxes.find(b => b.id === draggingBox.id);
      if (!currentBox) return;

      const newX = Math.max(0, Math.min(canvas.width / scale - currentBox.width, x - dragOffset.x));
      const newY = Math.max(0, Math.min(canvas.height / scale - currentBox.height, y - dragOffset.y));

      const updatedBoxes = signatureBoxes.map(box =>
        box.id === draggingBox.id
          ? { ...box, x: newX, y: newY }
          : box
      );

      setSignatureBoxes(updatedBoxes);

      // Maintain move cursor during drag
      if (canvas) {
        canvas.style.cursor = 'move';
      }

      return;
    }

    // Update hovered box for showing resize handles (only when not dragging/resizing)
    // Check if mouse is inside OR near the edges of any box
    const hoverTolerance = 12 / scale;
    const hoveredBoxFound = signatureBoxes.find(
      box =>
        box.page === currentPage &&
        x >= box.x - hoverTolerance &&
        x <= box.x + box.width + hoverTolerance &&
        y >= box.y - hoverTolerance &&
        y <= box.y + box.height + hoverTolerance
    );

    setHoveredBox(hoveredBoxFound?.id || null);

    // Update cursor based on what's being hovered
    const cursorMap: Record<string, string> = {
      'top-left': 'nw-resize',
      'top-right': 'ne-resize',
      'bottom-left': 'sw-resize',
      'bottom-right': 'se-resize',
      'top': 'n-resize',
      'bottom': 's-resize',
      'left': 'w-resize',
      'right': 'e-resize',
    };

    if (hoveredBoxFound) {
      const handle = getResizeHandle(x, y, hoveredBoxFound);
      if (handle) {
        canvas.style.cursor = cursorMap[handle] || 'move';
      } else {
        canvas.style.cursor = 'move';
      }
    } else {
      canvas.style.cursor = 'crosshair';
    }
  };

  const handleCanvasMouseUp = (e?: React.MouseEvent<HTMLCanvasElement>) => {
    if (e) e.preventDefault();
    setDraggingBox(null);
    setResizingBox(null);
    setDragOffset({ x: 0, y: 0 });
  };

  const addSignatureBox = (fieldType: FieldType) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let width = 120;
    let height = 40;

    if (fieldType === 'initials') {
      width = 60;
      height = 35;
    } else if (fieldType === 'date') {
      width = 90;
      height = 28;
    } else if (fieldType === 'text') {
      width = 140;
      height = 28;
    }

    const newBox: SignatureBox = {
      id: `box-${Date.now()}`,
      page: currentPage,
      x: 50,
      y: 50,
      width,
      height,
      signer: currentSigner,
      signed: false,
      fieldType
    };

    setSignatureBoxes([...signatureBoxes, newBox]);
  };

  const removeBox = (boxId: string) => {
    setSignatureBoxes(signatureBoxes.filter(box => box.id !== boxId));
  };

  const handleComplete = () => {
    if (signatureBoxes.length === 0) {
      alert('Please add at least one signature field before completing.');
      return;
    }
    onComplete(signatureBoxes);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-pulse text-center">
            <div className="text-lg font-semibold text-gray-900">Loading document...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-95 z-50 flex flex-col">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900">{documentName}</h2>
            <p className="text-sm text-gray-600 mt-1">
              Place signature fields for sender and recipient. Drag to move, resize from corners/edges to fit.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
              <button
                onClick={() => setScale(s => Math.max(0.5, s - 0.25))}
                className="p-1 hover:bg-gray-200 rounded transition"
              >
                <ZoomOut size={18} />
              </button>
              <span className="text-sm font-medium w-12 text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={() => setScale(s => Math.min(3, s + 0.25))}
                className="p-1 hover:bg-gray-200 rounded transition"
              >
                <ZoomIn size={18} />
              </button>
            </div>
            <button
              onClick={onCancel}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <X size={24} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-gray-800 p-8" ref={containerRef}>
        <div className="max-w-5xl mx-auto bg-white shadow-2xl">
          <canvas
            ref={canvasRef}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            className="w-full"
          />
        </div>
      </div>

      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 rounded transition"
              >
                Previous
              </button>
              <span className="text-sm text-gray-700">
                Page {currentPage} of {numPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
                disabled={currentPage === numPages}
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 rounded transition"
              >
                Next
              </button>
            </div>

            <div className="h-6 w-px bg-gray-300" />

            <div className="flex items-center gap-3">
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setCurrentSigner('recipient')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                    currentSigner === 'recipient'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Recipient
                </button>
                <button
                  onClick={() => setCurrentSigner('sender')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                    currentSigner === 'sender'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Sender
                </button>
              </div>
            </div>

            <div className="h-6 w-px bg-gray-300" />

            <div className="flex items-center gap-2">
              <button
                onClick={() => addSignatureBox('signature')}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                <FileSignature size={18} />
                Add Signature
              </button>
              <button
                onClick={() => addSignatureBox('initials')}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition"
              >
                <Pen size={18} />
                Add Initials
              </button>
              <button
                onClick={() => addSignatureBox('date')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <Calendar size={18} />
                Add Date
              </button>
              <button
                onClick={() => addSignatureBox('text')}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
              >
                <Type size={18} />
                Add Text
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-600">
              {signatureBoxes.length} field{signatureBoxes.length !== 1 ? 's' : ''} placed
            </div>
            {signatureBoxes.length > 0 && (
              <button
                onClick={() => setSignatureBoxes([])}
                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
              >
                Clear All
              </button>
            )}
            <button
              onClick={handleComplete}
              disabled={signatureBoxes.length === 0}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
            >
              <Check size={18} />
              Complete Setup
            </button>
          </div>
        </div>
      </div>

      {signatureBoxes.length > 0 && (
        <div className="fixed right-6 top-24 bg-white rounded-lg shadow-lg p-4 max-w-xs max-h-96 overflow-y-auto">
          <h3 className="font-semibold text-gray-900 mb-3">Placed Fields</h3>
          <div className="space-y-2">
            {signatureBoxes.map((box, index) => (
              <div key={box.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {box.fieldType === 'signature' && 'Signature'}
                    {box.fieldType === 'initials' && 'Initials'}
                    {box.fieldType === 'date' && 'Date'}
                    {box.fieldType === 'text' && 'Text Field'}
                  </p>
                  <p className="text-xs text-gray-500">
                    Page {box.page} • {box.signer === 'sender' ? 'Sender' : 'Recipient'}
                  </p>
                </div>
                <button
                  onClick={() => removeBox(box.id)}
                  className="text-red-600 hover:bg-red-50 p-1 rounded transition"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
