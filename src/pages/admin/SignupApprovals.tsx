import React, { useCallback, useEffect, useState } from 'react';
import PageShell from '@/components/layout/PageShell';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, UserCheck, UserX } from 'lucide-react';
import { toast } from 'sonner';
import {
  approveSignupRequest,
  fetchPendingSignupRequests,
  rejectSignupRequest,
  type SignupRequest,
  type SignupRole,
} from '@/lib/signupRequests';
import { Link } from 'react-router-dom';

const SignupApprovals: React.FC = () => {
  const [requests, setRequests] = useState<SignupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SignupRequest | null>(null);
  const [approveRole, setApproveRole] = useState<SignupRole>('client');
  const [rejectReason, setRejectReason] = useState('');
  const [dialogMode, setDialogMode] = useState<'approve' | 'reject' | null>(null);
  const [processing, setProcessing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRequests(await fetchPendingSignupRequests());
    } catch (err: any) {
      toast.error('Failed to load sign-up requests', { description: err?.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openApprove = (req: SignupRequest) => {
    setSelected(req);
    setApproveRole('client');
    setDialogMode('approve');
  };

  const openReject = (req: SignupRequest) => {
    setSelected(req);
    setRejectReason('');
    setDialogMode('reject');
  };

  const handleApprove = async () => {
    if (!selected) return;
    setProcessing(true);
    try {
      await approveSignupRequest(selected.id, approveRole);
      toast.success('User approved', {
        description: `${selected.email} can now sign in as ${approveRole}.`,
      });
      setDialogMode(null);
      setSelected(null);
      await load();
    } catch (err: any) {
      toast.error('Approval failed', { description: err?.message });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selected) return;
    setProcessing(true);
    try {
      await rejectSignupRequest(selected.id, rejectReason || undefined);
      toast.success('Sign-up rejected', { description: selected.email });
      setDialogMode(null);
      setSelected(null);
      await load();
    } catch (err: any) {
      toast.error('Reject failed', { description: err?.message });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Sign-up Approvals"
        subtitle="Review new Google and email registrations before granting portal access"
        actions={
          <Button variant="outline" asChild>
            <Link to="/clients">← All Clients</Link>
          </Button>
        }
      />

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : requests.length === 0 ? (
          <Card>
            <CardContent className="pt-8 pb-8 text-center text-muted-foreground">
              No pending sign-ups. New Google or Create Account users will appear here.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Provider</th>
                    <th className="py-3 px-4">Requested</th>
                    <th className="py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => (
                    <tr key={req.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <p className="font-medium">{req.full_name}</p>
                        <p className="text-xs text-gray-500">{req.email}</p>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="capitalize">{req.provider}</Badge>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {new Date(req.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => openApprove(req)}>
                            <UserCheck className="w-3.5 h-3.5 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openReject(req)}>
                            <UserX className="w-3.5 h-3.5 mr-1" /> Reject
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </main>

      <Dialog open={dialogMode === 'approve'} onOpenChange={(o) => !o && setDialogMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve sign-up</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Grant access to <strong>{selected.full_name}</strong> ({selected.email})
              </p>
              <div>
                <Label>Role</Label>
                <Select value={approveRole} onValueChange={(v) => setApproveRole(v as SignupRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client">Client — document upload portal</SelectItem>
                    <SelectItem value="preparer">Preparer — staff dashboard</SelectItem>
                    <SelectItem value="admin">Admin — full access</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {approveRole === 'client' && (
                <p className="text-xs text-muted-foreground">
                  Creates (or links) a client profile with the 2025 document checklist and 2024 baseline.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)} disabled={processing}>Cancel</Button>
            <Button onClick={handleApprove} disabled={processing}>
              {processing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogMode === 'reject'} onOpenChange={(o) => !o && setDialogMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject sign-up</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              placeholder="Optional reason (shown internally only)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)} disabled={processing}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={processing}>
              {processing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
};

export default SignupApprovals;
