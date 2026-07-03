import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageShell from '@/components/layout/PageShell';
import DocsMarkdown from '@/components/docs/DocsMarkdown';
import DocsSidebar from '@/components/docs/DocsSidebar';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  ArrowLeft,
  BookOpen,
  Menu,
  Users,
  FileSearch,
  Mail,
  Briefcase,
  ExternalLink,
} from 'lucide-react';
import adminGuideRaw from '../../../docs/ADMIN_GUIDE.md?raw';
import {
  DOC_CATEGORY_META,
  parseDocHeadings,
  prepareGuideMarkdown,
} from '@/lib/adminGuideContent';
import { cn } from '@/lib/utils';

const QUICK_START_CARDS = [
  {
    id: 'category-1--users--client-management',
    title: 'Users & clients',
    description: 'Sign-ups, add clients, profession setup, prior years',
    icon: Users,
    category: 'cat1' as const,
  },
  {
    id: 'category-2--documents--ai-review',
    title: 'Documents & AI',
    description: 'Uploads, magic links, vault, Run AI Review, corrections',
    icon: FileSearch,
    category: 'cat2' as const,
  },
  {
    id: 'category-3--communications--operations',
    title: 'Communications',
    description: 'Dashboard, flags, outbox, reminders, activity log',
    icon: Mail,
    category: 'cat3' as const,
  },
  {
    id: 'profession-guides-three-client-types',
    title: 'Profession types',
    description: 'Employee, Freelancer, Partnership checklists & sample PDFs',
    icon: Briefcase,
    category: 'profession' as const,
  },
];

const AdminGuidePage: React.FC = () => {
  const [activeId, setActiveId] = useState('before-you-start');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const headings = useMemo(() => parseDocHeadings(adminGuideRaw), []);
  const markdown = useMemo(() => prepareGuideMarkdown(adminGuideRaw), []);

  const scrollToId = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveId(id);
      setMobileNavOpen(false);
    }
  }, []);

  useEffect(() => {
    const ids = headings.map((h) => h.id);
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el != null);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [headings]);

  const currentH3s = useMemo(() => {
    let sectionStart = headings.findIndex((h) => h.id === activeId);
    if (sectionStart === -1 || headings[sectionStart]?.level === 3) {
      sectionStart = headings.findIndex((h, i) => {
        if (h.level !== 2) return false;
        const nextH2 = headings.findIndex((x, j) => j > i && x.level === 2);
        const end = nextH2 === -1 ? headings.length : nextH2;
        return headings.slice(i, end).some((x) => x.id === activeId);
      });
    }
    if (sectionStart === -1) return [];
    const nextH2 = headings.findIndex((h, i) => i > sectionStart && h.level === 2);
    return headings
      .slice(sectionStart + 1, nextH2 === -1 ? undefined : nextH2)
      .filter((h) => h.level === 3);
  }, [headings, activeId]);

  const sidebarProps = {
    headings,
    activeId,
    onNavigate: scrollToId,
  };

  return (
    <PageShell>
      <div className="flex min-h-0 flex-1 flex-col bg-[#f6f8fa]">
        {/* Docs top bar */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="lg:hidden shrink-0">
                    <Menu className="h-4 w-4" />
                    <span className="sr-only">Open table of contents</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[min(100vw-2rem,320px)] p-0">
                  <SheetHeader className="border-b px-4 py-3 text-left">
                    <SheetTitle className="text-base">Admin Guide</SheetTitle>
                  </SheetHeader>
                  <DocsSidebar {...sidebarProps} className="h-[calc(100vh-4rem)]" />
                </SheetContent>
              </Sheet>

              <div className="flex min-w-0 items-center gap-2 text-sm text-slate-500">
                <BookOpen className="h-4 w-4 shrink-0 text-blue-600" />
                <span className="hidden sm:inline">Docs</span>
                <span className="text-slate-300">/</span>
                <span className="truncate font-medium text-slate-900">Admin Guide</span>
              </div>
            </div>

            <Button variant="outline" size="sm" asChild>
              <Link to="/dashboard">
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Dashboard
              </Link>
            </Button>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-[1440px] flex-1">
          {/* Left sidebar — desktop */}
          <aside className="hidden w-72 shrink-0 border-r border-slate-200 lg:sticky lg:top-[53px] lg:block lg:h-[calc(100vh-53px)] lg:self-start">
            <DocsSidebar {...sidebarProps} className="h-full" />
          </aside>

          {/* Main content */}
          <main className="min-w-0 flex-1">
            {/* Hero */}
            <div className="border-b border-slate-200 bg-white">
              <div className="mx-auto max-w-3xl px-6 py-10 sm:px-10 sm:py-12">
                <p className="mb-2 text-sm font-medium text-blue-600">Tax-Checker documentation</p>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                  Admin Guide
                </h1>
                <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600">
                  Follow these step-by-step instructions to onboard clients, collect tax documents,
                  run AI review, and manage your firm workflow. Tax year <strong>2025</strong> · YoY compare <strong>2024</strong>.
                </p>

                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {QUICK_START_CARDS.map((card) => {
                    const Icon = card.icon;
                    const meta = DOC_CATEGORY_META[card.category];
                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => scrollToId(card.id)}
                        className={cn(
                          'group flex items-start gap-3 rounded-xl border p-4 text-left transition-all hover:shadow-md',
                          meta.border,
                          'bg-white hover:bg-white',
                        )}
                      >
                        <div
                          className={cn(
                            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                            meta.bg,
                          )}
                        >
                          <Icon className={cn('h-5 w-5', meta.color)} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 group-hover:text-blue-700">
                            {card.title}
                          </p>
                          <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                            {card.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Article body */}
            <article className="mx-auto max-w-3xl px-6 py-10 sm:px-10 sm:py-12">
              <DocsMarkdown markdown={markdown} />
            </article>

            {/* Footer CTA */}
            <div className="border-t border-slate-200 bg-white">
              <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 px-6 py-8 sm:px-10">
                <div>
                  <p className="font-medium text-slate-900">Ready to try it?</p>
                  <p className="text-sm text-slate-600">Download sample PDFs and walk through a test client.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" asChild>
                    <Link to="/staff/sample-docs">
                      Sample PDFs
                      <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                  <Button asChild>
                    <Link to="/clients">Open Clients</Link>
                  </Button>
                </div>
              </div>
            </div>
          </main>

          {/* Right "On this page" — xl only */}
          <aside className="hidden w-56 shrink-0 xl:block">
            <div className="sticky top-[53px] p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                On this page
              </p>
              {currentH3s.length > 0 ? (
                <ul className="space-y-1 border-l border-slate-200 pl-3">
                  {currentH3s.map((h) => (
                    <li key={h.id}>
                      <button
                        type="button"
                        onClick={() => scrollToId(h.id)}
                        className={cn(
                          'block w-full py-1 text-left text-xs leading-snug transition-colors',
                          activeId === h.id
                            ? 'font-medium text-blue-700'
                            : 'text-slate-600 hover:text-slate-900',
                        )}
                      >
                        {h.title}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">Select a section to see subsections.</p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </PageShell>
  );
};

export default AdminGuidePage;
