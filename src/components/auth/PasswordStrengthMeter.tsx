import React from 'react';
import { cn } from '@/lib/utils';
import {
  evaluateSignupPassword,
  type PasswordStrength,
  type PasswordCriterion,
} from '@/lib/passwordPolicy';

interface Props {
  password: string;
  className?: string;
}

const STRENGTH_STYLE: Record<PasswordStrength, { bar: string; label: string; text: string }> = {
  poor:    { bar: 'bg-red-500',    label: 'Poor',    text: 'text-red-700' },
  medium:  { bar: 'bg-amber-500',  label: 'Medium',  text: 'text-amber-700' },
  strong:  { bar: 'bg-green-600',  label: 'Strong',  text: 'text-green-700' },
};

const PasswordStrengthMeter: React.FC<Props> = ({ password, className }) => {
  if (!password) return null;

  const evaluation = evaluateSignupPassword(password);
  const style = STRENGTH_STYLE[evaluation.strength];
  const width =
    evaluation.strength === 'poor' ? '33%'
    : evaluation.strength === 'medium' ? '66%'
    : '100%';

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Password strength</span>
        <span className={cn('font-semibold', style.text)}>{style.label}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
        <div className={cn('h-full transition-all duration-200', style.bar)} style={{ width }} />
      </div>
      <ul className="space-y-1">
        {evaluation.criteria.map((c: PasswordCriterion) => (
          <li
            key={c.id}
            className={cn(
              'text-xs flex items-center gap-1.5',
              c.met ? 'text-green-700' : 'text-muted-foreground',
            )}
          >
            <span aria-hidden>{c.met ? '✓' : '○'}</span>
            <span>{c.label}</span>
          </li>
        ))}
      </ul>
      {!evaluation.acceptable && evaluation.summary && (
        <p className="text-xs text-red-600">{evaluation.summary}</p>
      )}
    </div>
  );
};

export default PasswordStrengthMeter;
