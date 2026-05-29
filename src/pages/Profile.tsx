import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import PageShell from '@/components/layout/PageShell';
import PageHeader from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { initials } from '@/lib/mockData';
import { toast } from 'sonner';

const Profile: React.FC = () => {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState('(555) 000-0000');

  if (!user) return null;
  const roleLabel = user.role === 'admin' ? 'Admin' : 'Client';

  return (
    <PageShell>
      <PageHeader title="👤 Profile" />
      <main className="max-w-2xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Card>
          <CardContent className="pt-6 space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xl font-semibold">{initials(user.name)}</div>
              <Badge variant="outline">{roleLabel}</Badge>
            </div>
            <div><Label>Full Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label>Email</Label><Input value={user.email} readOnly /></div>
            <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            {user.role === 'admin' && (
              <div><Label>Tax Season</Label><Input value="2024" readOnly /></div>
            )}
            <Button onClick={() => toast.success('Profile updated')}>Save Changes</Button>
          </CardContent>
        </Card>
      </main>
    </PageShell>
  );
};

export default Profile;
