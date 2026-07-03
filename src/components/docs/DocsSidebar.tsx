import React, { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DOC_CATEGORY_META, type DocHeading } from '@/lib/adminGuideContent';
import { Search, ChevronRight } from 'lucide-react';

interface SectionGroup {
  section: DocHeading;
  children: DocHeading[];
}

function groupHeadings(headings: DocHeading[]): SectionGroup[] {
  const groups: SectionGroup[] = [];
  let current: DocHeading | null = null;
  let children: DocHeading[] = [];

  for (const h of headings) {
    if (h.level === 2) {
      if (current) groups.push({ section: current, children });
      current = h;
      children = [];
    } else if (h.level === 3 && current) {
      children.push(h);
    }
  }
  if (current) groups.push({ section: current, children });
  return groups;
}

const DOT_COLOR: Record<string, string> = {
  start: 'bg-slate-500',
  cat1: 'bg-blue-500',
  cat2: 'bg-emerald-500',
  cat3: 'bg-violet-500',
  profession: 'bg-amber-500',
  workflows: 'bg-indigo-500',
  reference: 'bg-gray-500',
};

interface Props {
  headings: DocHeading[];
  activeId: string;
  onNavigate: (id: string) => void;
  className?: string;
}

const DocsSidebar: React.FC<Props> = ({ headings, activeId, onNavigate, className }) => {
  const [query, setQuery] = useState('');
  const groups = useMemo(() => groupHeadings(headings), [headings]);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        children: g.children.filter((c) => c.title.toLowerCase().includes(q)),
      }))
      .filter(
        (g) =>
          g.section.title.toLowerCase().includes(q) || g.children.length > 0,
      );
  }, [groups, query]);

  return (
    <nav className={cn('flex h-full flex-col bg-white', className)} aria-label="Documentation">
      <div className="border-b border-slate-200 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Contents
        </p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sections…"
            className="h-9 bg-slate-50 pl-8 text-sm"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <ul className="space-y-1 p-3">
          {filteredGroups.map(({ section, children }) => {
            const isSectionActive = activeId === section.id;
            const hasActiveChild = children.some((c) => c.id === activeId);
            const isActive = isSectionActive || hasActiveChild;
            const dot = section.category ? DOT_COLOR[section.category] : 'bg-slate-400';

            return (
              <li key={section.id}>
                <button
                  type="button"
                  onClick={() => onNavigate(section.id)}
                  className={cn(
                    'flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                    isActive
                      ? 'bg-blue-50 font-medium text-blue-900'
                      : 'text-slate-700 hover:bg-slate-100',
                  )}
                >
                  <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', dot)} />
                  <span className="flex-1 leading-snug">{section.title}</span>
                </button>

                {children.length > 0 && (
                  <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-slate-200 pl-2">
                    {children.map((sub) => (
                      <li key={sub.id}>
                        <button
                          type="button"
                          onClick={() => onNavigate(sub.id)}
                          className={cn(
                            'flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                            activeId === sub.id
                              ? 'bg-blue-50/90 font-medium text-blue-800'
                              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                          )}
                        >
                          <ChevronRight className="h-3 w-3 shrink-0 opacity-40" />
                          <span className="line-clamp-2 leading-snug">{sub.title}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </ScrollArea>
    </nav>
  );
};

export default DocsSidebar;
