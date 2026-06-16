// Ensure bucket "documents" exists in Supabase dashboard with public=false
import { supabase } from '@/lib/supabase';
import { CURRENT_TAX_YEAR_NUM } from '@/lib/taxConfig';

export interface UploadResult {
  success: boolean;
  storagePath?: string;
  error?: string;
  aiStatus: 'verified' | 'wrong_year' | 'duplicate' | 'unexpected';
  aiMessage: string;
}

export async function uploadDocumentToStorage(
  file: File,
  clientId: string,
  docType: string,
  taxYear: number = CURRENT_TAX_YEAR_NUM,
): Promise<{ success: boolean; storagePath?: string; error?: string }> {
  const safeName = file.name.replace(/\s+/g, '_');
  const path = `clients/${clientId}/${taxYear}/${docType}/${safeName}`;

  const { error } = await (supabase as any).storage
    .from('documents')
    .upload(path, file, { upsert: false });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, storagePath: path };
}

/** @deprecated Use analyzeDocument + uploadDocumentToStorage */
export async function uploadDocument(
  file: File,
  clientId: string,
  docType: string,
  taxYear: number = CURRENT_TAX_YEAR_NUM,
  existingFilenames: string[],
): Promise<UploadResult> {
  const fn = file.name.toLowerCase();

  const yearMatches = fn.match(/20\d{2}/g);
  if (yearMatches?.some(y => parseInt(y) < taxYear)) {
    return {
      success: false,
      aiStatus: 'wrong_year',
      aiMessage: `This document appears to be from a prior tax year. Tax year ${taxYear} is required — please re-upload the correct version.`,
    };
  }

  if (existingFilenames.some(n => n.toLowerCase() === fn)) {
    return {
      success: false,
      aiStatus: 'duplicate',
      aiMessage: 'A file with this name was already uploaded. Remove the existing file before uploading again.',
    };
  }

  if (/(bank|statement)/.test(fn)) {
    return {
      success: false,
      aiStatus: 'unexpected',
      aiMessage: 'Bank statements are not required for your tax filing. Please upload the correct tax document.',
    };
  }

  const stored = await uploadDocumentToStorage(file, clientId, docType, taxYear);
  if (!stored.success) {
    return {
      success: false,
      error: stored.error,
      aiStatus: 'verified',
      aiMessage: '',
    };
  }

  return {
    success: true,
    storagePath: stored.storagePath,
    aiStatus: 'verified',
    aiMessage: 'Document verified and stored.',
  };
}
