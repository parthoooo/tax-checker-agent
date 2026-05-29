import React, { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { saveReminder, logActivity } from '@/lib/db';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  open: boolean;
  onClose: () => void;
  clientId?: string;
  clientName?: string;
  clientEmail?: string;
}

const ReminderModal: React.FC<Props> = ({ open, onClose, clientId, clientName, clientEmail }) => {
  const { user, session } = useAuth();
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const defaultBody = clientName
    ? `Hi ${clientName.split(' ')[0]},\n\nThis is a friendly reminder that we still need a few documents to complete your 2024 tax filing.\n\nPlease log in to your portal at brodermansoor.buildyourai.consulting to upload them at your convenience.\n\nThank you,\nBroder-Mansoor & Associates`
    : '';

  const handleSend = async () => {
    const body    = bodyRef.current?.value ?? defaultBody;
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
            <Textarea ref={bodyRef} rows={8} defaultValue={defaultBody} className="text-sm" />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSend}>✅ Send Email</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReminderModal;
