// ─── SignNow Integration Stub ──────────────────────────────────────────────────
//
// SIGNNOW INTEGRATION POINT
// When ready, install the SignNow JS SDK or call the REST API:
//   POST https://api.signnow.com/document        → upload PDF template
//   POST https://api.signnow.com/document/{id}/invite → send signing invite
//
// Steps to go live:
//   1. Add VITE_SIGNNOW_API_KEY=<key> to your .env
//   2. Replace createSignatureRequest() body below with the real fetch calls
//   3. Replace getSignatureStatus() body with a real status poll or webhook handler
//   4. Everything else in the app (ESignaturePage, SigningPage) requires NO changes.
//
// ─────────────────────────────────────────────────────────────────────────────

export interface SignatureRequest {
  id: string;
  clientName: string;
  clientEmail: string;
  documentName: string;
  documentType: 'form-8879' | 'state-equivalent' | 'engagement-letter' | 'poa';
  preparer: string;
  preparerEmail: string;
  createdAt: string;
  expiresAt: string;
  status: 'pending' | 'signed' | 'declined' | 'expired';
  signedAt?: string;
  signerIp?: string;
  signerName?: string;
  noteToClient?: string;
}

// SIGNNOW INTEGRATION POINT
// Replace this mock with real SignNow document creation + invite dispatch.
// The real implementation would:
//   1. Upload the PDF to SignNow → get document_id
//   2. Create a signing invite for clientEmail
//   3. Return the signing link (signnow.com/sign/...)
// For now we generate a local /sign/:id link that resolves in-app.
export async function createSignatureRequest(
  clientEmail: string,
  clientName: string,
  documentName: string,
  documentType: SignatureRequest['documentType'],
  preparer: string,
  preparerEmail: string,
  noteToClient?: string,
): Promise<SignatureRequest> {
  // Simulate network latency
  await new Promise(r => setTimeout(r, 600));

  const id = `sig-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    clientName,
    clientEmail,
    documentName,
    documentType,
    preparer,
    preparerEmail,
    createdAt:    new Date().toISOString(),
    expiresAt:    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    status:       'pending',
    noteToClient,
  };
}

// SIGNNOW INTEGRATION POINT
// Replace with a real SignNow status poll:
//   GET https://api.signnow.com/document/{signnowDocumentId}
// or a webhook listener that writes status to your DB.
export async function getSignatureStatus(id: string): Promise<SignatureRequest['status']> {
  try {
    const stored = localStorage.getItem('sig_requests');
    if (!stored) return 'pending';
    const requests: SignatureRequest[] = JSON.parse(stored);
    return requests.find(r => r.id === id)?.status ?? 'pending';
  } catch {
    return 'pending';
  }
}

// ─── localStorage helpers shared across the app ───────────────────────────────

const LS_KEY = 'sig_requests';

export function loadSignatureRequests(): SignatureRequest[] {
  try {
    const s = localStorage.getItem(LS_KEY);
    return s ? JSON.parse(s) : [];
  } catch { return []; }
}

export function saveSignatureRequests(requests: SignatureRequest[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(requests));
}

export function upsertSignatureRequest(request: SignatureRequest): void {
  const all = loadSignatureRequests();
  const idx = all.findIndex(r => r.id === request.id);
  if (idx >= 0) all[idx] = request;
  else all.unshift(request);
  saveSignatureRequests(all);
}
