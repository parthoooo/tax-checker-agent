// Ensure bucket "documents" exists in Supabase dashboard with public=false
import { supabase } from '@/lib/supabase';

export interface UploadResult {
  success: boolean;
  storagePath?: string;
  error?: string;
  aiStatus: 'verified' | 'wrong_year' | 'duplicate' | 'unexpected';
  aiMessage: string;
}

export async function uploadDocument(
  file: File,
  clientId: string,
  docType: string,
  taxYear: number,
  existingFilenames: string[],
): Promise<UploadResult> {
  const fn = file.name.toLowerCase();

  // AI validation before uploading
  const yearMatches = fn.match(/20\d{2}/g);
  if (yearMatches) {
    const hasOldYear = yearMatches.some(y => parseInt(y) < taxYear);
    if (hasOldYear) {
      return {
        success: false,
        aiStatus: 'wrong_year',
        aiMessage: `This document appears to be from a prior tax year. Tax year ${taxYear} is required — please re-upload the correct version.`,
      };
    }
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

  // Upload to Supabase Storage with structured path
  const safeName = file.name.replace(/\s+/g, '_');
  const path = `clients/${clientId}/${taxYear}/${docType}/${safeName}`;

  const { error } = await (supabase as any).storage
    .from('documents')
    .upload(path, file, { upsert: false });

  if (error) {
    return {
      success: false,
      error: error.message,
      aiStatus: 'verified',
      aiMessage: '',
    };
  }

  return {
    success: true,
    storagePath: path,
    aiStatus: 'verified',
    aiMessage: 'Document verified and stored.',
  };
}
