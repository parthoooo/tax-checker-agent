import { supabase } from '@/lib/supabase';
import {
  analyzeDocumentMock,
  reconcileAnalysisForTaxYear,
  type AnalyzeDocumentResult,
} from '@/lib/documentComparison';
import { CURRENT_TAX_YEAR } from '@/lib/taxConfig';

export interface AnalyzeDocumentInput {
  fileName: string;
  mimeType?: string;
  requirementDocType: string;
  clientId: string;
  existingFilenames: string[];
  expectedTaxYear?: string;
}

export async function analyzeDocument(input: AnalyzeDocumentInput): Promise<AnalyzeDocumentResult> {
  const expectedTaxYear = input.expectedTaxYear ?? CURRENT_TAX_YEAR;
  let result: AnalyzeDocumentResult | null = null;

  try {
    const { data, error } = await supabase.functions.invoke('analyze-document', {
      body: {
        fileName: input.fileName,
        mimeType: input.mimeType ?? 'application/octet-stream',
        requirementDocType: input.requirementDocType,
        clientId: input.clientId,
        existingFilenames: input.existingFilenames,
        expectedTaxYear,
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
