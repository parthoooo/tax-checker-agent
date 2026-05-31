import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { saveReminder, logActivity } from '@/lib/db';
import { generateEmailDraft } from '@/lib/aiSimulation';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  open: boolean;
  onClose: () => void;
  clientId?: string;
  clientName?: string;
  clientEmail?: string;
  missingDocs?: string[];
}

const ReminderModal: React.FC<Props> = ({
  open,
  onClose,
  clientId,
  clientName,
  clientEmail,
  missingDocs = [],
}) => {
  const { user, session } = useAuth();
  const [body, setBody] = useState('');
  const [drafting, setDrafting] = useState(false);

  const draft = async () => {
    if (!clientName) return;
    setDrafting(true);
    try {
      const text = await generateEmailDraft(
        clientName,
        missingDocs,
        user?.name ?? 'Your Tax Preparer',
      );
      setBody(text);
    } finally {
      setDrafting(false);
    }
  };

  useEffect(() => {
    if (open && clientName) {
      setBody('');
      draft();
    }
  }, [open, clientName]);

  const handleSend = async () => {
    const subject = 'Action Required: Missing Tax Documents';
    try {
      if (clientId && clientEmail) {
        await saveReminder({
          client_id: clientId,
          sent_by:   session?.user?.id ?? null,
          to_email:  clientEmail,
          subject,
          body,
        });

        await logActivity({
          client_id:  clientId,
          actor:      user?.name ?? 'Admin',
          actor_type: 'staff',
          action:     `Sent reminder email to ${clientName ?? clientEmail}`,
        });
      }

      toast.success('Email sent', { description: `Reminder sent to ${clientEmail}` });
      onClose();
    } catch (err: any) {
      toast.error('Failed to save reminder', { description: err?.message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send Reminder Email</DialogTitle>
        </DialogHeader>

        {clientName && (
          <div className="space-y-3">
            <div className="text-sm"><span className="text-gray-500">To:</span> <span className="font-medium">{clientEmail}</span></div>
            <div className="text-sm"><span className="text-gray-500">Subject:</span> <span className="font-medium">Action Required: Missing Tax Documents</span></div>

            {drafting ? (
              <div className="flex items-center gap-2 py-6 justify-center text-blue-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Drafting email…</span>
              </div>
            ) : (
              <Textarea
                rows={9}
                value={body}
                onChange={e => setBody(e.target.value)}
                className="text-sm"
              />
            )}
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={draft}
            disabled={drafting || !clientName}
            className="gap-1.5"
          >
            {drafting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '🔄'}
            Regenerate
          </Button>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSend} disabled={drafting || !body}>✅ Send Email</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReminderModal;
