import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle, FileWarning, XCircle } from 'lucide-react';
import type { ComparisonResult } from '@/lib/documentComparison';
import type { AiReviewResult } from '@/lib/getDocumentComparison';
import { CURRENT_TAX_YEAR, PRIOR_TAX_YEAR } from '@/lib/taxConfig';

interface Props {
  result: ComparisonResult | AiReviewResult | null;
  loading?: boolean;
}

const AnalysisSummary: React.FC<Props> = ({ result, loading }) => {
  if (loading) {
    return (
      <Card className="mb-8 border-blue-200">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Running AI review — comparing {CURRENT_TAX_YEAR} uploads against {PRIOR_TAX_YEAR} baseline…
        </CardContent>
      </Card>
    );
  }

  if (!result) return null;

  const hasIssues =
    result.missing.length > 0 ||
    result.wrongYear.length > 0 ||
    result.wrongType.length > 0 ||
    result.unexpected.length > 0;

  return (
    <Card className={`mb-8 ${hasIssues ? 'border-amber-300' : 'border-green-300'}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          {hasIssues ? (
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          )}
          AI Analysis Summary — {CURRENT_TAX_YEAR} vs {PRIOR_TAX_YEAR}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Compared your {CURRENT_TAX_YEAR} uploads against last year&apos;s document set.
          {'engine' in result && result.engine === 'gemini' && (
            <Badge variant="secondary" className="ml-2 text-xs">Gemini Flash · PDF analysis</Badge>
          )}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {result.verified.length > 0 && (
          <Section icon={<CheckCircle2 className="w-4 h-4 text-green-600" />} title="Verified" variant="green">
            <ul className="space-y-1">
              {result.verified.map(v => (
                <li key={v.fileName} className="text-sm flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{v.name}</Badge>
                  <span className="text-muted-foreground truncate">{v.fileName}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {result.missing.length > 0 && (
          <Section icon={<XCircle className="w-4 h-4 text-red-600" />} title="Missing Documents" variant="red">
            <ul className="space-y-1">
              {result.missing.map(m => (
                <li key={m.docType} className="text-sm">
                  {m.name}
                  {m.hadIn2024 && (
                    <span className="text-muted-foreground ml-1">(you had this in {PRIOR_TAX_YEAR})</span>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {result.wrongYear.length > 0 && (
          <Section icon={<AlertTriangle className="w-4 h-4 text-orange-600" />} title="Wrong Tax Year" variant="orange">
            <ul className="space-y-1">
              {result.wrongYear.map(w => (
                <li key={w.fileName} className="text-sm">
                  {w.requirementName}: <span className="font-mono text-xs">{w.fileName}</span>
                  <span className="text-muted-foreground ml-1">({w.detectedYear} detected)</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {result.wrongType.length > 0 && (
          <Section icon={<FileWarning className="w-4 h-4 text-yellow-700" />} title="Wrong Document Type" variant="yellow">
            <ul className="space-y-1">
              {result.wrongType.map(w => (
                <li key={w.fileName} className="text-sm">
                  Expected {w.expected}, got {w.detected} — <span className="font-mono text-xs">{w.fileName}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {result.unexpected.length > 0 && (
          <Section icon={<FileWarning className="w-4 h-4 text-yellow-700" />} title="Unexpected Files" variant="yellow">
            <ul className="space-y-1">
              {result.unexpected.map(u => (
                <li key={u.fileName} className="text-sm">
                  {u.fileName} — {u.reason}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {!hasIssues && result.verified.length > 0 && (
          <p className="text-sm text-green-800 font-medium">
            All required documents verified. Your preparer has been notified.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

const Section: React.FC<{
  icon: React.ReactNode;
  title: string;
  variant: 'green' | 'red' | 'orange' | 'yellow';
  children: React.ReactNode;
}> = ({ icon, title, variant, children }) => {
  const bg: Record<string, string> = {
    green: 'bg-green-50 border-green-200',
    red: 'bg-red-50 border-red-200',
    orange: 'bg-orange-50 border-orange-200',
    yellow: 'bg-yellow-50 border-yellow-200',
  };
  return (
    <div className={`rounded-lg border p-3 ${bg[variant]}`}>
      <div className="flex items-center gap-2 font-medium text-sm mb-2">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
};

export default AnalysisSummary;
