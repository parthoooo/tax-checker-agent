import React, { useMemo, useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, FileText, Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { BUSINESS_TYPE_LABELS, docTypeLabel } from '@/lib/taxConfig';
import {
  DEMO_TAX_DOCUMENT_MANIFEST,
  type DemoTaxDocumentEntry,
} from '@/lib/demoTaxDocumentManifest';
import {
  EXTRA_SAMPLE_DOCS,
  downloadSampleDoc,
  downloadSampleDocs,
  groupSampleDocsByProfessionYear,
  sampleDocPublicUrl,
} from '@/lib/sampleDocs';

const SampleDocsPage: React.FC = () => {
  const bundles = useMemo(() => groupSampleDocsByProfessionYear(), []);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);

  const runDownload = async (
    key: string,
    entries: { fileName: string; relativePath: string }[],
    successMessage: string,
  ) => {
    setDownloadingKey(key);
    try {
      await downloadSampleDocs(entries);
      toast.success(successMessage);
    } catch {
      toast.error('One or more files could not be downloaded');
    } finally {
      setDownloadingKey(null);
    }
  };

  const handleDownloadAll = async () => {
    setDownloadingAll(true);
    try {
      await downloadSampleDocs([
        ...DEMO_TAX_DOCUMENT_MANIFEST,
        ...EXTRA_SAMPLE_DOCS,
      ]);
      toast.success('All sample PDFs downloaded');
    } catch {
      toast.error('Could not download all sample PDFs');
    } finally {
      setDownloadingAll(false);
    }
  };

  const renderDocRow = (doc: DemoTaxDocumentEntry) => {
    const key = doc.relativePath;
    const busy = downloadingKey === key;

    return (
      <div
        key={doc.relativePath}
        className="flex flex-wrap items-center justify-between gap-2 py-2 border-b last:border-b-0"
      >
        <div className="flex items-start gap-2 min-w-0">
          <FileText className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{doc.fileName}</p>
            <p className="text-xs text-muted-foreground">
              {docTypeLabel(doc.docType)} · {doc.payerOrEmployer}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            asChild
          >
            <a
              href={sampleDocPublicUrl(doc.relativePath)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              Open
            </a>
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy || downloadingAll}
            onClick={() =>
              runDownload(key, [doc], `Downloaded ${doc.fileName}`)
            }
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Download className="w-4 h-4 mr-1" />
                Download
              </>
            )}
          </Button>
        </div>
      </div>
    );
  };

  const professionTabs = ['employee', 'freelancer', 'partnership'] as const;

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Sample tax PDFs"
        subtitle="Demo documents for testing uploads, AI analysis, and year-over-year comparison"
        actions={
          <Button
            onClick={handleDownloadAll}
            disabled={downloadingAll || downloadingKey !== null}
          >
            {downloadingAll ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Download all
          </Button>
        }
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <Tabs defaultValue="employee">
          <TabsList className="flex flex-wrap h-auto gap-1">
            {professionTabs.map((profession) => (
              <TabsTrigger key={profession} value={profession}>
                {BUSINESS_TYPE_LABELS[profession]}
              </TabsTrigger>
            ))}
            <TabsTrigger value="extra">Other</TabsTrigger>
          </TabsList>

          {professionTabs.map((profession) => {
            const professionBundles = bundles.filter((b) => b.profession === profession);

            return (
              <TabsContent key={profession} value={profession} className="space-y-4 mt-4">
                {professionBundles.map((bundle) => {
                  const bundleKey = `${bundle.profession}-${bundle.taxYear}`;
                  const bundleBusy = downloadingKey === bundleKey;

                  return (
                    <Card key={bundleKey}>
                      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base">
                            Tax year {bundle.taxYear}
                          </CardTitle>
                          <Badge variant="secondary">
                            {bundle.documents.length} files
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={bundleBusy || downloadingAll}
                          onClick={() =>
                            runDownload(
                              bundleKey,
                              bundle.documents,
                              `Downloaded ${bundle.documents.length} files for ${bundle.taxYear}`,
                            )
                          }
                        >
                          {bundleBusy ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Download className="w-4 h-4 mr-1" />
                              Download bundle
                            </>
                          )}
                        </Button>
                      </CardHeader>
                      <CardContent>{bundle.documents.map(renderDocRow)}</CardContent>
                    </Card>
                  );
                })}
              </TabsContent>
            );
          })}

          <TabsContent value="extra" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
                <CardTitle className="text-base">Additional sample files</CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={downloadingKey === 'extra' || downloadingAll}
                  onClick={() =>
                    runDownload('extra', EXTRA_SAMPLE_DOCS, 'Downloaded extra sample files')
                  }
                >
                  {downloadingKey === 'extra' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-1" />
                      Download all
                    </>
                  )}
                </Button>
              </CardHeader>
              <CardContent>
                {EXTRA_SAMPLE_DOCS.map((doc) => (
                  <div
                    key={doc.relativePath}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 border-b last:border-b-0"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                      <p className="text-sm font-medium truncate">{doc.fileName}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" asChild>
                        <a
                          href={sampleDocPublicUrl(doc.relativePath)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="w-4 h-4 mr-1" />
                          Open
                        </a>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={downloadingKey === doc.relativePath || downloadingAll}
                        onClick={async () => {
                          setDownloadingKey(doc.relativePath);
                          try {
                            await downloadSampleDoc(doc);
                            toast.success(`Downloaded ${doc.fileName}`);
                          } catch {
                            toast.error(`Could not download ${doc.fileName}`);
                          } finally {
                            setDownloadingKey(null);
                          }
                        }}
                      >
                        {downloadingKey === doc.relativePath ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Download className="w-4 h-4 mr-1" />
                            Download
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default SampleDocsPage;
