import React, { useEffect, useState } from 'react';
import PageShell from '@/components/layout/PageShell';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Mail, CheckCircle2, XCircle, Loader2, Clock, Eye, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchEmailDrafts,
  approveEmailDraft,
  dismissEmailDraft,
  updateEmailDraftBody,
  fetchClients,
  createEmailDraft,
} from '@/lib/db';
import { generateEmailDraft } from '@/lib/aiSimulation';
import type { Database } from '@/lib/database.types';

type EmailDraft = Database['public']['Tables']['email_drafts']['Row'] & {
  clients: { name: string; email: string } | null;
};

const EmailQueue: React.FC = () => {
  const { user } = useAuth();
  const [pending, setPending] = useState<EmailDraft[]>([]);
  const [sent, setSent]       = useState<EmailDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<EmailDraft | null>(null);
  const [editBody, setEditBody] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const DEMO_SCENARIOS: Array<{ missingDocs: string[]; preparer: string }> = [
    { missingDocs: ['W-2 (Employer: Acme Corp)', '1099-INT (Fidelity)'], preparer: 'Sean Mansoor' },
    { missingDocs: ['1099-NEC (Upwork)', '1098 Mortgage Statement', 'Schedule C'], preparer: 'Girik Manchanda' },
    { missingDocs: ['W-2 (Goldman Sachs)'], preparer: 'Sean Mansoor' },
    { missingDocs: ['K-1 Partnership Income', '1099-DIV (Vanguard)', '1099-INT (Schwab)', 'Schedule C'], preparer: 'Girik Manchanda' },
    { missingDocs: ['1098 Mortgage Statement (Wells Fargo)', '1099-NEC'], preparer: 'Sean Mansoor' },
  ];

  const handleSeedDemoEmails = async () => {
    setSeeding(true);
    try {
      const clients = await fetchClients();
      const active = clients.filter(c => c.status !== 'complete').slice(0, 5);
      await Promise.all(
        active.map(async (client, i) => {
          const scenario = DEMO_SCENARIOS[i % DEMO_SCENARIOS.length];
          const body = await generateEmailDraft(client.name, scenario.missingDocs, scenario.preparer);
          await createEmailDraft({
            client_id:  client.id,
            to_email:   client.email,
            from_label: scenario.preparer,
            subject:    'Action Required: Missing Tax Documents',
            body,
            status:     'pending',
          });
        })
      );
      toast.success('Demo emails generated', { description: `${active.length} AI-drafted emails added to the queue` });
      await load();
    } catch (err: any) {
      toast.error('Failed to seed demo emails', { description: err?.message });
    } finally {
      setSeeding(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([
        fetchEmailDrafts('pending'),
        fetchEmailDrafts('sent'),
      ]);
      setPending(p as EmailDraft[]);
      setSent(s as EmailDraft[]);
    } catch {
      toast.error('Failed to load email queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openDraft = (d: EmailDraft) => {
    setSelected(d);
    setEditBody(d.body);
    setEditSubject(d.subject);
  };

  const handleSaveAndApprove = async () => {
    if (!selected || !user) return;
    setSaving(true);
    try {
      if (editBody !== selected.body || editSubject !== selected.subject) {
        await updateEmailDraftBody(selected.id, editBody, editSubject);
      }
      await approveEmailDraft(selected.id, user.name);
      toast.success('Email approved and sent', { description: `To: ${selected.to_email}` });
      setSelected(null);
      await load();
    } catch {
      toast.error('Failed to approve email');
    } finally {
      setSaving(false);
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await dismissEmailDraft(id);
      toast.info('Email draft dismissed');
      await load();
    } catch {
      toast.error('Failed to dismiss');
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Email Queue"
        subtitle="AI-drafted emails awaiting your approval before sending"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleSeedDemoEmails}
            disabled={seeding}
            className="gap-2"
          >
            {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Generate Demo Emails
          </Button>
        }
      />

      <main className="max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
        ) : (
          <Tabs defaultValue="pending">
            <TabsList>
              <TabsTrigger value="pending" className="gap-2">
                Pending Approval
                {pending.length > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                    {pending.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="sent">Sent History</TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="space-y-3 mt-4">
              {pending.length === 0 && (
                <Card>
                  <CardContent className="pt-8 pb-8 text-center">
                    <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-700">All clear — no pending emails</p>
                    <p className="text-xs text-gray-400 mt-1">AI will draft new emails as issues are detected</p>
                  </CardContent>
                </Card>
              )}
              {pending.map(d => (
                <DraftCard
                  key={d.id}
                  draft={d}
                  onReview={() => openDraft(d)}
                  onDismiss={() => handleDismiss(d.id)}
                />
              ))}
            </TabsContent>

            <TabsContent value="sent" className="space-y-3 mt-4">
              {sent.length === 0 && (
                <Card>
                  <CardContent className="pt-6 pb-6 text-center text-sm text-gray-400">
                    No emails sent yet.
                  </CardContent>
                </Card>
              )}
              {sent.map(d => (
                <SentCard key={d.id} draft={d} />
              ))}
            </TabsContent>
          </Tabs>
        )}
      </main>

      {/* Review modal */}
      <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" />
              Review & Approve Email
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <div className="flex gap-6 text-sm bg-gray-50 rounded-lg p-3">
                <div>
                  <span className="text-gray-500">To:</span>{' '}
                  <span className="font-medium">{selected.clients?.name ?? 'Client'}</span>
                  <span className="text-gray-400"> &lt;{selected.to_email}&gt;</span>
                </div>
                <div>
                  <span className="text-gray-500">From:</span>{' '}
                  <span className="font-medium">{selected.from_label}</span>
                </div>
              </div>

              <div>
                <Label className="text-xs text-gray-500 uppercase tracking-wide mb-1 block">Subject</Label>
                <Input value={editSubject} onChange={e => setEditSubject(e.target.value)} />
              </div>

              <div>
                <Label className="text-xs text-gray-500 uppercase tracking-wide mb-1 block">Body (editable)</Label>
                <Textarea
                  rows={12}
                  value={editBody}
                  onChange={e => setEditBody(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>

              <p className="text-xs text-gray-400">
                This email was drafted by AI based on document validation results. Edit as needed before approving.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelected(null)} disabled={saving}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => { if (selected) { handleDismiss(selected.id); setSelected(null); } }}
              disabled={saving}
            >
              <XCircle className="w-4 h-4 mr-1" /> Dismiss
            </Button>
            <Button onClick={handleSaveAndApprove} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
              Approve & Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
};

interface DraftCardProps {
  draft: EmailDraft;
  onReview: () => void;
  onDismiss: () => void;
}

const DraftCard: React.FC<DraftCardProps> = ({ draft, onReview, onDismiss }) => (
  <Card className="border-l-4 border-l-amber-400">
    <CardContent className="pt-4 pb-4">
      <div className="flex items-start gap-4">
        <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
          <Clock className="w-4 h-4 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{draft.clients?.name ?? draft.to_email}</span>
            <Badge className="bg-amber-100 text-amber-700 text-xs">Pending Approval</Badge>
          </div>
          <p className="text-sm text-gray-700 mt-0.5">{draft.subject}</p>
          <p className="text-xs text-gray-400 mt-1 truncate">
            From: {draft.from_label} · To: {draft.to_email}
          </p>
          <p className="text-xs text-gray-400 truncate mt-0.5">{draft.body.substring(0, 100)}…</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={onReview}>
            <Eye className="w-3.5 h-3.5 mr-1" /> Review
          </Button>
          <Button size="sm" variant="ghost" className="text-gray-400" onClick={onDismiss}>
            <XCircle className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
);

const SentCard: React.FC<{ draft: EmailDraft }> = ({ draft }) => (
  <Card>
    <CardContent className="pt-4 pb-4">
      <div className="flex items-center gap-4">
        <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{draft.clients?.name ?? draft.to_email}</span>
            <Badge className="bg-green-100 text-green-700 text-xs">Sent</Badge>
          </div>
          <p className="text-sm text-gray-700 mt-0.5">{draft.subject}</p>
          <p className="text-xs text-gray-400 mt-1">
            Approved by {draft.approved_by ?? 'Staff'} ·{' '}
            {draft.approved_at ? new Date(draft.approved_at).toLocaleDateString() : ''}
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
);

export default EmailQueue;
