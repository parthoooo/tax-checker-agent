/** Matches Supabase Auth leaked/weak password checks for sign-up. */
const WEAK_SUBSTRINGS = [
  'password',
  '123456',
  'qwerty',
  'letmein',
  'welcome',
  'admin',
  'taxchecker',
];

export const SIGNUP_PASSWORD_HINT =
  'At least 12 characters with uppercase, lowercase, a number, and a symbol (e.g. MyTax-Firm-2026!)';

export type PasswordStrength = 'poor' | 'medium' | 'strong';

export interface PasswordCriterion {
  id: string;
  label: string;
  met: boolean;
}

export interface PasswordEvaluation {
  strength: PasswordStrength;
  acceptable: boolean;
  criteria: PasswordCriterion[];
  summary: string | null;
}

function buildCriteria(password: string): PasswordCriterion[] {
  const lower = password.toLowerCase();
  return [
    { id: 'length', label: 'At least 12 characters', met: password.length >= 12 },
    { id: 'lower', label: 'One lowercase letter', met: /[a-z]/.test(password) },
    { id: 'upper', label: 'One uppercase letter', met: /[A-Z]/.test(password) },
    { id: 'number', label: 'One number', met: /[0-9]/.test(password) },
    { id: 'symbol', label: 'One symbol (!, -, @, etc.)', met: /[^a-zA-Z0-9]/.test(password) },
    {
      id: 'unique',
      label: 'Not a common or guessable phrase',
      met: !WEAK_SUBSTRINGS.some((part) => lower.includes(part)),
    },
  ];
}

function scoreFromCriteria(criteria: PasswordCriterion[]): PasswordStrength {
  const met = criteria.filter(c => c.met).length;
  if (met <= 2) return 'poor';
  if (met <= 4) return 'medium';
  if (met === criteria.length) return 'strong';
  return 'medium';
}

export function evaluateSignupPassword(password: string): PasswordEvaluation {
  const criteria = buildCriteria(password);
  const strength = scoreFromCriteria(criteria);
  const unmet = criteria.filter(c => !c.met);
  const acceptable = unmet.length === 0;
  const summary = acceptable
    ? null
    : unmet.length === 1
      ? unmet[0].label
      : `Missing: ${unmet.map(c => c.label.toLowerCase()).join(', ')}.`;

  return { strength, acceptable, criteria, summary };
}

export function validateSignupPassword(password: string): string | null {
  if (password.length < 12) {
    return 'Password must be at least 12 characters.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must include a lowercase letter.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must include an uppercase letter.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must include a number.';
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    return 'Password must include a symbol (e.g. ! or -).';
  }
  const lower = password.toLowerCase();
  if (WEAK_SUBSTRINGS.some((part) => lower.includes(part))) {
    return 'That password is too common. Choose something unique.';
  }
  return null;
}

export function formatAuthPasswordError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('weak') || m.includes('easy to guess') || m.includes('known')) {
    return SIGNUP_PASSWORD_HINT;
  }
  return message;
}
