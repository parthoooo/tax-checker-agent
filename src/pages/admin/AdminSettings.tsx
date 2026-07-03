import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import PageShell from '@/components/layout/PageShell';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Copy, Clock, Mail, Users, Database, ArrowRight, Lock } from 'lucide-react';
import { toast } from 'sonner';
import {
  DEMO_STAFF,
  FIRM_NAME,
  getPortalOrigin,
} from '@/lib/branding';

const users = [
  { name: DEMO_STAFF.admin.fullName, email: DEMO_STAFF.admin.email, role: 'Admin' },
  { name: DEMO_STAFF.preparer1.fullName, email: DEMO_STAFF.preparer1.email, role: 'Staff' },
  { name: DEMO_STAFF.preparer2.fullName, email: DEMO_STAFF.preparer2.email, role: 'Staff' },
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
  const [firmName, setFirmName] = useState(FIRM_NAME);

  return (
    <PageShell>
      <PageHeader
        title="⚙️ Admin Settings"
        actions={
          <Button variant="outline" asChild>
            <Link to="/admin/guide">Open Admin Guide</Link>
          </Button>
        }
      />

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users">User Management</TabsTrigger>
            <TabsTrigger value="docs">Document Types</TabsTrigger>
            <TabsTrigger value="cch">CCH Integration</TabsTrigger>
            <TabsTrigger value="outlook">Outlook</TabsTrigger>
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

          {/* CCH Integration */}
          <TabsContent value="cch">
            <div className="space-y-4">
              <Card className="border-l-4 border-l-amber-400">
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                      <Clock className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Status: Pending — API key required</p>
                      <p className="text-xs text-gray-500 mt-0.5">Waiting for Andrew / Nick to provide CCH Axcess API credentials</p>
                    </div>
                    <Badge className="ml-auto bg-amber-100 text-amber-700">Pending</Badge>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-5 pb-5">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Database className="w-4 h-4 text-blue-500" /> What CCH Integration Unlocks
                    </h3>
                    <ul className="space-y-2 text-sm text-gray-700">
                      {[
                        'Sync client list automatically from CCH Axcess',
                        'Pull prior-year return data to pre-fill input sheets',
                        'Import document requirements per engagement type',
                        'Push completed tax data back to CCH for e-filing',
                        'Eliminate manual re-keying of return data',
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <ArrowRight className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-5 pb-5 space-y-4">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Lock className="w-4 h-4 text-gray-400" /> API Credentials
                    </h3>
                    <div>
                      <Label className="text-xs text-gray-500">CCH Axcess API Key</Label>
                      <Input
                        type="password"
                        placeholder="Waiting for credentials from Andrew..."
                        disabled
                        className="mt-1 bg-gray-50 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Firm ID</Label>
                      <Input
                        placeholder="Provided by CCH support"
                        disabled
                        className="mt-1 bg-gray-50 cursor-not-allowed"
                      />
                    </div>
                    <Button
                      disabled
                      className="w-full"
                      onClick={() => toast.info('CCH API credentials required. Contact Andrew or Nick.')}
                    >
                      Connect CCH Axcess
                    </Button>
                    <p className="text-xs text-gray-400 text-center">
                      Once credentials are provided, this integration activates within minutes.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Outlook Integration */}
          <TabsContent value="outlook">
            <div className="space-y-4">
              <Card className="border-l-4 border-l-indigo-400">
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                      <Mail className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Status: OAuth setup required</p>
                      <p className="text-xs text-gray-500 mt-0.5">Connect each preparer's Outlook to send AI-drafted emails directly from their address</p>
                    </div>
                    <Badge className="ml-auto bg-indigo-100 text-indigo-700">Pending</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Users className="w-4 h-4 text-indigo-500" /> Preparer Connections
                    </h3>
                    <p className="text-xs text-gray-400">Connect each account to send approved emails from their mailbox</p>
                  </div>
                  <div className="space-y-3">
                    {[
                      { name: DEMO_STAFF.admin.fullName, email: DEMO_STAFF.admin.email, role: 'Admin' },
                      { name: DEMO_STAFF.preparer1.fullName, email: DEMO_STAFF.preparer1.email, role: 'Preparer' },
                      { name: DEMO_STAFF.preparer2.fullName, email: DEMO_STAFF.preparer2.email, role: 'Preparer' },
                    ].map((person, i) => (
                      <div key={i} className="flex items-center gap-4 p-3 border rounded-lg">
                        <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold shrink-0">
                          {person.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{person.name}</p>
                          <p className="text-xs text-gray-500">{person.email} · {person.role}</p>
                        </div>
                        <Badge className="bg-gray-100 text-gray-500 shrink-0">
                          <Clock className="w-3 h-3 mr-1" /> Pending
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toast.info(`OAuth setup required for ${person.email}. Contact your Microsoft 365 admin.`)}
                        >
                          Connect Outlook
                        </Button>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-4 text-center">
                    Requires Microsoft 365 admin consent. Once connected, approved emails send directly from each preparer's mailbox.
                  </p>
                </CardContent>
              </Card>
            </div>
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
                    <Input value={getPortalOrigin() || 'http://localhost:8080'} readOnly />
                    <Button variant="outline" onClick={() => {
                      navigator.clipboard.writeText(getPortalOrigin() || window.location.origin);
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
