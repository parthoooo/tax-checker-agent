import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Copy, Send, Link2, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { generateMagicToken, logActivity } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';

type Client    = Database['public']['Tables']['clients']['Row'];
type DocReq    = Database['public']['Tables']['document_requirements']['Row'];
type DocUpload = Database['public']['Tables']['document_uploads']['Row'];

interface Props {
  client: Client;
  requirements: DocReq[];
  uploads: DocUpload[];
  sentReqIds: Set<string>;
  setSentReqIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  onTokenRefresh: (client: Client) => void;
}

const MagicLinksPanel: React.FC<Props> = ({
  client, requirements, uploads, sentReqIds, setSentReqIds, onTokenRefresh,
}) => {
  const [generating, setGenerating] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);

  const loadActiveToken = async () => {
    const { data } = await (supabase as any)
      .from('magic_link_tokens')
      .select('token, expires_at')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      setToken(data.token);
      setExpiresAt(data.expires_at ? new Date(data.expires_at) : null);
    } else {
      setToken(null);
      setExpiresAt(null);
    }
  };

  useEffect(() => { loadActiveToken(); }, [client.id]);

  const isActive = !!token && (!expiresAt || expiresAt > new Date());
  const url = token ? `https://brodermansoor.buildyourai.consulting/upload/${token}` : '';

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generateMagicToken(client.id);
      await loadActiveToken();
      await logActivity({ client_id: client.id, actor: 'Staff', actor_type: 'staff', action: 'Generated magic link' });
      toast.success(isActive ? 'Link regenerated' : 'Magic link generated');
    } catch (e: any) {
      toast.error('Failed to generate link', { description: e?.message });
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async (label = 'Link copied to clipboard') => {
    if (!url) { toast.error('Generate a link first'); return; }
    await navigator.clipboard.writeText(url);
    toast.success(label, { description: url });
  };

  const handleSend = async (reqId: string, docLabel: string) => {
    if (!url) { toast.error('Generate a link first'); return; }
    await logActivity({
      client_id: client.id,
      actor: 'Staff',
      actor_type: 'staff',
      action: `Magic link emailed for ${docLabel}`,
    });
    setSentReqIds(prev => new Set(prev).add(reqId));
    toast.success(`Link sent to ${client.email}`, { description: docLabel });
  };

  const pendingRows = requirements.map(req => {
    const upload = uploads.find(u => u.requirement_id === req.id);
    return { req, upload };
  });
  const pendingCount = pendingRows.filter(r => !r.upload).length;

  const handleSendAll = async () => {
    if (!url) { toast.error('Generate a link first'); return; }
    if (pendingCount === 0) { toast.info('No pending documents'); return; }
    await logActivity({
      client_id: client.id,
      actor: 'Staff',
      actor_type: 'staff',
      action: `Magic links emailed for ${pendingCount} pending documents`,
    });
    setSentReqIds(prev => {
      const next = new Set(prev);
      pendingRows.filter(r => !r.upload).forEach(r => next.add(r.req.id));
      return next;
    });
    toast.success(`Links queued for ${pendingCount} pending documents`, { description: client.email });
  };

  return (
    <>
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Master upload link</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {isActive
                  ? (expiresAt
                      ? `Active until ${expiresAt.toLocaleDateString()} at ${expiresAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                      : 'Active link ready')
                  : 'No active link. Generate one to share with the client.'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleGenerate} disabled={generating}>
                {generating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Link2 className="w-4 h-4 mr-1" />}
                {isActive ? 'Regenerate' : 'Generate Link'}
              </Button>
              <Button onClick={() => handleCopy('Master link copied!')} disabled={!url}>
                <Copy className="w-4 h-4 mr-1" /> Copy Master Link
              </Button>
            </div>
          </div>
          {url && (
            <div className="bg-gray-50 border rounded p-2 font-mono text-xs text-gray-600 break-all">
              {url}
            </div>
          )}
          <div className="flex justify-between items-center pt-2 border-t">
            <p className="text-xs text-gray-500">
              {pendingCount} pending document{pendingCount === 1 ? '' : 's'}
            </p>
            <Button size="sm" onClick={handleSendAll} disabled={!url || pendingCount === 0}>
              <Send className="w-4 h-4 mr-1" /> Send All Pending
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
                <th className="py-3 px-4">Document</th>
                <th className="py-3 px-4">Year</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingRows.map(({ req, upload }) => {
                const uploaded = !!upload;
                const sent = sentReqIds.has(req.id);
                const statusLabel = uploaded ? 'Uploaded' : sent ? 'Link sent' : 'Not sent';
                const statusCls = uploaded
                  ? 'bg-green-100 text-green-700'
                  : sent
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600';
                const docLabel = `${req.name} ${req.tax_year}`;
                return (
                  <tr key={req.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">{req.name}</td>
                    <td className="py-3 px-4">{req.tax_year}</td>
                    <td className="py-3 px-4">
                      <Badge className={statusCls}>
                        {uploaded && <CheckCircle2 className="w-3 h-3 mr-1 inline" />}
                        {statusLabel}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!url || uploaded}
                          onClick={() => handleCopy(`Link copied for ${docLabel}`)}
                        >
                          <Copy className="w-3.5 h-3.5 mr-1" /> Copy Link
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!url || uploaded}
                          onClick={() => handleSend(req.id, docLabel)}
                        >
                          <Send className="w-3.5 h-3.5 mr-1" /> Send via Email
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {pendingRows.length === 0 && (
                <tr><td colSpan={4} className="text-center py-8 text-gray-400">No document requirements set.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </>
  );
};

export default MagicLinksPanel;