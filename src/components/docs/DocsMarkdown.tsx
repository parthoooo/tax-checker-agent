import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import GithubSlugger from 'github-slugger';
import DocCallout from '@/components/docs/DocCallout';
import { Badge } from '@/components/ui/badge';
import { DOC_CATEGORY_META, type DocHeading } from '@/lib/adminGuideContent';
import { cn } from '@/lib/utils';
import { ExternalLink, ArrowRight } from 'lucide-react';

function textContent(node: React.ReactNode): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(textContent).join('');
  if (React.isValidElement(node)) return textContent(node.props.children);
  return '';
}

function calloutFromParagraph(children: React.ReactNode): React.ReactNode | null {
  const raw = textContent(children).trim();
  const patterns: { prefix: RegExp; type: 'tip' | 'note' | 'warning' | 'success' }[] = [
    { prefix: /^Tip:/i, type: 'tip' },
    { prefix: /^Note:/i, type: 'note' },
    { prefix: /^Important:/i, type: 'warning' },
    { prefix: /^After approval:/i, type: 'success' },
    { prefix: /^What happens:/i, type: 'note' },
  ];

  for (const { prefix, type } of patterns) {
    if (prefix.test(raw)) {
      const body = raw.replace(prefix, '').trim();
      return (
        <DocCallout type={type}>
          <p>{body || children}</p>
        </DocCallout>
      );
    }
  }
  return null;
}

function categoryForH2(title: string): DocHeading['category'] | undefined {
  if (title.startsWith('Category 1')) return 'cat1';
  if (title.startsWith('Category 2')) return 'cat2';
  if (title.startsWith('Category 3')) return 'cat3';
  if (title === 'Before you start') return 'start';
  if (title.startsWith('Profession guides')) return 'profession';
  if (title.startsWith('End-to-end')) return 'workflows';
  if (title === 'Quick reference') return 'reference';
  return undefined;
}

interface Props {
  markdown: string;
  onHeadingVisible?: (id: string) => void;
}

const DocsMarkdown: React.FC<Props> = ({ markdown }) => {
  const slugger = useMemo(() => new GithubSlugger(), []);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSlug]}
      components={{
        h2: ({ children, id }) => {
          const title = textContent(children);
          const cat = categoryForH2(title);
          const meta = cat ? DOC_CATEGORY_META[cat] : null;
          slugger.reset();
          slugger.slug(title);

          return (
            <section className="scroll-mt-28 mt-14 first:mt-0">
              {meta && (
                <Badge
                  variant="outline"
                  className={cn('mb-3 font-medium', meta.color, meta.border, meta.bg)}
                >
                  {meta.label}
                </Badge>
              )}
              <h2
                id={id}
                className="group flex items-center gap-2 border-b border-slate-200 pb-3 text-2xl font-bold tracking-tight text-slate-900"
              >
                {children}
                {id && (
                  <a
                    href={`#${id}`}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-600 text-lg no-underline"
                    aria-label={`Link to ${title}`}
                  >
                    #
                  </a>
                )}
              </h2>
            </section>
          );
        },
        h3: ({ children, id }) => (
          <h3
            id={id}
            className="group scroll-mt-28 mt-10 mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-bold text-slate-600">
              §
            </span>
            <span className="flex-1">{children}</span>
            {id && (
              <a
                href={`#${id}`}
                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-600 text-sm no-underline"
              >
                #
              </a>
            )}
          </h3>
        ),
        h4: ({ children }) => (
          <h4 className="mt-6 mb-2 text-base font-semibold text-slate-800">{children}</h4>
        ),
        p: ({ children }) => {
          const raw = textContent(children).trim();
          if (raw === 'Steps:' || raw.replace(/\*/g, '') === 'Steps:') {
            return (
              <div className="mb-3 mt-8 flex items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-widest text-[#0969da]">
                  Step by step
                </span>
                <span className="h-px flex-1 bg-gradient-to-r from-blue-200 to-transparent" />
              </div>
            );
          }
          const callout = calloutFromParagraph(children);
          if (callout) return callout;
          return <p className="my-4 text-[15px] leading-7 text-slate-700">{children}</p>;
        },
        strong: ({ children }) => (
          <strong className="font-semibold text-slate-900">{children}</strong>
        ),
        ul: ({ children }) => (
          <ul className="my-4 ml-1 list-none space-y-2 pl-0">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="my-6 list-none space-y-3 pl-0">{children}</ol>
        ),
        li: ({ children, ordered, index }) => {
          if (ordered) {
            const step = (index ?? 0) + 1;
            return (
              <li className="flex gap-4 rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0969da] text-sm font-bold text-white shadow-sm">
                  {step}
                </span>
                <div className="min-w-0 flex-1 pt-0.5 text-[15px] leading-7 text-slate-700 [&>p]:my-0">
                  {children}
                </div>
              </li>
            );
          }
          return (
            <li className="flex gap-2.5 text-[15px] leading-7 text-slate-700">
              <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
              <span className="flex-1">{children}</span>
            </li>
          );
        },
        blockquote: ({ children }) => (
          <blockquote className="my-6 rounded-r-xl border-l-4 border-blue-400 bg-blue-50/60 px-5 py-4 text-[15px] leading-7 text-slate-700 [&>p]:my-0">
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div className="my-6 overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
            <table className="w-full min-w-[480px] border-collapse text-sm">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
            {children}
          </thead>
        ),
        th: ({ children }) => (
          <th className="border-b border-slate-200 px-4 py-3 font-semibold">{children}</th>
        ),
        td: ({ children }) => (
          <td className="border-b border-slate-100 px-4 py-3 text-slate-700">{children}</td>
        ),
        tr: ({ children }) => (
          <tr className="even:bg-slate-50/50 hover:bg-blue-50/30 transition-colors">{children}</tr>
        ),
        code: ({ className, children, ...props }) => {
          const isBlock = className?.includes('language-');
          if (isBlock) {
            return (
              <code
                className={cn(
                  'block overflow-x-auto rounded-xl bg-slate-900 px-4 py-3 text-[13px] leading-6 text-slate-100',
                  className,
                )}
                {...props}
              >
                {children}
              </code>
            );
          }
          return (
            <code
              className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[13px] text-blue-800"
              {...props}
            >
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="my-5 overflow-hidden rounded-xl shadow-md">{children}</pre>
        ),
        a: ({ href, children }) => {
          if (href?.startsWith('/')) {
            return (
              <Link
                to={href}
                className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 font-medium text-blue-700 hover:bg-blue-100 hover:underline"
              >
                {children}
                <ArrowRight className="h-3 w-3" />
              </Link>
            );
          }
          if (href?.startsWith('#')) {
            return (
              <a href={href} className="font-medium text-blue-600 hover:underline">
                {children}
              </a>
            );
          }
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline"
            >
              {children}
              <ExternalLink className="h-3 w-3" />
            </a>
          );
        },
        hr: () => <hr className="my-10 border-slate-200" />,
      }}
    >
      {markdown}
    </ReactMarkdown>
  );
};

export default DocsMarkdown;
