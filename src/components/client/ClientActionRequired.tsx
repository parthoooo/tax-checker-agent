import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import AnalysisSummary from './AnalysisSummary';
import { comparisonHasClientIssues, type ComparisonResult } from '@/lib/documentComparison';
import { CURRENT_TAX_YEAR } from '@/lib/taxConfig';

interface Props {
  comparison: ComparisonResult;
  staffMessage?: string | null;
  sentAt?: string;
  sentBy?: string | null;
}

const ClientActionRequired: React.FC<Props> = ({
  comparison,
  staffMessage,
  sentAt,
  sentBy,
}) => {
  const needsAction = comparisonHasClientIssues(comparison);

  if (!needsAction) {
    return (
      <div className="mb-8 space-y-4">
        {staffMessage?.trim() && (
          <div className="p-3 rounded-md bg-white border border-green-200 text-sm text-gray-800">
            <p className="font-medium text-green-900 mb-1">Note from your preparer</p>
            <p className="whitespace-pre-wrap">{staffMessage.trim()}</p>
          </div>
        )}
        <AnalysisSummary result={comparison} />
      </div>
    );
  }

  return (
    <Card className="mb-8 border-amber-400 bg-amber-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg text-amber-900">
          <AlertTriangle className="w-5 h-5" />
          Action Required — Preparer Review
        </CardTitle>
        <p className="text-sm text-amber-800">
          Your preparer reviewed your {CURRENT_TAX_YEAR} documents
          {sentAt && <> on {new Date(sentAt).toLocaleDateString()}</>}
          {sentBy && <> ({sentBy})</>}.
          Please address the items below and re-upload where needed.
        </p>
        {staffMessage?.trim() && (
          <div className="mt-3 p-3 rounded-md bg-white border border-amber-200 text-sm text-gray-800">
            <p className="font-medium text-amber-900 mb-1">Note from your preparer</p>
            <p className="whitespace-pre-wrap">{staffMessage.trim()}</p>
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <AnalysisSummary result={comparison} />
      </CardContent>
    </Card>
  );
};

export default ClientActionRequired;
