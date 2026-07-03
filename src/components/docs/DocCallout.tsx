import React from 'react';
import { Lightbulb, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type CalloutType = 'tip' | 'note' | 'warning' | 'success';

const CALLOUT_STYLES: Record<
  CalloutType,
  { icon: React.ElementType; border: string; bg: string; title: string; titleColor: string }
> = {
  tip: {
    icon: Lightbulb,
    border: 'border-amber-200',
    bg: 'bg-amber-50/90',
    title: 'Tip',
    titleColor: 'text-amber-900',
  },
  note: {
    icon: Info,
    border: 'border-blue-200',
    bg: 'bg-blue-50/90',
    title: 'Note',
    titleColor: 'text-blue-900',
  },
  warning: {
    icon: AlertTriangle,
    border: 'border-red-200',
    bg: 'bg-red-50/90',
    title: 'Important',
    titleColor: 'text-red-900',
  },
  success: {
    icon: CheckCircle2,
    border: 'border-emerald-200',
    bg: 'bg-emerald-50/90',
    title: 'After this step',
    titleColor: 'text-emerald-900',
  },
};

interface Props {
  type: CalloutType;
  children: React.ReactNode;
  title?: string;
}

const DocCallout: React.FC<Props> = ({ type, children, title }) => {
  const style = CALLOUT_STYLES[type];
  const Icon = style.icon;

  return (
    <div
      className={cn(
        'my-5 flex gap-3 rounded-xl border px-4 py-3.5 shadow-sm',
        style.border,
        style.bg,
      )}
    >
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', style.titleColor)} />
      <div className="min-w-0 text-sm leading-relaxed text-slate-800">
        <p className={cn('mb-1 font-semibold', style.titleColor)}>{title ?? style.title}</p>
        <div className="[&>p]:m-0 [&_strong]:font-semibold">{children}</div>
      </div>
    </div>
  );
};

export default DocCallout;
