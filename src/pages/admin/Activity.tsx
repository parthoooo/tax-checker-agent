import React, { useEffect, useState } from 'react';
import PageShell from '@/components/layout/PageShell';
import PageHeader from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { fetchActivityLog } from '@/lib/db';
import type { Database } from '@/lib/database.types';

type ActorType = Database['public']['Tables']['activity_log']['Row']['actor_type'];

type ActivityEntry = Database['public']['Tables']['activity_log']['Row'] & {
  clients: { name: string } | null;
};

const iconFor = (t: ActorType) => t === 'ai' ? '🤖' : '👤';
const bgFor   = (t: ActorType) =>
  t === 'ai' ? 'bg-purple-100 text-purple-700'
  : t === 'staff' ? 'bg-blue-100 text-blue-700'
  : 'bg-gray-100 text-gray-700';

const Activity: React.FC = () => {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [type, setType]       = useState<'all' | ActorType>('all');

  useEffect(() => {
    fetchActivityLog()
      .then(data => setEntries(data as ActivityEntry[]))
      .catch(() => toast.error('Failed to load activity log'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = entries.filter(e => {
    const clientName = e.clients?.name ?? '';
    if (search && !clientName.toLowerCase().includes(search.toLowerCase())) return false;
    if (type !== 'all' && e.actor_type !== type) return false;
    return true;
  });

  const relativeTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins  = Math.floor(diff / 60000);
    const hrs   = Math.floor(mins / 60);
    const days  = Math.floor(hrs / 24);
    if (days > 1)  return `${days} days ago`;
    if (days === 1) return '1 day ago';
    if (hrs > 1)   return `${hrs} hours ago`;
    if (hrs === 1) return '1 hour ago';
    if (mins > 1)  return `${mins} min ago`;
    return 'just now';
  };

  return (
    <PageShell>
      <PageHeader title="📋 Activity Log" subtitle="All AI and staff actions across all clients" />

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input placeholder="Search by client name…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Tabs value={type} onValueChange={(v) => setType(v as any)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="ai">AI Agent</TabsTrigger>
              <TabsTrigger value="staff">Staff</TabsTrigger>
              <TabsTrigger value="client">Client</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
        ) : (
          <Card>
            <CardContent className="pt-6 space-y-3">
              {filtered.map((e) => (
                <div key={e.id} className="flex items-start gap-3 border-b last:border-0 pb-3 last:pb-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${bgFor(e.actor_type)}`}>{iconFor(e.actor_type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{e.actor}</span> — {e.action}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {e.clients?.name && <Badge variant="outline" className="text-xs">{e.clients.name}</Badge>}
                      <span className="text-xs text-gray-500">{relativeTime(e.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && <p className="text-center text-gray-400 py-6">No activity matches your filters.</p>}
            </CardContent>
          </Card>
        )}
      </main>
    </PageShell>
  );
};

export default Activity;
