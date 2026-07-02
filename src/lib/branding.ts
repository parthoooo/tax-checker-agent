/** Hackathon demo branding — single source of truth for UI, emails, and demo auth. */

export const APP_NAME = 'Tax-Checker';
export const APP_TAGLINE = 'AI-Powered Tax Document Management';
export const FIRM_NAME = 'Tax-Checker';
export const FOOTER_TAGLINE = 'Tax-Checker · Hackathon Demo';

export const SUPPORT_EMAIL = 'support@tax-checker.demo';
export const NOTIFY_EMAIL = 'admin@tax-checker.demo';
export const FROM_EMAIL_LABEL = 'support@tax-checker.demo';

export const DEMO_PASSWORD = 'TaxChecker-Demo-2026!';

export const DEMO_STAFF = {
  admin: {
    email: 'admin@tax-checker.demo',
    fullName: 'Demo Admin',
    shortLabel: 'Admin',
  },
  preparer1: {
    email: 'preparer1@tax-checker.demo',
    fullName: 'Alex Chen',
    shortLabel: 'Preparer 1',
  },
  preparer2: {
    email: 'preparer2@tax-checker.demo',
    fullName: 'Jordan Lee',
    shortLabel: 'Preparer 2',
  },
} as const;

export const DEMO_CLIENTS = {
  primary: {
    email: 'client1@tax-checker.demo',
    fullName: 'John Smith',
    shortLabel: 'Client 1',
  },
  test2: {
    email: 'client2@tax-checker.demo',
    fullName: 'Test Client Two',
    shortLabel: 'Client 2',
  },
  test3: {
    email: 'client3@tax-checker.demo',
    fullName: 'Test Client Three',
    shortLabel: 'Client 3',
  },
} as const;

export const PREPARER_DISPLAY_NAMES = ['Alex Chen', 'Jordan Lee'] as const;

/** Portal base URL for magic links and settings (current origin in browser). */
export function getPortalOrigin(): string {
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin;
  }
  return import.meta.env.VITE_APP_URL ?? '';
}

export function magicUploadUrl(token: string): string {
  return `${getPortalOrigin()}/upload/${token}`;
}

export function emailSignature(): string {
  return `— ${FIRM_NAME}`;
}
