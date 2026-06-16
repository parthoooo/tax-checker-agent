/** Matches Supabase Auth leaked/weak password checks for sign-up. */
const WEAK_SUBSTRINGS = [
  'password',
  '123456',
  'qwerty',
  'letmein',
  'welcome',
  'admin',
  'broder',
];

export const SIGNUP_PASSWORD_HINT =
  'At least 12 characters with uppercase, lowercase, a number, and a symbol (e.g. MyTax-Firm-2026!)';

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
