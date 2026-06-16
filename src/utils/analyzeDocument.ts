import { supabase } from '@/lib/supabase';
import { analyzeDocumentMock, type AnalyzeDocumentResult } from '@/lib/documentComparison';

export interface AnalyzeDocumentInput {
  fileName: string;
  mimeType?: string;
  requirementDocType: string;
  clientId: string;
  existingFilenames: string[];
}

export async function analyzeDocument(input: AnalyzeDocumentInput): Promise<AnalyzeDocumentResult> {
  try {
    const { data, error } = await supabase.functions.invoke('analyze-document', {
      body: {
        fileName: input.fileName,
        mimeType: input.mimeType ?? 'application/octet-stream',
        requirementDocType: input.requirementDocType,
        clientId: input.clientId,
        existingFilenames: input.existingFilenames,
      },
    });

    if (!error && data?.docType) {
      return data as AnalyzeDocumentResult;
    }
  } catch {
    // Fall through to local mock analyzer
  }

  return analyzeDocumentMock(
    input.fileName,
    input.requirementDocType,
    input.existingFilenames,
  );
}
