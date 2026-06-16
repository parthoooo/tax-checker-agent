import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageShell from '@/components/layout/PageShell';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Mail, Plus, Search, Loader2, UserCheck } from 'lucide-react';
import { initials, statusBadge } from '@/lib/mockData';
import ReminderModal from '@/components/common/ReminderModal';
import { toast } from 'sonner';
import { fetchClients } from '@/lib/db';
import { countPendingSignupRequests } from '@/lib/signupRequests';
import { supabase } from '@/lib/supabase';
import { seedAllDemoData } from '@/lib/seedDemoData';
import type { Database } from '@/lib/database.types';

type Client = Database['public']['Tables']['clients']['Row'];

const Clients: React.FC = () => {
  const [clients, setClients]   = useState<Client[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState<'all' | 'active' | 'overdue' | 'complete'>('all');
  const [addOpen, setAddOpen]   = useState(false);
  const [reminder, setReminder] = useState<Client | null>(null);
  const [seeding, setSeeding]   = useState(false);
  const [seedProgress, setSeedProgress] = useState('');
  const [pendingSignups, setPendingSignups] = useState(0);

  // Add-client form state
  const [newName, setNewName]   = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newStaff, setNewStaff] = useState('');

  useEffect(() => {
    fetchClients()
      .then(setClients)
      .catch(() => toast.error('Failed to load clients'))
      .finally(() => setLoading(false));

    countPendingSignupRequests().then(setPendingSignups).catch(() => {});
  }, []);

  const reload = () =>
    fetchClients().then(setClients).catch(() => toast.error('Failed to load clients'));

  const handleSeedDemo = async () => {
    setSeeding(true);
    setSeedProgress('Starting...');
    try {
      await seedAllDemoData(msg => setSeedProgress(msg));
      await reload();
      toast.success('🎬 Demo data loaded!', { description: 'All 20 clients, documents, flags, emails, activity logs and time entries populated.' });
    } catch (err: any) {
      toast.error('Seeding failed', { description: err?.message });
    } finally {
      setSeeding(false);
      setSeedProgress('');
    }
  };

  const filtered = clients.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || c.status === filter;
    return matchesSearch && matchesFilter;
  });

  const handleAddClient = async () => {
    if (!newName || !newEmail) return;
    try {
      const { data, error } = await (supabase as any)
        .from('clients')
        .insert({ name: newName, email: newEmail, phone: newPhone || null, assigned_staff: newStaff || null, business_type: 'freelancer', status: 'active', documents_submitted: 0, documents_required: 4, issues: 0, last_activity: new Date().toISOString() })
        .select()
        .single();
      if (error) throw error;
      setClients(prev => [data, ...prev]);
      toast.success('Client added');
      setAddOpen(false);
      setNewName(''); setNewEmail(''); setNewPhone(''); setNewStaff('');
    } catch (err: any) {
      toast.error('Failed to add client', { description: err?.message });
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Clients"
        subtitle={`${clients.length} clients this tax season`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild className="gap-2">
              <Link to="/clients/signups">
                <UserCheck className="w-4 h-4" />
                Sign-up Approvals
                {pendingSignups > 0 && (
                  <Badge variant="destructive" className="ml-1 h-5 min-w-[20px] px-1.5">
                    {pendingSignups}
                  </Badge>
                )}
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={handleSeedDemo}
              disabled={seeding}
              className="gap-2"
            >
              {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>🎬</span>}
              {seeding ? (seedProgress || 'Loading…') : 'Load Demo Data'}
            </Button>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="w-4 h-4 mr-1" /> Add Client
            </Button>
          </div>
        }
      />
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input placeholder="Search by name…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="overdue">Overdue</TabsTrigger>
              <TabsTrigger value="complete">Submitted for Review</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
        ) : (
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
                    <th className="py-3 px-4">Client</th>
                    <th className="py-3 px-4">Progress</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">AI Issues</th>
                    <th className="py-3 px-4">Assigned</th>
                    <th className="py-3 px-4">Last Activity</th>
                    <th className="py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => {
                    const pct = c.documents_required > 0
                      ? Math.round((c.documents_submitted / c.documents_required) * 100)
                      : 0;
                    return (
                      <tr key={c.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold">{initials(c.name)}</div>
                            <div>
                              <p className="font-medium text-sm">{c.name}</p>
                              <p className="text-xs text-gray-500">{c.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2 min-w-[160px]">
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-gray-600 whitespace-nowrap">{c.documents_submitted}/{c.documents_required} ({pct}%)</span>
                          </div>
                        </td>
                        <td className="py-3 px-4"><Badge className={statusBadge(c.status as any)}>{c.status}</Badge></td>
                        <td className="py-3 px-4">
                          {c.issues > 0 ? <Badge variant="destructive">{c.issues}</Badge> : <span className="text-xs text-gray-400">—</span>}
                        </td>
                        <td className="py-3 px-4 text-sm">{c.assigned_staff ?? '—'}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{new Date(c.last_activity).toLocaleDateString()}</td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" asChild>
                              <Link to={`/clients/${c.id}`}>View</Link>
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setReminder(c)}>
                              <Mail className="w-3.5 h-3.5 mr-1" /> Remind
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-10 text-gray-400">No clients match your filters.</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </main>

      <ReminderModal
        open={!!reminder}
        onClose={() => setReminder(null)}
        clientId={reminder?.id}
        clientName={reminder?.name}
        clientEmail={reminder?.email}
      />

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Client</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input placeholder="Jane Doe" value={newName} onChange={e => setNewName(e.target.value)} /></div>
            <div><Label>Email</Label><Input type="email" placeholder="jane@email.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} /></div>
            <div><Label>Phone</Label><Input placeholder="(555) 000-0000" value={newPhone} onChange={e => setNewPhone(e.target.value)} /></div>
            <div><Label>Assigned Staff</Label><Input placeholder="Shawn" value={newStaff} onChange={e => setNewStaff(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddClient}>Add Client</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
};

export default Clients;
