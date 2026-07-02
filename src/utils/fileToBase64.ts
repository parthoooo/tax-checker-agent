/** Read a File as base64 (no data: URL prefix) for edge function PDF analysis. */
export async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Skip Gemini for very large files (edge payload limits); mock fallback applies. */
export const MAX_GEMINI_FILE_BYTES = 8 * 1024 * 1024;

export function shouldSendToGemini(file: File): boolean {
  return file.size > 0 && file.size <= MAX_GEMINI_FILE_BYTES;
}
