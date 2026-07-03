import React, { useCallback, useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Bell, ChevronDown, ChevronUp, Loader2, XCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchEmailDrafts,
  approveEmailDraft,
  dismissEmailDraft,
  updateEmailDraftBody,
  logActivity,
} from '@/lib/db';
import type { Database } from '@/lib/database.types';

// ─── Types ────────────────────────────────────────────────────────────────────

type ReminderDraft = Database['public']['Tables']['email_drafts']['Row'] & {
  clients: { name: string; email: string } | null;
};

interface HistoryEntry {
  id: string;
  date: string;
  clientName: string;
  preparer: string;
  type: 'AI Draft Approved' | 'Manual Send' | 'Dismissed';
  docs: string[];
  status: 'Sent' | 'Dismissed';
}

interface CadenceSettings {
  firstReminderDays: number;
  repeatEveryDays: number;
  stopAfterSends: number;
  excludeAbad: boolean;
}

interface ClientOverride {
  clientName: string;
  override: boolean;
  customCadence: number;
  doNotRemind: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SEED_HISTORY: HistoryEntry[] = [
  { id: 'h-001', date: '2025-05-26T09:14:00Z', clientName: 'James Wilson',    preparer: 'Girik', type: 'AI Draft Approved', docs: ['W-2', '1099-INT'],   status: 'Sent' },
  { id: 'h-002', date: '2025-05-27T11:32:00Z', clientName: 'Emily Davis',     preparer: 'Sean',  type: 'AI Draft Approved', docs: ['1099-NEC'],           status: 'Sent' },
  { id: 'h-003', date: '2025-05-29T14:05:00Z', clientName: 'Carlos Reyes',    preparer: 'Girik', type: 'Dismissed',         docs: ['Schedule C'],         status: 'Dismissed' },
  { id: 'h-004', date: '2025-06-01T08:47:00Z', clientName: 'Linda Park',      preparer: 'Sean',  type: 'Manual Send',       docs: ['W-2', 'Schedule C'],  status: 'Sent' },
  { id: 'h-005', date: '2025-06-03T10:20:00Z', clientName: 'Thomas Wright',   preparer: 'Girik', type: 'AI Draft Approved', docs: ['1098 Mortgage'],      status: 'Sent' },
  { id: 'h-006', date: '2025-06-05T15:55:00Z', clientName: 'Patricia Garcia', preparer: 'Sean',  type: 'Dismissed',         docs: ['1099-DIV', 'K-1'],    status: 'Dismissed' },
];

const DEFAULT_CLIENT_OVERRIDES: ClientOverride[] = [
  { clientName: 'Robert Chen',     override: false, customCadence: 3, doNotRemind: true },
  { clientName: 'Maria Rodriguez', override: false, customCadence: 3, doNotRemind: true },
  { clientName: 'Michael Brown',   override: false, customCadence: 3, doNotRemind: false },
  { clientName: 'Sarah Johnson',   override: false, customCadence: 3, doNotRemind: false },
  { clientName: 'James Wilson',    override: false, customCadence: 3, doNotRemind: false },
];

const LS_HISTORY   = 'rm_history';
const LS_CADENCE   = 'rm_cadence';
const LS_OVERRIDES = 'rm_overrides';

function loadLS<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : fallback;
  } catch { return fallback; }
}
function saveLS(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ─── Pending Tab (Supabase-backed) ───────────────────────────────────────────

const PendingTab: React.FC<{
  addHistory: (entry: HistoryEntry) => void;
}> = ({ addHistory }) => {
  const { user } = useAuth();
  const [drafts,   setDrafts]   = useState<ReminderDraft[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editing,  setEditing]  = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchEmailDrafts('pending', 'reminder');
      setDrafts(data as ReminderDraft[]);
    } catch {
      toast.error('Failed to load reminder queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (d: ReminderDraft) => {
    try {
      const body = editing[d.id] ?? d.body;
      if (body !== d.body) await updateEmailDraftBody(d.id, body, d.subject);
      await approveEmailDraft(d.id, user?.name ?? 'Staff');
      if (d.client_id) {
        await logActivity({
          client_id:  d.client_id,
          actor:      user?.name ?? 'Staff',
          actor_type: 'staff',
          action:     `Approved & sent reminder to ${d.clients?.name ?? d.to_email}`,
        });
      }
      toast.success(`Email sent to ${d.to_email}`);
      addHistory({
        id: `h-${Date.now()}`,
        date: new Date().toISOString(),
        clientName: d.clients?.name ?? d.to_email,
        preparer: d.from_label ?? 'Staff',
        type: 'AI Draft Approved',
        docs: [],
        status: 'Sent',
      });
      await load();
    } catch {
      toast.error('Failed to approve reminder');
    }
  };

  const handleDismiss = async (d: ReminderDraft) => {
    try {
      await dismissEmailDraft(d.id);
      toast('Reminder dismissed');
      addHistory({
        id: `h-${Date.now()}`,
        date: new Date().toISOString(),
        clientName: d.clients?.name ?? d.to_email,
        preparer: d.from_label ?? 'Staff',
        type: 'Dismissed',
        docs: [],
        status: 'Dismissed',
      });
      await load();
    } catch {
      toast.error('Failed to dismiss reminder');
    }
  };

  const toggleExpand = (id: string) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  const startEdit = (d: ReminderDraft) => {
    setEditing(e => ({ ...e, [d.id]: e[d.id] ?? d.body }));
    setExpanded(e => ({ ...e, [d.id]: true }));
  };

  const cancelEdit = (id: string) => {
    setEditing(e => { const n = { ...e }; delete n[id]; return n; });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {drafts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-gray-500">
          <Bell className="w-10 h-10 mb-3 text-gray-300" />
          <p className="font-medium">All caught up — no reminders pending approval.</p>
          <p className="text-sm text-gray-400 mt-1">AI will draft reminders when clients are missing documents.</p>
        </div>
      ) : (
        drafts.map(d => {
          const isExpanded = !!expanded[d.id];
          const isEditing  = d.id in editing;
          const editBody   = editing[d.id] ?? d.body;
          return (
            <Card key={d.id} className="border border-gray-200">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  {/* Left */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="font-semibold text-gray-900">{d.clients?.name ?? d.to_email}</div>
                    <div className="text-sm text-gray-500">{d.to_email}</div>
                    {d.from_label && (
                      <div className="text-sm text-gray-500">Preparer: {d.from_label}</div>
                    )}
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs" variant="outline">
                      Scheduled Reminder
                    </Badge>
                  </div>

                  {/* Center — email preview */}
                  <div className="flex-[2] min-w-0 border rounded-md bg-gray-50 overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                      onClick={() => toggleExpand(d.id)}
                    >
                      <span className="truncate mr-2">{d.subject}</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
                    </button>
                    {isExpanded && (
                      <div className="px-3 pb-3">
                        {isEditing ? (
                          <div className="space-y-2 mt-1">
                            <Textarea
                              rows={10}
                              value={editBody}
                              onChange={e => setEditing(ed => ({ ...ed, [d.id]: e.target.value }))}
                              className="text-sm font-mono"
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => { /* saved on approve */ toast.success('Draft updated'); }}>Save</Button>
                              <Button size="sm" variant="outline" onClick={() => cancelEdit(d.id)}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <pre className="text-xs text-gray-600 whitespace-pre-wrap mt-1 font-sans leading-relaxed">{d.body}</pre>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right — actions */}
                  <div className="flex sm:flex-col gap-2 sm:w-36 shrink-0">
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white flex-1 sm:flex-none"
                      onClick={() => handleApprove(d)}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Approve & Send
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 sm:flex-none"
                      onClick={() => { startEdit(d); }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-gray-400 hover:text-gray-600 text-xs flex-1 sm:flex-none"
                      onClick={() => handleDismiss(d)}
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" />
                      Dismiss
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
};

// ─── Cadence Tab ──────────────────────────────────────────────────────────────

const CadenceTab: React.FC<{
  settings: CadenceSettings;
  setSettings: React.Dispatch<React.SetStateAction<CadenceSettings>>;
  overrides: ClientOverride[];
  setOverrides: React.Dispatch<React.SetStateAction<ClientOverride[]>>;
}> = ({ settings, setSettings, overrides, setOverrides }) => {

  const save = () => {
    saveLS(LS_CADENCE, settings);
    saveLS(LS_OVERRIDES, overrides);
    toast.success('Settings saved');
  };

  const updateOverride = (idx: number, patch: Partial<ClientOverride>) =>
    setOverrides(o => o.map((c, i) => i === idx ? { ...c, ...patch } : c));

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Global Defaults</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <Label className="text-sm">Send first reminder after</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                className="w-20 text-center"
                value={settings.firstReminderDays}
                onChange={e => setSettings(s => ({ ...s, firstReminderDays: Number(e.target.value) }))}
              />
              <span className="text-sm text-gray-500">days of missing docs</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label className="text-sm">Repeat every</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                className="w-20 text-center"
                value={settings.repeatEveryDays}
                onChange={e => setSettings(s => ({ ...s, repeatEveryDays: Number(e.target.value) }))}
              />
              <span className="text-sm text-gray-500">days until resolved</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label className="text-sm">Stop reminders after</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                className="w-20 text-center"
                value={settings.stopAfterSends}
                onChange={e => setSettings(s => ({ ...s, stopAfterSends: Number(e.target.value) }))}
              />
              <span className="text-sm text-gray-500">total sends</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 pt-1">
            <div>
              <Label className="text-sm">Exclude long-term clients managed by Abad</Label>
              <p className="text-xs text-gray-500 mt-0.5">Abad's clients will not receive automated reminders</p>
            </div>
            <Switch
              checked={settings.excludeAbad}
              onCheckedChange={v => setSettings(s => ({ ...s, excludeAbad: v }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per-Client Overrides</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-gray-500 text-xs">
                  <th className="text-left py-2 pr-4 font-medium">Client</th>
                  <th className="text-center py-2 px-2 font-medium">Override</th>
                  <th className="text-center py-2 px-2 font-medium">Custom cadence (days)</th>
                  <th className="text-center py-2 px-2 font-medium">Do not remind</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {overrides.map((c, i) => (
                  <tr key={c.clientName}>
                    <td className="py-2.5 pr-4 font-medium text-gray-800">{c.clientName}</td>
                    <td className="py-2.5 px-2 text-center">
                      <Switch
                        checked={c.override}
                        onCheckedChange={v => updateOverride(i, { override: v })}
                      />
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <Input
                        type="number"
                        min={1}
                        className="w-20 text-center mx-auto"
                        value={c.customCadence}
                        disabled={!c.override}
                        onChange={e => updateOverride(i, { customCadence: Number(e.target.value) })}
                      />
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Checkbox
                          checked={c.doNotRemind}
                          onCheckedChange={v => updateOverride(i, { doNotRemind: Boolean(v) })}
                        />
                        {c.doNotRemind && (
                          <Badge variant="outline" className="text-xs text-gray-500">Manual only</Badge>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Button onClick={save} className="w-full sm:w-auto">Save Settings</Button>
    </div>
  );
};

// ─── History Tab ──────────────────────────────────────────────────────────────

const HistoryTab: React.FC<{ history: HistoryEntry[] }> = ({ history }) => {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  const sorted = [...history].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-gray-500 text-xs">
            <th className="text-left py-2 pr-4 font-medium">Date / Time</th>
            <th className="text-left py-2 pr-4 font-medium">Client</th>
            <th className="text-left py-2 pr-4 font-medium">Preparer</th>
            <th className="text-left py-2 pr-4 font-medium">Type</th>
            <th className="text-left py-2 pr-4 font-medium">Documents</th>
            <th className="text-left py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sorted.map(h => (
            <tr key={h.id} className="hover:bg-gray-50">
              <td className="py-2.5 pr-4 text-gray-600 whitespace-nowrap">{fmt(h.date)}</td>
              <td className="py-2.5 pr-4 font-medium text-gray-800">{h.clientName}</td>
              <td className="py-2.5 pr-4 text-gray-600">{h.preparer}</td>
              <td className="py-2.5 pr-4 text-gray-600">{h.type}</td>
              <td className="py-2.5 pr-4 text-gray-500 max-w-[200px]">
                {h.docs.length > 0
                  ? <span className="truncate block">{h.docs.join(', ')}</span>
                  : <span className="text-gray-300">—</span>
                }
              </td>
              <td className="py-2.5">
                <Badge
                  variant="outline"
                  className={
                    h.status === 'Sent'
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : 'bg-gray-100 text-gray-500 border-gray-200'
                  }
                >
                  {h.status}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {sorted.length === 0 && (
        <p className="text-center text-gray-500 py-12">No reminder history yet.</p>
      )}
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const RemindersPage: React.FC = () => {
  const [history,  setHistory]  = useState<HistoryEntry[]>(() => loadLS(LS_HISTORY, SEED_HISTORY));
  const [settings, setSettings] = useState<CadenceSettings>(() =>
    loadLS(LS_CADENCE, { firstReminderDays: 3, repeatEveryDays: 3, stopAfterSends: 4, excludeAbad: true })
  );
  const [overrides, setOverrides] = useState<ClientOverride[]>(() => loadLS(LS_OVERRIDES, DEFAULT_CLIENT_OVERRIDES));

  useEffect(() => { saveLS(LS_HISTORY, history); }, [history]);

  const addHistory = (entry: HistoryEntry) => setHistory(h => [entry, ...h]);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Bell className="w-6 h-6 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reminders</h1>
          <p className="text-sm text-gray-500">Scheduled follow-up emails — review and approve before sending</p>
        </div>
      </div>

      <Tabs defaultValue="pending">
        <TabsList className="mb-6">
          <TabsTrigger value="pending">Pending Approval</TabsTrigger>
          <TabsTrigger value="cadence">Cadence Settings</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <PendingTab addHistory={addHistory} />
        </TabsContent>

        <TabsContent value="cadence">
          <CadenceTab
            settings={settings}
            setSettings={setSettings}
            overrides={overrides}
            setOverrides={setOverrides}
          />
        </TabsContent>

        <TabsContent value="history">
          <HistoryTab history={history} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RemindersPage;
