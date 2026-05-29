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
  { id: '1', agent: 'Doc Classifier Agent', action: 'Scanned "1099-NEC-MBrown.pdf" → Filed to 1099-NEC / 2024 folder ✅', client: 'Michael Brown', result: 'success', timestamp: seed(2) },
  { id: '2', agent: 'Duplicate Detector Agent', action: 'Matched "W2_Smith_2024.pdf" against existing upload → Duplicate blocked 🔁', client: 'John Smith', result: 'info', timestamp: seed(8) },
  { id: '3', agent: 'Missing Doc Tracker Agent', action: 'Michael Brown missing 4 docs → Queued for follow-up 📋', client: 'Michael Brown', result: 'warning', timestamp: seed(15) },
  { id: '4', agent: 'Doc Classifier Agent', action: 'Scanned "bankstatement_jan.pdf" → Flagged: not required for tax filing ⚠️', client: 'Sarah Johnson', result: 'warning', timestamp: seed(22) },
  { id: '5', agent: 'Follow-up Sender Agent', action: 'Sent reminder to robert.chen@email.com → "Missing: W-2, 1099-NEC, 1098, Schedule C" 📧', client: 'Robert Chen', result: 'info', timestamp: seed(35) },
  { id: '6', agent: 'Doc Classifier Agent', action: 'Scanned "W2_2023_JohnSmith.pdf" → Wrong year detected: 2023 vs required 2024 ⚠️', client: 'John Smith', result: 'warning', timestamp: seed(48) },
  { id: '7', agent: 'Duplicate Detector Agent', action: 'Scanned batch of 12 files for John Smith → 3 duplicates removed 🗑️', client: 'John Smith', result: 'success', timestamp: seed(60) },
  { id: '8', agent: 'Missing Doc Tracker Agent', action: 'Sarah Johnson checklist complete → All 4 docs verified ✅', client: 'Sarah Johnson', result: 'success', timestamp: seed(75) },
];

const clients = ['John Smith', 'Michael Brown', 'Sarah Johnson', 'Robert Chen', 'Maria Rodriguez'];
const docs = ['W2_2024.pdf', '1099-NEC_Q4.pdf', '1098_mortgage.pdf', 'K-1_partnership.pdf', 'Schedule_C.pdf', 'receipts_jan.pdf'];
const folders = ['W-2 / 2024', '1099-NEC / 2024', '1098 / 2024', 'K-1 / 2024'];

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

const generators: Array<() => Omit<FeedEntry, 'id' | 'timestamp'>> = [
  () => {
    const c = pick(clients); const d = pick(docs); const f = pick(folders);
    return { agent: 'Doc Classifier Agent', action: `Scanned "${d}" → Filed to ${f} folder ✅`, client: c, result: 'success' };
  },
  () => {
    const c = pick(clients);
    return { agent: 'Duplicate Detector Agent', action: `Checked ${c} uploads → No duplicates found ✅`, client: c, result: 'success' };
  },
  () => {
    const c = pick(clients); const n = Math.floor(Math.random() * 4) + 1;
    return { agent: 'Missing Doc Tracker Agent', action: `Updated checklist for ${c} → ${n} docs remaining 📋`, client: c, result: n > 2 ? 'warning' : 'info' };
  },
  () => {
    const c = pick(clients);
    return { agent: 'Follow-up Sender Agent', action: `Sent reminder email to ${c.toLowerCase().replace(' ', '.')}@email.com 📧`, client: c, result: 'info' };
  },
  () => {
    const c = pick(clients); const d = pick(docs);
    return { agent: 'Doc Classifier Agent', action: `Scanned "${d}" → Auto-classified and indexed ✅`, client: c, result: 'success' };
  },
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

  useEffect(() => {
    const interval = setInterval(() => {
      const gen = pick(generators)();
      const newEntry: FeedEntry = { ...gen, id: String(counter.current++), timestamp: new Date() };
      setEntries(prev => [newEntry, ...prev].slice(0, 12));
    }, 4000);
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
