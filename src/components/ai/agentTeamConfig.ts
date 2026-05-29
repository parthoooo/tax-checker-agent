export interface BMAgent {
  name: string;
  slug: string;
  description: string;
  icon: string;
  status: 'active' | 'idle' | 'processing';
  tasksCompleted: number;
  capabilities: string[];
}

export interface BMAgentTeam {
  id: string;
  name: string;
  tagline: string;
  accentColor: string;
  gradientFrom: string;
  gradientTo: string;
  agents: BMAgent[];
}

export const documentIntelligenceTeam: BMAgentTeam = {
  id: 'document-intelligence',
  name: 'Document Intelligence Team',
  tagline: 'AI agents working 24/7 to classify, validate, and chase your client documents',
  accentColor: 'border-b-blue-600',
  gradientFrom: '210 85% 45%',
  gradientTo: '230 90% 55%',
  agents: [
    {
      name: 'Doc Classifier Agent',
      slug: 'doc-classifier',
      description: 'Scans every uploaded file, identifies document type and tax year, routes to the correct folder automatically.',
      icon: 'ScanSearch',
      status: 'active',
      tasksCompleted: 247,
      capabilities: [
        'Identify W-2, 1099-NEC, 1098, K-1, Schedule C by content',
        'Extract tax year from document metadata',
        'Auto-route files to correct year/category folder',
        'Flag unrecognized documents for human review',
      ],
    },
    {
      name: 'Duplicate Detector Agent',
      slug: 'duplicate-detector',
      description: 'Compares every upload against existing files. Catches exact duplicates and near-duplicates before staff wastes time.',
      icon: 'Copy',
      status: 'active',
      tasksCompleted: 189,
      capabilities: [
        'Detect exact file duplicates by hash',
        'Identify near-duplicates (same doc, different scan)',
        'Auto-reject or flag duplicates before staff review',
        'Log duplicate patterns by client for reporting',
      ],
    },
    {
      name: 'Missing Doc Tracker Agent',
      slug: 'missing-doc-tracker',
      description: 'Monitors each client checklist in real time. Automatically generates the missing document list and queues follow-ups.',
      icon: 'ClipboardList',
      status: 'active',
      tasksCompleted: 312,
      capabilities: [
        'Track required vs received documents per client',
        'Generate dynamic missing doc lists per client',
        'Prioritize clients by filing deadline proximity',
        'Queue automated follow-up sequences',
      ],
    },
    {
      name: 'Follow-up Sender Agent',
      slug: 'followup-sender',
      description: 'Drafts and sends personalized reminder emails to clients with missing documents. No staff time required.',
      icon: 'MailCheck',
      status: 'idle',
      tasksCompleted: 94,
      capabilities: [
        'Draft personalized missing-doc reminder emails',
        'Send automated follow-ups on schedule',
        'Escalate unresponsive clients to staff',
        'Track email open and response rates',
      ],
    },
  ],
};
