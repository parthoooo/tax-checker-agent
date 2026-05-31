import React, { useEffect, useState, useRef } from 'react';

interface FeedEntry {
  id: string;
  agent: string;
  action: string;
  client: string;
  result: 'success' | 'warning' | 'info';
  timestamp: Date;
}

const now = Date.now();
const seed = (offsetSec: number): Date => new Date(now - offsetSec * 1000);

const initialEntries: FeedEntry[] = [
  { id: '1', agent: 'Doc Classifier Agent',     action: 'Verified W2_2024.pdf for John Smith — employer: Acme Corp, confidence 97%', client: 'John Smith',        result: 'success', timestamp: seed(2)  },
  { id: '2', agent: 'Duplicate Detector Agent', action: 'Blocked duplicate 1099-NEC.pdf from Maria Rodriguez — matches upload from Jan 14', client: 'Maria Rodriguez', result: 'warning', timestamp: seed(9)  },
  { id: '3', agent: 'Missing Doc Tracker Agent',action: 'Robert Chen is missing 3 documents — W-2, 1098, Schedule C — reminder queued', client: 'Robert Chen',      result: 'warning', timestamp: seed(18) },
  { id: '4', agent: 'Follow-up Sender Agent',   action: 'Sent missing doc reminder to michael.brown@email.com — delivered ✅', client: 'Michael Brown',    result: 'info',    timestamp: seed(29) },
  { id: '5', agent: 'Doc Classifier Agent',     action: 'Wrong year detected in W2_2023_sarah.pdf — flagged for correction ⚠️', client: 'Sarah Johnson',   result: 'warning', timestamp: seed(41) },
  { id: '6', agent: 'Duplicate Detector Agent', action: 'Scanned 847 files today — 3 duplicates blocked, 844 accepted ✅', client: 'John Smith',        result: 'success', timestamp: seed(55) },
  { id: '7', agent: 'Missing Doc Tracker Agent','action': 'Sarah Johnson submitted final document — checklist complete ✅', client: 'Sarah Johnson',   result: 'success', timestamp: seed(70) },
  { id: '8', agent: 'Follow-up Sender Agent',   action: 'Reminder email approved by Girik and delivered to robert.chen@email.com', client: 'Robert Chen',      result: 'info',    timestamp: seed(88) },
];

// Pool of 30+ realistic entries
const ENTRY_POOL: Array<Omit<FeedEntry, 'id' | 'timestamp'>> = [
  // Doc Classifier — verified
  { agent: 'Doc Classifier Agent', action: 'Verified W2_2024.pdf for John Smith — employer: Acme Corp, wages detected, confidence 98%', client: 'John Smith', result: 'success' },
  { agent: 'Doc Classifier Agent', action: 'Verified 1099-NEC_Q4.pdf for Michael Brown — payer: Upwork Global, confidence 96%', client: 'Michael Brown', result: 'success' },
  { agent: 'Doc Classifier Agent', action: 'Verified 1098_mortgage.pdf for Robert Chen — lender: Wells Fargo Bank, confidence 97%', client: 'Robert Chen', result: 'success' },
  { agent: 'Doc Classifier Agent', action: 'Verified K-1_partnership.pdf for Sarah Johnson — partnership income fields detected, confidence 95%', client: 'Sarah Johnson', result: 'success' },
  { agent: 'Doc Classifier Agent', action: 'Verified 1099-INT_2024.pdf for Maria Rodriguez — interest income $1,240 detected, confidence 99%', client: 'Maria Rodriguez', result: 'success' },
  { agent: 'Doc Classifier Agent', action: 'Verified Schedule_C.pdf for Robert Chen — gross revenue and expense fields extracted, confidence 94%', client: 'Robert Chen', result: 'success' },
  { agent: 'Doc Classifier Agent', action: 'Verified 1099-DIV_fidelity.pdf for John Smith — ordinary dividends $3,820 detected, confidence 97%', client: 'John Smith', result: 'success' },
  // Doc Classifier — flagged
  { agent: 'Doc Classifier Agent', action: 'Wrong year detected in W2_2023_mjbrown.pdf — 2023 document, 2024 required. Flag created.', client: 'Michael Brown', result: 'warning' },
  { agent: 'Doc Classifier Agent', action: 'Bank statement detected in chase_jan2024.pdf — not required for 2024 filing. Flagged.', client: 'Sarah Johnson', result: 'warning' },
  { agent: 'Doc Classifier Agent', action: 'Possible incomplete document in w2_pg1_only.pdf — standard W-2 has 2–3 pages. Flagged.', client: 'John Smith', result: 'warning' },
  { agent: 'Doc Classifier Agent', action: 'Wrong year detected in 1099_2022_rodriguez.pdf — 2022 document, 2024 required. Flag created.', client: 'Maria Rodriguez', result: 'warning' },
  { agent: 'Doc Classifier Agent', action: 'File size too small (8 KB) for 1099-NEC_rchen.pdf — likely a screenshot. Flagged for review.', client: 'Robert Chen', result: 'warning' },
  // Duplicate Detector
  { agent: 'Duplicate Detector Agent', action: 'Blocked duplicate 1099-NEC.pdf from Maria Rodriguez — matches upload from Jan 14, 9:42 AM', client: 'Maria Rodriguez', result: 'warning' },
  { agent: 'Duplicate Detector Agent', action: 'Blocked duplicate W2_Smith_2024.pdf — identical file already on record from Jan 10', client: 'John Smith', result: 'warning' },
  { agent: 'Duplicate Detector Agent', action: 'Scanned 1,204 files this session — 5 duplicates blocked, 1,199 accepted ✅', client: 'Michael Brown', result: 'success' },
  { agent: 'Duplicate Detector Agent', action: 'No duplicates found in batch of 6 files for Sarah Johnson ✅', client: 'Sarah Johnson', result: 'success' },
  { agent: 'Duplicate Detector Agent', action: 'Blocked duplicate 1098_mortgage.pdf from Robert Chen — same hash as file uploaded Dec 29', client: 'Robert Chen', result: 'warning' },
  { agent: 'Duplicate Detector Agent', action: 'Scanned all uploaded documents today — 2 duplicates removed across 3 clients ✅', client: 'John Smith', result: 'success' },
  // Missing Doc Tracker
  { agent: 'Missing Doc Tracker Agent', action: 'Robert Chen is missing 3 documents — W-2, 1098, Schedule C — follow-up queued', client: 'Robert Chen', result: 'warning' },
  { agent: 'Missing Doc Tracker Agent', action: 'Michael Brown checklist updated — 4 of 6 documents received, 2 still outstanding', client: 'Michael Brown', result: 'info' },
  { agent: 'Missing Doc Tracker Agent', action: 'Sarah Johnson submitted final document — all 4 required docs verified ✅', client: 'Sarah Johnson', result: 'success' },
  { agent: 'Missing Doc Tracker Agent', action: 'Maria Rodriguez is missing K-1 and 1099-DIV — reminder queued for tomorrow', client: 'Maria Rodriguez', result: 'warning' },
  { agent: 'Missing Doc Tracker Agent', action: 'John Smith checklist complete — all 5 documents received and verified ✅', client: 'John Smith', result: 'success' },
  { agent: 'Missing Doc Tracker Agent', action: 'Daily checklist scan complete — 3 clients still have outstanding documents', client: 'Robert Chen', result: 'info' },
  { agent: 'Missing Doc Tracker Agent', action: 'Robert Chen uploaded W-2 — 2 of 4 required docs now received ✅', client: 'Robert Chen', result: 'info' },
  // Follow-up Sender
  { agent: 'Follow-up Sender Agent', action: 'Sent missing doc reminder to robert.chen@email.com — "Missing: W-2, 1099-NEC, 1098, Schedule C"', client: 'Robert Chen', result: 'info' },
  { agent: 'Follow-up Sender Agent', action: 'Reminder email approved by Sean and delivered to maria.rodriguez@email.com ✅', client: 'Maria Rodriguez', result: 'success' },
  { agent: 'Follow-up Sender Agent', action: 'Sent wrong-year correction notice to john.smith@email.com — W2_2023 flagged', client: 'John Smith', result: 'info' },
  { agent: 'Follow-up Sender Agent', action: 'Sent duplicate removal notice to michael.brown@email.com — 1 duplicate auto-resolved', client: 'Michael Brown', result: 'info' },
  { agent: 'Follow-up Sender Agent', action: 'Reminder email approved by Girik and delivered to sarah.johnson@email.com ✅', client: 'Sarah Johnson', result: 'success' },
  { agent: 'Follow-up Sender Agent', action: '3 scheduled reminders sent this morning — all delivered, 0 bounced ✅', client: 'Michael Brown', result: 'success' },
];

const timeAgo = (d: Date) => {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
};

const resultBorder = (r: FeedEntry['result']) =>
  r === 'success' ? 'border-l-green-500' : r === 'warning' ? 'border-l-amber-500' : 'border-l-blue-500';

const AgentActivityFeed: React.FC = () => {
  const [entries, setEntries] = useState<FeedEntry[]>(initialEntries);
  const [, force] = useState(0);
  const counter = useRef(100);
  const lastIndex = useRef(-1);

  useEffect(() => {
    const interval = setInterval(() => {
      // Avoid repeating the same entry twice in a row
      let idx: number;
      do {
        idx = Math.floor(Math.random() * ENTRY_POOL.length);
      } while (idx === lastIndex.current);
      lastIndex.current = idx;

      const newEntry: FeedEntry = {
        ...ENTRY_POOL[idx],
        id: String(counter.current++),
        timestamp: new Date(),
      };
      setEntries(prev => [newEntry, ...prev].slice(0, 12));
    }, 8000);

    const tick = setInterval(() => force(x => x + 1), 1000);
    return () => { clearInterval(interval); clearInterval(tick); };
  }, []);

  return (
    <div className="bg-gray-900 text-gray-100 rounded-xl shadow-lg border border-gray-800 mb-8 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-base">🤖</span>
          <p className="font-semibold text-sm">AI Agent Activity — Live</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-gray-400">Streaming</span>
        </div>
      </div>
      <div className="max-h-[360px] overflow-y-auto">
        {entries.map((e, i) => (
          <div
            key={e.id}
            className={`flex items-start justify-between gap-3 px-4 py-2.5 border-l-4 ${resultBorder(e.result)} border-b border-gray-800/60 hover:bg-gray-800/40 transition-colors ${i === 0 ? 'animate-in slide-in-from-top-2 fade-in duration-500' : ''}`}
            style={{ opacity: Math.max(1 - i * 0.04, 0.5) }}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-semibold text-blue-300">{e.agent}</span>
                <span className="text-gray-300"> → {e.action}</span>
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full whitespace-nowrap">{e.client}</span>
              <span className="text-xs text-gray-500 whitespace-nowrap w-14 text-right">{timeAgo(e.timestamp)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AgentActivityFeed;
