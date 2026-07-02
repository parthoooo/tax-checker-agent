import React from 'react';
import { FOOTER_TAGLINE } from '@/lib/branding';

const PageShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen flex flex-col bg-gray-50">
    <div className="flex-1">{children}</div>
    <footer className="py-4 text-center text-xs text-gray-400">{FOOTER_TAGLINE}</footer>
  </div>
);

export default PageShell;
