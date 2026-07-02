import { supabase } from '@/lib/supabase';
import {
  analyzeDocumentMock,
  reconcileAnalysisForTaxYear,
  type AnalyzeDocumentResult,
} from '@/lib/documentComparison';
import { CURRENT_TAX_YEAR } from '@/lib/taxConfig';
import { fileToBase64, shouldSendToGemini } from '@/utils/fileToBase64';

export interface AnalyzeDocumentInput {
  fileName: string;
  mimeType?: string;
  requirementDocType: string;
  clientId: string;
  existingFilenames: string[];
  expectedTaxYear?: string;
  file?: File;
}

export function mapAnalysisToDbStatus(
  aiStatus: AnalyzeDocumentResult['aiStatus'],
): 'verified' | 'flagged' | 'rejected' {
  if (aiStatus === 'verified') return 'verified';
  if (aiStatus === 'unexpected') return 'rejected';
  return 'flagged';
}

export async function analyzeDocument(input: AnalyzeDocumentInput): Promise<AnalyzeDocumentResult> {
  const expectedTaxYear = input.expectedTaxYear ?? CURRENT_TAX_YEAR;
  let result: AnalyzeDocumentResult | null = null;

  let fileBase64: string | undefined;
  if (input.file && shouldSendToGemini(input.file)) {
    try {
      fileBase64 = await fileToBase64(input.file);
    } catch {
      fileBase64 = undefined;
    }
  }

  try {
    const { data, error } = await supabase.functions.invoke('analyze-document', {
      body: {
        fileName: input.fileName,
        mimeType: input.mimeType ?? input.file?.type ?? 'application/octet-stream',
        requirementDocType: input.requirementDocType,
        clientId: input.clientId,
        existingFilenames: input.existingFilenames,
        expectedTaxYear,
        fileBase64,
      },
    });

    if (!error && data?.docType) {
      result = data as AnalyzeDocumentResult;
    }
  } catch {
    // Fall through to local mock analyzer
  }

  if (!result) {
    result = analyzeDocumentMock(
      input.fileName,
      input.requirementDocType,
      input.existingFilenames,
      expectedTaxYear,
    );
  }

  return reconcileAnalysisForTaxYear(result, input.fileName, expectedTaxYear);
}
