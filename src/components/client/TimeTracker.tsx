import React, { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { startTimeEntry, stopTimeEntry } from '@/lib/db';

interface Props {
  clientId: string;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
}

const TimeTracker: React.FC<Props> = ({ clientId }) => {
  const { user } = useAuth();
  const [elapsed, setElapsed] = useState(0);
  const entryIdRef = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user || user.role === 'client') return;

    let mounted = true;

    startTimeEntry(clientId, user.email).then(id => {
      if (!mounted) {
        stopTimeEntry(id).catch(() => {});
        return;
      }
      entryIdRef.current = id;
      intervalRef.current = setInterval(() => {
        setElapsed(prev => prev + 1);
      }, 1000);
    }).catch(() => {});

    return () => {
      mounted = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (entryIdRef.current) {
        stopTimeEntry(entryIdRef.current).catch(() => {});
        entryIdRef.current = null;
      }
    };
  }, [clientId, user]);

  if (!user || user.role === 'client') return null;

  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 rounded-md px-2.5 py-1.5">
      <Clock className="w-3.5 h-3.5" />
      <span>Session: {formatTime(elapsed)}</span>
    </div>
  );
};

export default TimeTracker;
