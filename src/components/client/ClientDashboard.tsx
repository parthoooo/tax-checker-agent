import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, Upload, LogOut, Mail, Loader2 } from 'lucide-react';
import DocumentUpload from './DocumentUpload';
import { toast } from 'sonner';
import {
  fetchClientByAuthUser,
  fetchDocumentRequirements,
  fetchDocumentUploads,
  saveReminder,
  logActivity,
} from '@/lib/db';
import type { Database } from '@/lib/database.types';

type DocReq    = Database['public']['Tables']['document_requirements']['Row'];
type DocUpload = Database['public']['Tables']['document_uploads']['Row'];

interface DocRow extends DocReq {
  upload?: DocUpload;
}

const ClientDashboard: React.FC = () => {
  const { user, session, logout } = useAuth();

  const [clientId, setClientId] = useState<string | null>(null);
  const [clientEmail, setClientEmail] = useState<string>('');
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) return;

    (async () => {
      try {
        const client = await fetchClientByAuthUser(session.user.id);
        if (!client) { setLoading(false); return; }

        setClientId(client.id);
        setClientEmail(client.email);

        const [reqs, uploads] = await Promise.all([
          fetchDocumentRequirements(client.id),
          fetchDocumentUploads(client.id),
        ]);

        const uploadsByReqId = new Map(uploads.map(u => [u.requirement_id, u]));
        setDocs(reqs.map(r => ({ ...r, upload: uploadsByReqId.get(r.id) })));
      } finally {
        setLoading(false);
      }
    })();
  }, [session?.user?.id]);

  const handleUpload = (reqId: string, file: File) => {
    setDocs(prev => prev.map(d =>
      d.id === reqId
        ? { ...d, upload: { id: '', client_id: clientId!, requirement_id: d.id, file_name: file.name, storage_path: '', file_size: file.size, mime_type: file.type, ai_status: 'verified', uploaded_by: session?.user?.id ?? null, uploaded_at: new Date().toISOString() } }
        : d
    ));
  };

  const submittedCount = docs.filter(d => d.upload?.ai_status === 'verified').length;
  const totalCount     = docs.filter(d => d.required).length;
  const progress       = totalCount > 0 ? (submittedCount / totalCount) * 100 : 0;
  const allDone        = totalCount > 0 && submittedCount === totalCount;
  const missingDocs    = docs.filter(d => d.required && !d.upload).map(d => `${d.tax_year} ${d.name}`);

  const sendSelfReminder = async () => {
    if (!clientId) return;
    try {
      const subject = 'Action Required: Missing Tax Documents';
      const body    = `Hi ${user?.name?.split(' ')[0]},\n\nYou are still missing: ${missingDocs.join(', ')}.\n\nPlease log in to your portal to upload them.\n\n— Broder Mansoor Muqtadir, Inc.`;

      await saveReminder({ client_id: clientId, sent_by: session?.user?.id ?? null, to_email: clientEmail, subject, body });
      await logActivity({ client_id: clientId, actor: user?.name ?? 'Client', actor_type: 'client', action: 'Sent self-reminder for missing documents' });

      toast.success('Reminder sent', { description: `Sent to ${clientEmail}` });
    } catch (err: any) {
      toast.error('Failed to send reminder', { description: err?.message });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // Fallback: if no client row is linked yet, show hardcoded demo documents
  const displayDocs: DocRow[] = docs.length > 0 ? docs : [
    { id: '1', client_id: '', name: 'W-2', doc_type: 'w2', tax_year: '2024', required: true, created_at: '', upload: undefined },
    { id: '2', client_id: '', name: '1099-NEC', doc_type: '1099', tax_year: '2024', required: true, created_at: '', upload: { id: 'd', client_id: '', requirement_id: '2', file_name: '1099-NEC-2024.pdf', storage_path: '', file_size: null, mime_type: null, ai_status: 'verified', uploaded_by: null, uploaded_at: new Date().toISOString() } },
    { id: '3', client_id: '', name: '1098 Mortgage Interest', doc_type: '1098', tax_year: '2024', required: true, created_at: '', upload: undefined },
    { id: '4', client_id: '', name: 'Schedule C', doc_type: 'sched-c', tax_year: '2024', required: true, created_at: '', upload: undefined },
  ];

  const effectiveClientId = clientId ?? 'demo-client';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-xl font-semibold text-blue-900">Broder Mansoor Muqtadir, Inc. Portal</h1>
              <p className="text-sm text-muted-foreground">Welcome back, {user?.name}</p>
            </div>
            <Button variant="outline" onClick={logout}><LogOut className="w-4 h-4 mr-2" />Logout</Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Document Submission Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{submittedCount} of {totalCount} documents submitted</span>
                <Badge variant={allDone ? 'default' : 'secondary'}>{Math.round(progress)}% Complete</Badge>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Required Documents — Tax Year 2024</CardTitle>
            <p className="text-sm text-muted-foreground">Upload your required documents below. Our AI verifies each file in real time.</p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {displayDocs.filter(d => d.required).map((doc) => {
                const submitted = !!doc.upload;
                return (
                  <div key={doc.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {submitted ? <CheckCircle className="w-5 h-5 text-green-500" /> : <AlertCircle className="w-5 h-5 text-amber-500" />}
                        <div>
                          <h3 className="font-medium">{doc.name} ({doc.tax_year})</h3>
                          {submitted && doc.upload && (
                            <p className="text-sm text-muted-foreground">
                              Uploaded: {doc.upload.file_name} on {new Date(doc.upload.uploaded_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge variant={submitted ? 'default' : 'secondary'}>
                        {submitted ? 'Submitted' : 'Pending'}
                      </Badge>
                    </div>
                    {!submitted && (
                      <DocumentUpload
                        documentId={doc.id}
                        documentName={doc.name}
                        clientId={effectiveClientId}
                        onUpload={handleUpload}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {missingDocs.length > 0 && (
          <Card className="mb-8 border-yellow-300 bg-yellow-50">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-semibold text-yellow-900">📋 Still Missing</p>
                  <p className="text-sm text-yellow-800 mt-1">{missingDocs.join(', ')}</p>
                </div>
                <Button variant="outline" className="border-yellow-400" onClick={sendSelfReminder}>
                  <Mail className="w-4 h-4 mr-2" />📧 Email Reminder to Myself
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <h3 className="text-lg font-medium">Ready to Submit?</h3>
              <p className="text-muted-foreground">Once all documents are uploaded, submit them for review by our team.</p>
              <Button size="lg" disabled={!allDone} className="bg-green-600 hover:bg-green-700">
                <Upload className="w-4 h-4 mr-2" />Submit for Review
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      <footer className="py-4 text-center text-xs text-gray-400">Powered by SJ Innovation AI</footer>
    </div>
  );
};

export default ClientDashboard;
