import React, { useEffect, useState } from 'react';
import PageShell from '@/components/layout/PageShell';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { fetchAiFlags, resolveAiFlag, logActivity } from '@/lib/db';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/lib/database.types';

type FlagType = Database['public']['Tables']['ai_flags']['Row']['flag_type'];
type Severity  = Database['public']['Tables']['ai_flags']['Row']['severity'];

type FlagRow = Database['public']['Tables']['ai_flags']['Row'] & {
  clients: { name: string; email: string } | null;
};

const severityBadge = (s: Severity) =>
  s === 'HIGH' ? 'bg-red-100 text-red-700'
  : s === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800'
  : 'bg-blue-100 text-blue-700';

const borderFor = (t: FlagType) =>
  t === 'wrong-year' ? 'border-l-red-500'
  : t === 'duplicate' ? 'border-l-yellow-500'
  : t === 'unexpected' ? 'border-l-orange-500'
  : 'border-l-blue-500';

const labelFor = (t: FlagType) =>
  t === 'wrong-year' ? '🔴 Wrong Year'
  : t === 'duplicate' ? '🟡 Duplicates'
  : t === 'unexpected' ? '🟠 Unexpected File'
  : '🔵 Missing Docs';

const primaryActionLabel = (t: FlagType) =>
  t === 'wrong-year' ? '📧 Send Correction Request'
  : t === 'duplicate' ? '🗑 Auto-Remove Duplicates'
  : t === 'unexpected' ? '❌ Remove File'
  : '📧 Send Reminder';

const Flags: React.FC = () => {
  const { user, session } = useAuth();
  const [flags, setFlags]   = useState<FlagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<'all' | FlagType>('all');
  const [view, setView]       = useState<'open' | 'resolved'>('open');

  const load = async () => {
    try {
      const data = await fetchAiFlags();
      setFlags(data as FlagRow[]);
    } catch {
      toast.error('Failed to load flags');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleResolve = async (flag: FlagRow) => {
    try {
      await resolveAiFlag(flag.id);
      await logActivity({
        client_id:  flag.client_id,
        actor:      user?.name ?? 'Admin',
        actor_type: 'staff',
        action:     `Resolved AI flag: ${labelFor(flag.flag_type)} for ${flag.clients?.name ?? flag.client_id}`,
      });
      setFlags(prev => prev.map(f => f.id === flag.id ? { ...f, resolved: true } : f));
      toast.success('Flag marked resolved');
    } catch (err: any) {
      toast.error('Failed to resolve flag', { description: err?.message });
    }
  };

  const handlePrimaryAction = async (flag: FlagRow) => {
    toast.success(primaryActionLabel(flag.flag_type), {
      description: `Action taken for ${flag.clients?.name ?? 'client'}`,
    });
    // Resolve after primary action
    await handleResolve(flag);
  };

  const openFlags     = flags.filter(f => !f.resolved);
  const resolvedFlags = flags.filter(f => f.resolved);

  const counts = {
    wrongYear:  flags.filter(f => f.flag_type === 'wrong-year').length,
    duplicates: flags.filter(f => f.flag_type === 'duplicate').length,
    unexpected: flags.filter(f => f.flag_type === 'unexpected').length,
    missing:    flags.filter(f => f.flag_type === 'missing').length,
  };

  const visible = (view === 'open' ? openFlags : resolvedFlags).filter(
    f => filter === 'all' || f.flag_type === filter
  );

  return (
    <PageShell>
      <PageHeader title="🚩 AI Flags" subtitle={`${openFlags.length} open issues need your attention`} />

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="pt-6"><p className="text-xs text-gray-500">🔴 Wrong Year</p><p className="text-2xl font-bold text-red-600">{counts.wrongYear}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-xs text-gray-500">🟡 Duplicates</p><p className="text-2xl font-bold text-yellow-600">{counts.duplicates}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-xs text-gray-500">🟠 Unexpected Files</p><p className="text-2xl font-bold text-orange-600">{counts.unexpected}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-xs text-gray-500">🔵 Missing Docs</p><p className="text-2xl font-bold text-blue-600">{counts.missing}</p></CardContent></Card>
        </div>

        <div className="flex flex-wrap items-center gap-3 justify-between">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="wrong-year">Wrong Year</TabsTrigger>
              <TabsTrigger value="duplicate">Duplicates</TabsTrigger>
              <TabsTrigger value="unexpected">Unexpected Files</TabsTrigger>
              <TabsTrigger value="missing">Missing Docs</TabsTrigger>
            </TabsList>
          </Tabs>
          <Tabs value={view} onValueChange={(v) => setView(v as any)}>
            <TabsList>
              <TabsTrigger value="open">Open</TabsTrigger>
              <TabsTrigger value="resolved">Resolved</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
        ) : (
          <div className="space-y-3">
            {visible.map(f => (
              <Card key={f.id} className={`border-l-4 ${borderFor(f.flag_type)} ${f.resolved ? 'opacity-50' : ''}`}>
                <CardContent className="pt-5 flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1 min-w-[260px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${severityBadge(f.severity)}`}>{f.severity}</span>
                      <span className="font-semibold">{labelFor(f.flag_type)}</span>
                      <span className="text-sm text-gray-500">— {f.clients?.name ?? f.client_id}</span>
                    </div>
                    <p className="text-sm text-gray-700 mt-2">{f.description}</p>
                    <p className="text-xs text-gray-500 mt-1">Detected by: {f.detected_by} | {new Date(f.created_at).toLocaleString()}</p>
                    {f.clients?.email && <p className="text-xs text-gray-500">{f.clients.email}</p>}
                  </div>
                  {!f.resolved && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handlePrimaryAction(f)}>{primaryActionLabel(f.flag_type)}</Button>
                      <Button size="sm" variant="outline" onClick={() => handleResolve(f)}>✅ Mark Resolved</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {visible.length === 0 && (
              <Card><CardContent className="pt-6 text-center text-gray-400">No flags here.</CardContent></Card>
            )}
          </div>
        )}
      </main>
    </PageShell>
  );
};

export default Flags;
