import React, { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown, ChevronUp, Bell } from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PendingReminder {
  id: string;
  clientName: string;
  clientEmail: string;
  preparer: string;
  missingDocs: string[];
  daysOverdue: number;
  subject: string;
  body: string;
}

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

const MOCK_PENDING: PendingReminder[] = [
  {
    id: 'rem-001',
    clientName: 'Robert Chen',
    clientEmail: 'robert.chen@email.com',
    preparer: 'Girik',
    missingDocs: ['W-2', '1099-NEC', '1098 Mortgage Interest', 'Schedule C'],
    daysOverdue: 6,
    subject: 'Action Required: Missing Tax Documents — Robert Chen',
    body: `Hi Robert,\n\nI hope you're doing well. I'm reaching out because we're still missing a few documents needed to complete your 2024 tax return.\n\nOutstanding documents:\n• W-2 (Employer wage statement)\n• 1099-NEC (Non-employee compensation)\n• 1098 Mortgage Interest Statement\n• Schedule C (Business income/expenses)\n\nPlease upload these at your earliest convenience using your secure portal link. If you have any questions about what's needed, don't hesitate to reach out.\n\nThank you,\nGirik\nBroder-Mansoor & Associates`,
  },
  {
    id: 'rem-002',
    clientName: 'Maria Rodriguez',
    clientEmail: 'maria.rodriguez@email.com',
    preparer: 'Sean',
    missingDocs: ['1099-NEC', 'Schedule C'],
    daysOverdue: 3,
    subject: 'Quick Reminder: 2 Documents Still Needed — Maria Rodriguez',
    body: `Hi Maria,\n\nJust a quick follow-up — we're still waiting on 2 documents to complete your 2024 return:\n\n• 1099-NEC (Non-employee compensation)\n• Schedule C (Business income/expenses)\n\nPlease upload when you get a chance. Feel free to reply if you have any questions.\n\nThanks,\nSean\nBroder-Mansoor & Associates`,
  },
  {
    id: 'rem-003',
    clientName: 'Michael Brown',
    clientEmail: 'michael.brown@email.com',
    preparer: 'Girik',
    missingDocs: ['W-2 (correct year — 2024 needed)'],
    daysOverdue: 4,
    subject: 'Important: Please Re-Upload Your W-2 — Michael Brown',
    body: `Hi Michael,\n\nThank you for uploading your documents. However, our system detected that the W-2 you uploaded is for tax year 2023. We need your 2024 W-2 to complete your return.\n\nPlease re-upload the correct document at your earliest convenience.\n\nSorry for the inconvenience — this happens more often than you'd think!\n\nThank you,\nGirik\nBroder-Mansoor & Associates`,
  },
  {
    id: 'rem-004',
    clientName: 'Sarah Johnson',
    clientEmail: 'sarah.johnson@email.com',
    preparer: 'Sean',
    missingDocs: ['Schedule C'],
    daysOverdue: 9,
    subject: 'Final Reminder: Schedule C Needed — Sarah Johnson',
    body: `Hi Sarah,\n\nThis is a follow-up regarding your 2024 tax return. We're still missing your Schedule C (business income and expenses).\n\nWithout this document, we're unable to finalize your return. Please upload it as soon as possible to avoid any delays.\n\nIf you need assistance, please don't hesitate to call us at (212) 599-2755.\n\nThank you,\nSean\nBroder-Mansoor & Associates`,
  },
];

const SEED_HISTORY: HistoryEntry[] = [
  { id: 'h-001', date: '2025-05-26T09:14:00Z', clientName: 'James Wilson',    preparer: 'Girik', type: 'AI Draft Approved', docs: ['W-2', '1099-INT'],   status: 'Sent' },
  { id: 'h-002', date: '2025-05-27T11:32:00Z', clientName: 'Emily Davis',     preparer: 'Sean',  type: 'AI Draft Approved', docs: ['1099-NEC'],           status: 'Sent' },
  { id: 'h-003', date: '2025-05-29T14:05:00Z', clientName: 'Carlos Reyes',    preparer: 'Girik', type: 'Dismissed',         docs: ['Schedule C'],         status: 'Dismissed' },
  { id: 'h-004', date: '2025-06-01T08:47:00Z', clientName: 'Linda Park',      preparer: 'Sean',  type: 'Manual Send',       docs: ['W-2', 'Schedule C'],  status: 'Sent' },
  { id: 'h-005', date: '2025-06-03T10:20:00Z', clientName: 'Thomas Wright',   preparer: 'Girik', type: 'AI Draft Approved', docs: ['1098 Mortgage'],      status: 'Sent' },
  { id: 'h-006', date: '2025-06-05T15:55:00Z', clientName: 'Patricia Garcia', preparer: 'Sean',  type: 'Dismissed',         docs: ['1099-DIV', 'K-1'],    status: 'Dismissed' },
];

const DEFAULT_CLIENT_OVERRIDES: ClientOverride[] = [
  { clientName: 'Robert Chen',    override: false, customCadence: 3, doNotRemind: true },
  { clientName: 'Maria Rodriguez',override: false, customCadence: 3, doNotRemind: true },
  { clientName: 'Michael Brown',  override: false, customCadence: 3, doNotRemind: false },
  { clientName: 'Sarah Johnson',  override: false, customCadence: 3, doNotRemind: false },
  { clientName: 'James Wilson',   override: false, customCadence: 3, doNotRemind: false },
];

const LS_PENDING  = 'rm_pending';
const LS_HISTORY  = 'rm_history';
const LS_CADENCE  = 'rm_cadence';
const LS_OVERRIDES= 'rm_overrides';

function loadLS<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveLS(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const OverdueBadge: React.FC<{ days: number }> = ({ days }) => (
  <Badge
    className={
      days > 7
        ? 'bg-red-100 text-red-700 border-red-200'
        : 'bg-yellow-100 text-yellow-700 border-yellow-200'
    }
    variant="outline"
  >
    {days}d overdue
  </Badge>
);

interface PendingCardProps {
  reminder: PendingReminder;
  onApprove: (id: string) => void;
  onDismiss: (id: string) => void;
  onSave: (id: string, body: string) => void;
}

const PendingCard: React.FC<PendingCardProps> = ({ reminder, onApprove, onDismiss, onSave }) => {
  const [expanded, setExpanded]   = useState(false);
  const [editing,  setEditing]    = useState(false);
  const [editBody, setEditBody]   = useState(reminder.body);

  const handleSave = () => {
    onSave(reminder.id, editBody);
    setEditing(false);
    toast.success('Draft updated');
  };

  return (
    <Card className="border border-gray-200">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          {/* Left */}
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="font-semibold text-gray-900">{reminder.clientName}</div>
            <div className="text-sm text-gray-500">{reminder.clientEmail}</div>
            <div className="text-sm text-gray-500">Preparer: {reminder.preparer}</div>
            <div className="flex flex-wrap gap-1.5 mt-1">
              <Badge variant="secondary">{reminder.missingDocs.length} doc{reminder.missingDocs.length !== 1 ? 's' : ''} missing</Badge>
              <OverdueBadge days={reminder.daysOverdue} />
            </div>
          </div>

          {/* Center — email preview */}
          <div className="flex-[2] min-w-0 border rounded-md bg-gray-50 overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              onClick={() => setExpanded(e => !e)}
            >
              <span className="truncate mr-2">{reminder.subject}</span>
              {expanded ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
            </button>
            {expanded && (
              <div className="px-3 pb-3">
                {editing ? (
                  <div className="space-y-2 mt-1">
                    <Textarea
                      rows={10}
                      value={editBody}
                      onChange={e => setEditBody(e.target.value)}
                      className="text-sm font-mono"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSave}>Save</Button>
                      <Button size="sm" variant="outline" onClick={() => { setEditing(false); setEditBody(reminder.body); }}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <pre className="text-xs text-gray-600 whitespace-pre-wrap mt-1 font-sans leading-relaxed">{editBody}</pre>
                )}
              </div>
            )}
          </div>

          {/* Right — actions */}
          <div className="flex sm:flex-col gap-2 sm:w-36 shrink-0">
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white flex-1 sm:flex-none"
              onClick={() => onApprove(reminder.id)}
            >
              Approve & Send
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 sm:flex-none"
              onClick={() => { setExpanded(true); setEditing(e => !e); }}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-gray-400 hover:text-gray-600 text-xs flex-1 sm:flex-none"
              onClick={() => onDismiss(reminder.id)}
            >
              Dismiss
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const PendingTab: React.FC<{
  pending: PendingReminder[];
  setPending: React.Dispatch<React.SetStateAction<PendingReminder[]>>;
  addHistory: (entry: HistoryEntry) => void;
}> = ({ pending, setPending, addHistory }) => {

  const remove = (id: string) => setPending(p => p.filter(r => r.id !== id));

  const approve = (id: string) => {
    const r = pending.find(p => p.id === id)!;
    toast.success(`Email sent to ${r.clientEmail}`);
    addHistory({
      id: `h-${Date.now()}`,
      date: new Date().toISOString(),
      clientName: r.clientName,
      preparer: r.preparer,
      type: 'AI Draft Approved',
      docs: r.missingDocs,
      status: 'Sent',
    });
    remove(id);
  };

  const dismiss = (id: string) => {
    const r = pending.find(p => p.id === id)!;
    toast('Reminder dismissed');
    addHistory({
      id: `h-${Date.now()}`,
      date: new Date().toISOString(),
      clientName: r.clientName,
      preparer: r.preparer,
      type: 'Dismissed',
      docs: r.missingDocs,
      status: 'Dismissed',
    });
    remove(id);
  };

  const saveEdit = (id: string, body: string) => {
    setPending(p => p.map(r => r.id === id ? { ...r, body } : r));
  };

  if (pending.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-gray-500">
        <Bell className="w-10 h-10 mb-3 text-gray-300" />
        <p className="font-medium">All caught up — no reminders pending approval.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pending.map(r => (
        <PendingCard key={r.id} reminder={r} onApprove={approve} onDismiss={dismiss} onSave={saveEdit} />
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

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
      {/* Global defaults */}
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

      {/* Per-client overrides */}
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

// ─────────────────────────────────────────────────────────────────────────────

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
                <span className="truncate block">{h.docs.join(', ')}</span>
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
  const [pending, setPending]     = useState<PendingReminder[]>(() => loadLS(LS_PENDING, MOCK_PENDING));
  const [history, setHistory]     = useState<HistoryEntry[]>(() => loadLS(LS_HISTORY, SEED_HISTORY));
  const [settings, setSettings]   = useState<CadenceSettings>(() =>
    loadLS(LS_CADENCE, { firstReminderDays: 3, repeatEveryDays: 3, stopAfterSends: 4, excludeAbad: true })
  );
  const [overrides, setOverrides] = useState<ClientOverride[]>(() => loadLS(LS_OVERRIDES, DEFAULT_CLIENT_OVERRIDES));

  // Persist whenever state changes
  useEffect(() => { saveLS(LS_PENDING, pending); }, [pending]);
  useEffect(() => { saveLS(LS_HISTORY, history); }, [history]);

  const addHistory = (entry: HistoryEntry) => setHistory(h => [entry, ...h]);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Bell className="w-6 h-6 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reminders</h1>
          <p className="text-sm text-gray-500">AI-drafted follow-up emails — review before sending</p>
        </div>
        {pending.length > 0 && (
          <Badge className="ml-auto bg-red-500 text-white text-sm px-2.5 py-1">
            {pending.length} pending
          </Badge>
        )}
      </div>

      <Tabs defaultValue="pending">
        <TabsList className="mb-6">
          <TabsTrigger value="pending" className="relative">
            Pending Approval
            {pending.length > 0 && (
              <span className="ml-2 bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] inline-flex items-center justify-center">
                {pending.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="cadence">Cadence Settings</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <PendingTab pending={pending} setPending={setPending} addHistory={addHistory} />
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
