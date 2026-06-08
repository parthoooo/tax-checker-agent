import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle2, FileText, Loader2, PenLine, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { loadSignatureRequests, upsertSignatureRequest } from '@/utils/signNowService';
import type { SignatureRequest } from '@/utils/signNowService';

// ─── Canvas Signature Component ───────────────────────────────────────────────

interface SignatureCanvasProps {
  onDrawn: (hasContent: boolean) => void;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

const SignatureCanvas: React.FC<SignatureCanvasProps> = ({ onDrawn, canvasRef }) => {
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const getPos = (canvas: HTMLCanvasElement, clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    isDrawing.current = true;
    lastPos.current = { x, y };
    const ctx = canvas.getContext('2d')!;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (x: number, y: number) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1e3a5f';
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
    lastPos.current = { x, y };
    onDrawn(true);
  };

  const stopDraw = () => { isDrawing.current = false; };

  // Mouse events
  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getPos(e.currentTarget, e.clientX, e.clientY);
    startDraw(x, y);
  };
  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getPos(e.currentTarget, e.clientX, e.clientY);
    draw(x, y);
  };
  const onMouseUp   = () => stopDraw();
  const onMouseLeave = () => stopDraw();

  // Touch events — attached imperatively so we can use passive:false to allow preventDefault
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      const { x, y } = getPos(canvas, touch.clientX, touch.clientY);
      startDraw(x, y);
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      const { x, y } = getPos(canvas, touch.clientX, touch.clientY);
      draw(x, y);
    };
    const onTouchEnd = () => stopDraw();

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove',  onTouchMove,  { passive: false });
    canvas.addEventListener('touchend',   onTouchEnd);

    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove',  onTouchMove);
      canvas.removeEventListener('touchend',   onTouchEnd);
    };
  }, [canvasRef]);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={180}
      className="w-full border-2 border-gray-300 rounded-lg bg-white cursor-crosshair touch-none"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      style={{ maxHeight: '180px' }}
    />
  );
};

// ─── IP fetch helper ──────────────────────────────────────────────────────────

async function fetchClientIp(): Promise<string> {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    return data.ip ?? '0.0.0.0';
  } catch {
    return '0.0.0.0';
  }
}

// ─── States ───────────────────────────────────────────────────────────────────

const InvalidState: React.FC<{ preparerEmail?: string }> = ({ preparerEmail }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
    <Card className="w-full max-w-md text-center">
      <CardContent className="pt-8 pb-8 space-y-4">
        <XCircle className="w-12 h-12 text-red-400 mx-auto" />
        <h2 className="text-xl font-semibold text-gray-800">Link Invalid or Expired</h2>
        <p className="text-sm text-gray-500">This signature request is invalid or has expired.</p>
        <p className="text-sm text-gray-500">Please contact your tax preparer.</p>
        {preparerEmail && <p className="text-sm font-medium text-blue-700">{preparerEmail}</p>}
        <p className="text-xs text-gray-400 mt-4">Broder-Mansoor & Associates · Powered by SJ Innovation AI</p>
      </CardContent>
    </Card>
  </div>
);

const ConfirmedState: React.FC<{ req: SignatureRequest }> = ({ req }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
    <Card className="w-full max-w-md">
      <CardContent className="pt-8 pb-8 space-y-4 text-center">
        <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto" />
        <h2 className="text-2xl font-bold text-gray-900">Signature Received</h2>
        <div className="text-left bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
          <div><span className="text-gray-500">Document:</span> <span className="font-medium">{req.documentName}</span></div>
          <div><span className="text-gray-500">Signed by:</span> <span className="font-medium">{req.signerName}</span></div>
          <div>
            <span className="text-gray-500">Date:</span>{' '}
            <span className="font-medium">
              {req.signedAt ? new Date(req.signedAt).toLocaleString('en-US', {
                month: 'long', day: 'numeric', year: 'numeric',
                hour: 'numeric', minute: '2-digit',
              }) : '—'}
            </span>
          </div>
          <div><span className="text-gray-500">IP Address:</span> <span className="font-medium">{req.signerIp}</span></div>
        </div>
        <p className="text-sm text-gray-500">
          This confirmation has been sent to{' '}
          <span className="font-medium text-blue-700">{req.preparerEmail}</span>.
        </p>
        <p className="text-xs text-gray-400 pt-2">Powered by SJ Innovation AI</p>
      </CardContent>
    </Card>
  </div>
);

const DeclinedState: React.FC<{ req: SignatureRequest }> = ({ req }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
    <Card className="w-full max-w-md text-center">
      <CardContent className="pt-8 pb-8 space-y-4">
        <XCircle className="w-12 h-12 text-red-400 mx-auto" />
        <h2 className="text-xl font-semibold text-gray-800">You have declined to sign this document.</h2>
        <p className="text-sm text-gray-500">
          If this was a mistake, please contact your preparer at{' '}
          <span className="font-medium text-blue-700">{req.preparerEmail}</span>.
        </p>
        <p className="text-xs text-gray-400 mt-4">Powered by SJ Innovation AI</p>
      </CardContent>
    </Card>
  </div>
);

// ─── Main SigningPage ─────────────────────────────────────────────────────────

const SigningPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const isConfirmed = location.pathname.endsWith('/confirmed');
  const isDeclined  = location.pathname.endsWith('/declined');

  const [req, setReq]           = useState<SignatureRequest | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [fullName, setFullName] = useState('');
  const [hasDrawn, setHasDrawn] = useState(false);
  const [signing, setSigning]   = useState(false);
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!id) { setNotFound(true); return; }
    const requests = loadSignatureRequests();
    const found = requests.find(r => r.id === id);
    if (!found) { setNotFound(true); return; }
    setReq(found);
  }, [id]);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleSign = async () => {
    if (!req) return;
    if (!hasDrawn) { toast.error('Please draw your signature'); return; }
    if (!fullName.trim()) { toast.error('Please enter your full name'); return; }

    setSigning(true);
    const ip = await fetchClientIp();

    const updated: SignatureRequest = {
      ...req,
      status:     'signed',
      signedAt:   new Date().toISOString(),
      signerIp:   ip,
      signerName: fullName.trim(),
    };
    upsertSignatureRequest(updated);
    setReq(updated);
    setSigning(false);
    navigate(`/sign/${id}/confirmed`);
  };

  const handleDecline = () => {
    if (!req) return;
    const updated: SignatureRequest = {
      ...req,
      status:   'declined',
      signedAt: new Date().toISOString(),
    };
    upsertSignatureRequest(updated);
    setReq(updated);
    setShowDeclineDialog(false);
    navigate(`/sign/${id}/declined`);
  };

  // ── Resolved states ──────────────────────────────────────────────────────

  if (notFound || (req && req.status === 'expired')) {
    return <InvalidState preparerEmail={req?.preparerEmail} />;
  }

  if (!req) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (isConfirmed || req.status === 'signed') {
    return <ConfirmedState req={req} />;
  }

  if (isDeclined || req.status === 'declined') {
    return <DeclinedState req={req} />;
  }

  // ── Active signing page (State A) ────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#0f1f3d] text-white px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Broder-Mansoor & Associates</h1>
            <p className="text-xs text-blue-200/70">Secure Document Signing Portal</p>
          </div>
          <p className="text-xs text-blue-200/60">Powered by SJ Innovation AI</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Intro */}
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Document Signature Request</h2>
          <p className="text-sm text-gray-500 mt-1">
            <span className="font-medium text-gray-700">Broder-Mansoor & Associates</span> is requesting your signature on:
          </p>
        </div>

        {/* Document card */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start gap-3">
              <FileText className="w-8 h-8 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-900 text-lg">{req.documentName}</p>
                <p className="text-sm text-blue-700 mt-1">
                  Sent by {req.preparer} · Expires {new Date(req.expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
                {req.noteToClient && (
                  <p className="text-sm text-blue-800 mt-2 italic">&ldquo;{req.noteToClient}&rdquo;</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Document preview placeholder */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg h-48 flex flex-col items-center justify-center text-center bg-white gap-2">
          <FileText className="w-10 h-10 text-gray-300" />
          <p className="text-sm text-gray-400 font-medium">{req.documentName}</p>
          <p className="text-xs text-gray-300">Document preview requires SignNow integration</p>
        </div>

        {/* Signature section */}
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            By signing below, you confirm you have reviewed this document and agree to its contents.
          </p>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Your Signature</Label>
              <Button size="sm" variant="ghost" className="text-xs text-gray-400" onClick={clearCanvas}>
                Clear
              </Button>
            </div>
            <SignatureCanvas canvasRef={canvasRef} onDrawn={setHasDrawn} />
            <p className="text-xs text-gray-400">Draw your signature above using mouse or touch</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fullname">Full Name <span className="text-red-500">*</span></Label>
            <Input
              id="fullname"
              placeholder="Type your full legal name"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="space-y-3 pb-8">
          <Button
            className="w-full bg-green-600 hover:bg-green-700 text-white h-12 text-base"
            onClick={handleSign}
            disabled={signing}
          >
            {signing
              ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Signing…</>
              : <><PenLine className="w-5 h-5 mr-2" /> Sign Document</>
            }
          </Button>
          <Button
            className="w-full h-10"
            variant="outline"
            onClick={() => setShowDeclineDialog(true)}
            disabled={signing}
          >
            Decline
          </Button>
        </div>

        <p className="text-xs text-center text-gray-400 pb-4">
          Questions? Contact {req.preparer} at {req.preparerEmail}
        </p>
      </div>

      {/* Decline confirmation dialog */}
      <Dialog open={showDeclineDialog} onOpenChange={setShowDeclineDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Decline to Sign?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Are you sure you want to decline to sign this document? Your preparer will be notified.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDeclineDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDecline}>Yes, Decline</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SigningPage;
