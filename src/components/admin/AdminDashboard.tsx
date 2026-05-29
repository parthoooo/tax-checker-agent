import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search, Users, FileText, AlertTriangle, CheckCircle, LogOut, Download, Mail, Clock, DollarSign, Loader2
} from 'lucide-react';
import ClientDetailModal from './ClientDetailModal';
import AgentTeamBanner from '@/components/ai/AgentTeamBanner';
import AgentActivityFeed from '@/components/ai/AgentActivityFeed';
import ReminderModal from '@/components/common/ReminderModal';
import { toast } from 'sonner';
import { fetchClients, fetchAiFlags, resolveAiFlag, logActivity } from '@/lib/db';
import type { Database } from '@/lib/database.types';

type Client  = Database['public']['Tables']['clients']['Row'];
type FlagRow = Database['public']['Tables']['ai_flags']['Row'] & {
  clients: { name: string; email: string } | null;
};

const useCountUp = (target: number, duration = 2000) => {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
};

const AdminDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [clients, setClients]         = useState<Client[]>([]);
  const [flags, setFlags]             = useState<FlagRow[]>([]);
  const [loading, setLoading]         = useState(true);
  const [searchTerm, setSearchTerm]   = useState('');
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [reminderClient, setReminderClient] = useState<Client | null>(null);

  const hours   = useCountUp(14.5);
  const dollars = useCountUp(406);

  useEffect(() => {
    Promise.all([fetchClients(), fetchAiFlags(false)])
      .then(([c, f]) => {
        setClients(c);
        setFlags(f as FlagRow[]);
      })
      .catch(() => toast.error('Failed to load dashboard data'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusColor = (s: string) =>
    s === 'complete' ? 'bg-green-100 text-green-800'
    : s === 'active' ? 'bg-blue-100 text-blue-800'
    : s === 'overdue' ? 'bg-red-100 text-red-800'
    : 'bg-gray-100 text-gray-800';

  const totalIssues = clients.reduce((s, c) => s + c.issues, 0);
  const completed   = clients.filter(c => c.status === 'complete').length;
  const overdue     = clients.filter(c => c.status === 'overdue').length;

  // Show at most 3 unresolved flags in the "Needs Attention" section
  const topFlags = flags.slice(0, 3);

  const handleFlagAction = async (flag: FlagRow) => {
    try {
      await resolveAiFlag(flag.id);
      await logActivity({
        client_id:  flag.client_id,
        actor:      user?.name ?? 'Admin',
        actor_type: 'staff',
        action:     `Resolved flag (${flag.flag_type}) for ${flag.clients?.name ?? flag.client_id}`,
      });
      setFlags(prev => prev.filter(f => f.id !== flag.id));
      toast.success('Action taken', { description: `Flag resolved for ${flag.clients?.name}` });
    } catch (err: any) {
      toast.error('Failed', { description: err?.message });
    }
  };

  const flagBorder = (t: string) =>
    t === 'wrong-year' ? 'border-l-red-500'
    : t === 'duplicate' ? 'border-l-yellow-500'
    : t === 'unexpected' ? 'border-l-orange-500'
    : 'border-l-blue-500';

  const flagTitle = (t: string) =>
    t === 'wrong-year' ? '⚠️ Wrong Year Document'
    : t === 'duplicate' ? '📋 Duplicates Detected'
    : t === 'unexpected' ? '📂 Unnecessary File'
    : '📋 Missing Documents';

  const flagActionLabel = (t: string) =>
    t === 'wrong-year' ? '📧 Send Correction Request'
    : t === 'duplicate' ? '🗑 Auto-Remove Duplicates'
    : t === 'unexpected' ? '❌ Remove File'
    : '📧 Send Reminder';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-xl font-semibold text-blue-900">Broder-Mansoor & Associates | Tax Season 2024</h1>
              <p className="text-sm text-muted-foreground">Welcome back, {user?.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">Client Portal: brodermansoor.buildyourai.consulting</p>
            </div>
            <Button variant="outline" onClick={logout}>
              <LogOut className="w-4 h-4 mr-2" />Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ROI Banner */}
        <div className="rounded-2xl mb-8 p-8 text-white shadow-lg" style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="flex items-center gap-2 text-blue-200 text-sm font-medium uppercase tracking-wide">
                <Clock className="w-4 h-4" /> Time Saved This Week
              </div>
              <div className="mt-2 text-5xl font-bold">{hours.toFixed(1)} <span className="text-3xl font-medium text-blue-200">hrs</span></div>
              <p className="text-sm text-blue-100 mt-2">Based on 23 wrong-year docs caught + 47 duplicates auto-rejected across 100 clients</p>
            </div>
            <div className="md:text-right">
              <div className="flex items-center gap-2 text-blue-200 text-sm font-medium uppercase tracking-wide md:justify-end">
                <DollarSign className="w-4 h-4" /> Est. Cost Saved
              </div>
              <div className="mt-2 text-5xl font-bold">${Math.round(dollars)}</div>
              <p className="text-sm text-blue-100 mt-2">14.5 hrs × $28/hr staff rate</p>
            </div>
          </div>
        </div>

        <AgentTeamBanner />
        <AgentActivityFeed />

        {/* AI Flags */}
        {topFlags.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4 text-gray-800">🤖 Needs Your Attention</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {topFlags.map(f => (
                <Card key={f.id} className={`border-l-4 ${flagBorder(f.flag_type)}`}>
                  <CardContent className="pt-6">
                    <p className="font-semibold">{flagTitle(f.flag_type)}</p>
                    <p className="text-sm mt-2 font-medium">{f.clients?.name ?? '—'}</p>
                    {f.clients?.email && <p className="text-xs text-gray-500">{f.clients.email}</p>}
                    <p className="text-sm text-gray-700 mt-2">{f.description}</p>
                    <Button
                      size="sm"
                      className="mt-3 w-full"
                      variant={f.flag_type === 'wrong-year' ? 'default' : 'outline'}
                      onClick={() => handleFlagAction(f)}
                    >
                      {flagActionLabel(f.flag_type)}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <Card><CardContent className="pt-6"><div className="flex items-center"><Users className="w-8 h-8 text-blue-500" /><div className="ml-3"><p className="text-sm text-gray-600">Total Clients</p><p className="text-2xl font-bold">{clients.length}</p></div></div></CardContent></Card>
              <Card><CardContent className="pt-6"><div className="flex items-center"><CheckCircle className="w-8 h-8 text-green-500" /><div className="ml-3"><p className="text-sm text-gray-600">Completed</p><p className="text-2xl font-bold">{completed}</p></div></div></CardContent></Card>
              <Card><CardContent className="pt-6"><div className="flex items-center"><AlertTriangle className="w-8 h-8 text-red-500" /><div className="ml-3"><p className="text-sm text-gray-600">Overdue</p><p className="text-2xl font-bold">{overdue}</p></div></div></CardContent></Card>
              <Card><CardContent className="pt-6"><div className="flex items-center"><FileText className="w-8 h-8 text-amber-500" /><div className="ml-3"><p className="text-sm text-gray-600">Flagged Issues</p><p className="text-2xl font-bold">{totalIssues}</p></div></div></CardContent></Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Client Overview</CardTitle>
                  <Button variant="outline" size="sm"><Download className="w-4 h-4 mr-2" />Export Report</Button>
                </div>
                <div className="flex items-center gap-4 mt-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input placeholder="Search clients…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Client</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Progress</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Issues</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Last Activity</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((c) => (
                        <tr key={c.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <p className="font-medium">{c.name}</p>
                            <p className="text-sm text-gray-500">{c.email}</p>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{c.documents_submitted}/{c.documents_required}</span>
                              <div className="w-20 bg-gray-200 rounded-full h-2">
                                <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${c.documents_required > 0 ? (c.documents_submitted / c.documents_required) * 100 : 0}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4"><Badge className={statusColor(c.status)}>{c.status}</Badge></td>
                          <td className="py-3 px-4">
                            {c.issues > 0 ? <Badge variant="destructive">{c.issues} issues</Badge> : <span className="text-green-600 text-sm">No issues</span>}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">{new Date(c.last_activity).toLocaleDateString()}</td>
                          <td className="py-3 px-4">
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => setSelectedClient(c.id)}>View Details</Button>
                              <Button variant="outline" size="sm" onClick={() => setReminderClient(c)}>
                                <Mail className="w-4 h-4 mr-1" />Remind
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>

      <footer className="py-4 text-center text-xs text-gray-400">Powered by SJ Innovation AI</footer>

      {selectedClient && <ClientDetailModal clientId={selectedClient} onClose={() => setSelectedClient(null)} />}

      <ReminderModal
        open={!!reminderClient}
        onClose={() => setReminderClient(null)}
        clientId={reminderClient?.id}
        clientName={reminderClient?.name}
        clientEmail={reminderClient?.email}
      />
    </div>
  );
};

export default AdminDashboard;
