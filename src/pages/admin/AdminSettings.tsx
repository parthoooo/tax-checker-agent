import React, { useState } from 'react';
import PageShell from '@/components/layout/PageShell';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Copy } from 'lucide-react';
import { toast } from 'sonner';

const users = [
  { name: 'Nick Muqtadir', email: 'nick@brodermansoor.com', role: 'Admin' },
  { name: 'Shawn', email: 'shawn@brodermansoor.com', role: 'Staff' },
  { name: 'Girik', email: 'girik@brodermansoor.com', role: 'Staff' },
  { name: 'John Smith', email: 'john@email.com', role: 'Client' },
  { name: 'Michael Brown', email: 'mbrown@email.com', role: 'Client' },
  { name: 'Sarah Johnson', email: 'sjohnson@email.com', role: 'Client' },
  { name: 'Robert Chen', email: 'rchen@email.com', role: 'Client' },
  { name: 'Maria Rodriguez', email: 'mrodriguez@email.com', role: 'Client' },
];

const docTypes = [
  { code: 'W-2', name: 'Wage and Tax Statement', required: 'Required by default' },
  { code: '1099-NEC', name: 'Non-Employee Compensation', required: 'Required by default' },
  { code: '1098', name: 'Mortgage Interest Statement', required: 'Required by default' },
  { code: 'K-1', name: 'Partnership Income', required: 'Optional' },
  { code: 'Schedule C', name: 'Business Profit/Loss', required: 'Required by default' },
];

const AdminSettings: React.FC = () => {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [firmName, setFirmName] = useState('Broder-Mansoor & Associates');

  return (
    <PageShell>
      <PageHeader title="⚙️ Admin Settings" />

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users">User Management</TabsTrigger>
            <TabsTrigger value="taxdome">TaxDome Integration</TabsTrigger>
            <TabsTrigger value="docs">Document Types</TabsTrigger>
            <TabsTrigger value="branding">Branding</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card>
              <CardContent className="pt-6">
                <div className="flex justify-end mb-3">
                  <Button onClick={() => setInviteOpen(true)}><Plus className="w-4 h-4 mr-1" /> Invite User</Button>
                </div>
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
                    <th className="py-3 px-4">Name</th><th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Role</th><th className="py-3 px-4">Status</th><th className="py-3 px-4">Actions</th>
                  </tr></thead>
                  <tbody>
                    {users.map((u, i) => (
                      <tr key={i} className="border-b">
                        <td className="py-3 px-4 font-medium">{u.name}</td>
                        <td className="py-3 px-4 text-gray-600">{u.email}</td>
                        <td className="py-3 px-4"><Badge variant="outline">{u.role}</Badge></td>
                        <td className="py-3 px-4"><Badge className="bg-green-100 text-green-700">Active</Badge></td>
                        <td className="py-3 px-4 flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => toast.success(`Editing ${u.name}`)}>Edit</Button>
                          <Button size="sm" variant="outline" onClick={() => toast.success(`${u.name} deactivated`)}>Deactivate</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="taxdome">
            <Card>
              <CardContent className="pt-6 space-y-4 max-w-xl">
                <div>
                  <Label>TaxDome API Key</Label>
                  <Input type="password" placeholder="sk-taxdome-••••••••••••" />
                </div>
                <div className="flex items-center gap-3">
                  <Button onClick={() => toast.info('TaxDome API integration is coming in Phase 2')}>Connect</Button>
                  <Badge className="bg-gray-100 text-gray-700">⏳ Not Connected</Badge>
                </div>
                <p className="text-sm text-gray-500">Connect your TaxDome account to automatically sync your client list and document folders.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="docs">
            <Card>
              <CardContent className="pt-6">
                <div className="flex justify-end mb-3">
                  <Button onClick={() => toast.success('Add a new document type')}><Plus className="w-4 h-4 mr-1" /> Add Document Type</Button>
                </div>
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
                    <th className="py-3 px-4">Code</th><th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Requirement</th><th className="py-3 px-4">Status</th>
                  </tr></thead>
                  <tbody>
                    {docTypes.map((d, i) => (
                      <tr key={i} className="border-b">
                        <td className="py-3 px-4 font-medium">{d.code}</td>
                        <td className="py-3 px-4">{d.name}</td>
                        <td className="py-3 px-4 text-gray-600">{d.required}</td>
                        <td className="py-3 px-4"><Badge className="bg-green-100 text-green-700">Active</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="branding">
            <Card>
              <CardContent className="pt-6 space-y-4 max-w-xl">
                <div>
                  <Label>Firm Name</Label>
                  <Input value={firmName} onChange={(e) => setFirmName(e.target.value)} />
                </div>
                <div>
                  <Label>Portal URL</Label>
                  <div className="flex gap-2">
                    <Input value="brodermansoor.buildyourai.consulting" readOnly />
                    <Button variant="outline" onClick={() => {
                      navigator.clipboard.writeText('brodermansoor.buildyourai.consulting');
                      toast.success('Copied to clipboard');
                    }}><Copy className="w-4 h-4" /></Button>
                  </div>
                </div>
                <div>
                  <Label>Logo</Label>
                  <div className="border-2 border-dashed rounded-lg p-8 text-center text-sm text-gray-500">
                    Upload Logo
                  </div>
                </div>
                <Button onClick={() => toast.success('Settings saved')}>Save Changes</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite User</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input placeholder="Jane Doe" /></div>
            <div><Label>Email</Label><Input type="email" placeholder="jane@email.com" /></div>
            <div>
              <Label>Role</Label>
              <select className="w-full border rounded-md h-10 px-3 text-sm">
                <option>Admin</option><option>Staff</option><option>Client</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={() => { toast.success('Invite sent'); setInviteOpen(false); }}>Send Invite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
};

export default AdminSettings;
