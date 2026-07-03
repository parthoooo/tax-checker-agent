import GithubSlugger from 'github-slugger';

export interface DocHeading {
  level: 2 | 3;
  title: string;
  id: string;
  category?: 'start' | 'cat1' | 'cat2' | 'cat3' | 'profession' | 'workflows' | 'reference';
}

const CATEGORY_BY_TITLE: Record<string, DocHeading['category']> = {
  'Before you start': 'start',
  'Category 1 — Users & client management': 'cat1',
  'Category 2 — Documents & AI review': 'cat2',
  'Category 3 — Communications & operations': 'cat3',
  'Profession guides (three client types)': 'profession',
  'End-to-end workflows': 'workflows',
  'Quick reference': 'reference',
};

export function slugifyHeading(title: string): string {
  const slugger = new GithubSlugger();
  return slugger.slug(title);
}

export function parseDocHeadings(markdown: string): DocHeading[] {
  const slugger = new GithubSlugger();
  const headings: DocHeading[] = [];

  for (const line of markdown.split('\n')) {
    const h2 = line.match(/^## (.+)$/);
    const h3 = line.match(/^### (.+)$/);
    if (h2) {
      const title = h2[1].trim();
      if (title === 'Table of contents') continue;
      headings.push({
        level: 2,
        title,
        id: slugger.slug(title),
        category: CATEGORY_BY_TITLE[title],
      });
    } else if (h3) {
      const title = h3[1].trim();
      headings.push({ level: 3, title, id: slugger.slug(title) });
    }
  }

  return headings;
}

/** Remove duplicate TOC block and top H1 — sidebar replaces them. */
export function prepareGuideMarkdown(markdown: string): string {
  let body = markdown
    .replace(/^# .+\n\n/, '')
    .replace(/## Table of contents[\s\S]*?---\n\n/, '');

  const introEnd = body.indexOf('## Before you start');
  if (introEnd > 0) {
    const intro = body.slice(0, introEnd).trim();
    const rest = body.slice(introEnd);
    if (intro && !intro.startsWith('##')) {
      body = `> ${intro.replace(/\n/g, '\n> ')}\n\n${rest}`;
    }
  }

  return body.trim();
}

export const DOC_CATEGORY_META: Record<
  NonNullable<DocHeading['category']>,
  { label: string; color: string; border: string; bg: string }
> = {
  start: { label: 'Getting started', color: 'text-slate-700', border: 'border-slate-300', bg: 'bg-slate-50' },
  cat1: { label: 'Category 1', color: 'text-blue-800', border: 'border-blue-300', bg: 'bg-blue-50' },
  cat2: { label: 'Category 2', color: 'text-emerald-800', border: 'border-emerald-300', bg: 'bg-emerald-50' },
  cat3: { label: 'Category 3', color: 'text-violet-800', border: 'border-violet-300', bg: 'bg-violet-50' },
  profession: { label: 'Professions', color: 'text-amber-800', border: 'border-amber-300', bg: 'bg-amber-50' },
  workflows: { label: 'Workflows', color: 'text-indigo-800', border: 'border-indigo-300', bg: 'bg-indigo-50' },
  reference: { label: 'Reference', color: 'text-gray-700', border: 'border-gray-300', bg: 'bg-gray-50' },
};

export const QUICK_JUMP = [
  { title: 'Users & clients', id: 'category-1--users--client-management', category: 'cat1' as const },
  { title: 'Documents & AI', id: 'category-2--documents--ai-review', category: 'cat2' as const },
  { title: 'Communications', id: 'category-3--communications--operations', category: 'cat3' as const },
  { title: 'Profession types', id: 'profession-guides-three-client-types', category: 'profession' as const },
];
