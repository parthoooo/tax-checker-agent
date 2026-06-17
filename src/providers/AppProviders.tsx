import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/contexts/AuthContext';

const queryClient = new QueryClient();

/** Root providers — mounted from main.tsx so auth wraps the full app tree. */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          {children}
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
