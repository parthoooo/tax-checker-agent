import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageShell from '@/components/layout/PageShell';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Mail } from 'lucide-react';
import { mockClients, initials, statusBadge } from '@/lib/mockData';
import ReminderModal from '@/components/common/ReminderModal';
import { toast } from 'sonner';

interface DocRow {
  type: string; year: string; required: boolean;
  status: string; statusColor: string;
  aiResult: string; aiColor: string;
  fileName?: string; uploadedDate?: string;
  action: 'remove' | 'upload';
}

const docsByClient: Record<string, DocRow[]> = {
  'john-smith': [
    { type: 'W-2', year: '2024', required: true, status: '⚠️ Wrong Year', statusColor: 'bg-red-100 text-red-700', aiResult: '🔴 Wrong Year Detected', aiColor: 'text-red-700', fileName: 'W2_2023_JohnSmith.pdf', uploadedDate: 'Jan 12, 2025', action: 'remove' },
    { type: '1099-NEC', year: '2024', required: true, status: '✅ Verified', statusColor: 'bg-green-100 text-green-700', aiResult: '🟢 AI Verified', aiColor: 'text-green-700', fileName: '1099_JohnSmith.pdf', uploadedDate: 'Jan 10, 2025', action: 'remove' },
    { type: '1098', year: '2024', required: true, status: '✅ Verified', statusColor: 'bg-green-100 text-green-700', aiResult: '🟢 AI Verified', aiColor: 'text-green-700', fileName: '1098_mortgage.pdf', uploadedDate: 'Jan 11, 2025', action: 'remove' },
    { type: 'Schedule C', year: '2024', required: true, status: '⏳ Pending', statusColor: 'bg-gray-100 text-gray-700', aiResult: '—', aiColor: 'text-gray-400', action: 'upload' },
  ],
};

const activityByClient: Record<string, { icon: string; actor: string; action: string; time: string; type: 'ai' | 'staff' | 'client' }[]> = {
  'john-smith': [
    { icon: '🤖', actor: 'Doc Classifier Agent', action: 'Flagged W2_2023_JohnSmith.pdf as wrong year', time: '2 hours ago', type: 'ai' },
    { icon: '🤖', actor: 'Duplicate Detector Agent', action: 'Scanned 1099_JohnSmith.pdf — no duplicates found', time: '2 hours ago', type: 'ai' },
    { icon: '👤', actor: 'Shawn', action: 'Sent missing document reminder email', time: '1 day ago', type: 'staff' },
    { icon: '🤖', actor: 'Doc Classifier Agent', action: 'Verified 1098_mortgage.pdf as 2024 1098', time: 'Jan 11, 2025', type: 'ai' },
    { icon: '👤', actor: 'John Smith', action: 'Uploaded 1099_JohnSmith.pdf', time: 'Jan 10, 2025', type: 'client' },
  ],
};

const ClientDetail: React.FC = () => {
  const { id = '' } = useParams();
  const client = mockClients.find(c => c.id === id) || mockClients[0];
  const [reminderOpen, setReminderOpen] = useState(false);
  const [note, setNote] = useState('');

  const docs = docsByClient[client.id] || [
    { type: 'W-2', year: '2024', required: true, status: '⏳ Pending', statusColor: 'bg-gray-100 text-gray-700', aiResult: '—', aiColor: 'text-gray-400', action: 'upload' },
    { type: '1099-NEC', year: '2024', required: true, status: '⏳ Pending', statusColor: 'bg-gray-100 text-gray-700', aiResult: '—', aiColor: 'text-gray-400', action: 'upload' },
    { type: '1098', year: '2024', required: true, status: '⏳ Pending', statusColor: 'bg-gray-100 text-gray-700', aiResult: '—', aiColor: 'text-gray-400', action: 'upload' },
    { type: 'Schedule C', year: '2024', required: true, status: '⏳ Pending', statusColor: 'bg-gray-100 text-gray-700', aiResult: '—', aiColor: 'text-gray-400', action: 'upload' },
  ];
  const activity = activityByClient[client.id] || [];

  return (
    <PageShell>
      <PageHeader
        title={client.name}
        subtitle={`${client.email} • ${client.phone}`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/clients"><ArrowLeft className="w-4 h-4 mr-1" /> Back to Clients</Link>
            </Button>
            <Button onClick={() => setReminderOpen(true)}>
              <Mail className="w-4 h-4 mr-1" /> Send Reminder
            </Button>
          </>
        }
      />

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <Card>
          <CardContent className="pt-6 flex flex-wrap items-center gap-6">
            <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-lg font-semibold">{initials(client.name)}</div>
            <div className="flex-1">
              <p className="font-medium">{client.name}</p>
              <p className="text-sm text-gray-500">{client.email}</p>
            </div>
            <div className="flex gap-3">
              <Badge className={statusBadge(client.status)}>{client.status}</Badge>
              <Badge variant="outline">Assigned: {client.assignedStaff}</Badge>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="docs">
          <TabsList>
            <TabsTrigger value="docs">Document Checklist</TabsTrigger>
            <TabsTrigger value="flags">AI Flags</TabsTrigger>
            <TabsTrigger value="activity">Activity Log</TabsTrigger>
            <TabsTrigger value="notes">Internal Notes</TabsTrigger>
          </TabsList>

          <TabsContent value="docs">
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
                      <th className="py-3 px-4">Document Type</th>
                      <th className="py-3 px-4">Tax Year</th>
                      <th className="py-3 px-4">Required</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">AI Result</th>
                      <th className="py-3 px-4">File Name</th>
                      <th className="py-3 px-4">Uploaded</th>
                      <th className="py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docs.map((d, i) => (
                      <tr key={i} className="border-b">
                        <td className="py-3 px-4 font-medium">{d.type}</td>
                        <td className="py-3 px-4">{d.year}</td>
                        <td className="py-3 px-4">{d.required ? 'Yes' : 'Optional'}</td>
                        <td className="py-3 px-4"><Badge className={d.statusColor}>{d.status}</Badge></td>
                        <td className={`py-3 px-4 ${d.aiColor}`}>{d.aiResult}</td>
                        <td className="py-3 px-4 text-gray-700">{d.fileName || '—'}</td>
                        <td className="py-3 px-4 text-gray-600">{d.uploadedDate || '—'}</td>
                        <td className="py-3 px-4">
                          {d.action === 'remove'
                            ? <Button variant="outline" size="sm" onClick={() => toast.success('File removed')}>Remove</Button>
                            : <Button size="sm" onClick={() => toast.success('Upload prompt sent to client')}>Upload</Button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="flags">
            {client.id === 'john-smith' ? (
              <Card className="border-l-4 border-l-red-500">
                <CardContent className="pt-6">
                  <p className="font-semibold text-red-700">⚠️ Wrong Year W-2 uploaded</p>
                  <p className="text-sm mt-2">Client uploaded W2_2023_JohnSmith.pdf but the required tax year is 2024.</p>
                  <p className="text-xs text-gray-500 mt-1">Detected by Doc Classifier Agent</p>
                  <Button size="sm" className="mt-3 bg-red-600 hover:bg-red-700"
                    onClick={() => toast.success('Correction request sent', { description: 'Email sent to John Smith' })}>
                    📧 Send Correction Request
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card><CardContent className="pt-6 text-sm text-gray-500">No open AI flags for this client.</CardContent></Card>
            )}
          </TabsContent>

          <TabsContent value="activity">
            <Card>
              <CardContent className="pt-6 space-y-3">
                {activity.length === 0 && <p className="text-sm text-gray-500">No activity yet.</p>}
                {activity.map((a, i) => (
                  <div key={i} className="flex items-start gap-3 border-b last:border-0 pb-3 last:pb-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${a.type === 'ai' ? 'bg-purple-100' : a.type === 'staff' ? 'bg-blue-100' : 'bg-gray-100'}`}>{a.icon}</div>
                    <div className="flex-1">
                      <p className="text-sm"><span className="font-medium">{a.actor}</span> — {a.action}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{a.time}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notes">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="border-l-4 border-l-blue-400 bg-blue-50 p-3 rounded">
                  <p className="text-sm">Client confirmed he will re-upload correct 2024 W-2 by Friday.</p>
                  <p className="text-xs text-gray-500 mt-1">— Shawn, Jan 13</p>
                </div>
                <Textarea rows={4} placeholder="Add an internal note..." value={note} onChange={(e) => setNote(e.target.value)} />
                <Button onClick={() => { toast.success('Note saved'); setNote(''); }}>Save Note</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <ReminderModal open={reminderOpen} onClose={() => setReminderOpen(false)} clientName={client.name} clientEmail={client.email} />
    </PageShell>
  );
};

export default ClientDetail;
