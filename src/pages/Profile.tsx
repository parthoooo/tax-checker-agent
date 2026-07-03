import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import PageShell from '@/components/layout/PageShell';
import PageHeader from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { initials } from '@/lib/mockData';
import { fetchClientByAuthUser, updateOwnProfile } from '@/lib/db';
import { CURRENT_TAX_YEAR } from '@/lib/taxConfig';
import { toast } from 'sonner';

const Profile: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setName(user.name);
    setPhone('');

    (async () => {
      try {
        const client = await fetchClientByAuthUser(user.id);
        if (!cancelled) {
          setName(client?.name ?? user.name);
          setPhone(client?.phone ?? '');
        }
      } catch {
        if (!cancelled) setPhone('');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) return null;

  const roleLabel = user.role === 'admin' ? 'Admin' : user.role === 'preparer' ? 'Preparer' : 'Client';

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      await updateOwnProfile({ name, phone });
      await refreshUser();
      toast.success('Profile updated', {
        description: 'Your contact information was saved.',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Please try again.';
      toast.error('Could not save profile', { description: message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell>
      <PageHeader title="👤 Profile" />
      <main className="max-w-2xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Card>
          <CardContent className="pt-6 space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xl font-semibold">
                {initials(name || user.name)}
              </div>
              <Badge variant="outline">{roleLabel}</Badge>
            </div>
            <div>
              <Label htmlFor="profile-name">Full Name</Label>
              <Input
                id="profile-name"
                value={name}
                disabled={loading || saving}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="profile-email">Email</Label>
              <Input id="profile-email" value={user.email} readOnly />
            </div>
            <div>
              <Label htmlFor="profile-phone">Phone</Label>
              <Input
                id="profile-phone"
                value={phone}
                disabled={loading || saving}
                placeholder="(555) 123-4567"
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            {user.role === 'admin' && (
              <div>
                <Label>Tax Season</Label>
                <Input value={CURRENT_TAX_YEAR} readOnly />
              </div>
            )}
            <Button onClick={handleSave} disabled={loading || saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </CardContent>
        </Card>
      </main>
    </PageShell>
  );
};

export default Profile;
