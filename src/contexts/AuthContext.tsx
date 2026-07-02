import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { fetchClientByAuthUser } from '@/lib/db';
import {
  fetchSignupRequestByAuthUser,
  upsertSignupRequest,
} from '@/lib/signupRequests';
import { DEMO_CLIENTS, DEMO_PASSWORD, DEMO_STAFF } from '@/lib/branding';

export type UserRole = 'client' | 'admin' | 'preparer';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  clientId?: string;
  approvalStatus?: ApprovalStatus;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  login: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  quickLogin: (role: 'admin' | 'preparer1' | 'preparer2' | 'client' | 'client2' | 'client3') => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

const DEMO_CREDENTIALS = {
  admin:      { email: DEMO_STAFF.admin.email,       password: DEMO_PASSWORD },
  preparer1:  { email: DEMO_STAFF.preparer1.email,   password: DEMO_PASSWORD },
  preparer2:  { email: DEMO_STAFF.preparer2.email,   password: DEMO_PASSWORD },
  client:     { email: DEMO_CLIENTS.primary.email,   password: DEMO_PASSWORD },
  client2:    { email: DEMO_CLIENTS.test2.email,     password: DEMO_PASSWORD },
  client3:    { email: DEMO_CLIENTS.test3.email,     password: DEMO_PASSWORD },
};

function authProviderLabel(su: SupabaseUser): string {
  const fromMeta = su.app_metadata?.provider;
  if (fromMeta && fromMeta !== 'email') return fromMeta;
  const identity = su.identities?.find((i) => i.provider !== 'email');
  return identity?.provider ?? 'email';
}

const DEMO_STAFF_BY_EMAIL: Record<string, UserRole> = {
  [DEMO_STAFF.admin.email]: 'admin',
  [DEMO_STAFF.preparer1.email]: 'preparer',
  [DEMO_STAFF.preparer2.email]: 'preparer',
};

function staffRoleFromAuth(su: SupabaseUser): UserRole | null {
  const appRole = su.app_metadata?.role as string | undefined;
  if (appRole === 'admin' || appRole === 'preparer') return appRole;

  // Legacy fallback when app_metadata backfill has not run on Lovable Cloud yet.
  const legacyRole = su.user_metadata?.role as string | undefined;
  if (legacyRole === 'admin' || legacyRole === 'preparer') return legacyRole;

  const email = su.email?.toLowerCase();
  if (email && DEMO_STAFF_BY_EMAIL[email]) return DEMO_STAFF_BY_EMAIL[email];

  return null;
}

async function resolveAppUser(su: SupabaseUser): Promise<User> {
  const meta = su.user_metadata ?? {};
  const name = meta.full_name ?? meta.name ?? su.email ?? 'User';
  const staffRole = staffRoleFromAuth(su);

  if (staffRole) {
    return {
      id: su.id,
      email: su.email ?? '',
      name,
      role: staffRole,
      approvalStatus: 'approved',
    };
  }

  const linkedClient = await fetchClientByAuthUser(su.id);
  if (linkedClient) {
    return {
      id: su.id,
      email: su.email ?? '',
      name: linkedClient.name || name,
      role: 'client',
      clientId: linkedClient.id,
      approvalStatus: 'approved',
    };
  }

  let signup = await fetchSignupRequestByAuthUser(su.id).catch(() => null);

  if (!signup && !staffRole) {
    try {
      signup = await upsertSignupRequest({
        auth_user_id: su.id,
        email: su.email ?? '',
        full_name: name,
        provider: authProviderLabel(su),
      });
    } catch {
      // Table may not exist until migration is applied
    }
  }

  if (signup?.status === 'rejected') {
    return {
      id: su.id,
      email: su.email ?? '',
      name,
      role: 'client',
      approvalStatus: 'rejected',
    };
  }

  if (signup?.status === 'approved') {
    const approvedRole = signup.approved_role ?? 'client';
    if (approvedRole === 'admin' || approvedRole === 'preparer') {
      return {
        id: su.id,
        email: su.email ?? '',
        name,
        role: approvedRole,
        approvalStatus: 'approved',
      };
    }

    const clientAfterApproval = await fetchClientByAuthUser(su.id);
    return {
      id: su.id,
      email: su.email ?? '',
      name,
      role: 'client',
      clientId: clientAfterApproval?.id,
      approvalStatus: clientAfterApproval ? 'approved' : 'pending',
    };
  }

  return {
    id: su.id,
    email: su.email ?? '',
    name,
    role: 'client',
    approvalStatus: 'pending',
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applySession = useCallback(async (newSession: Session | null) => {
    if (!newSession) {
      setSession(null);
      setUser(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      let sessionToUse = newSession;
      const email = newSession.user.email?.toLowerCase() ?? '';
      const demoStaffRole = email ? DEMO_STAFF_BY_EMAIL[email] : undefined;
      const appRole = newSession.user.app_metadata?.role as string | undefined;

      if (demoStaffRole && appRole !== demoStaffRole) {
        try {
          await supabase.functions.invoke('ensure-demo-staff-role');
          const { data: refreshed } = await supabase.auth.refreshSession();
          if (refreshed.session) sessionToUse = refreshed.session;
        } catch {
          // Edge function may not be deployed yet; RLS demo fallback migration covers reads.
        }
      }

      setSession(sessionToUse);
      const resolved = await resolveAppUser(sessionToUse.user);
      setUser(resolved);
    } catch {
      setSession(newSession);
      setUser({
        id: newSession.user.id,
        email: newSession.user.email ?? '',
        name: newSession.user.user_metadata?.full_name ?? 'User',
        role: 'client',
        approvalStatus: 'pending',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      applySession(data.session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      applySession(newSession);
    });

    return () => subscription.unsubscribe();
  }, [applySession]);

  const refreshUser = async () => {
    const { data } = await supabase.auth.refreshSession();
    await applySession(data.session);
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setIsLoading(false);
      throw error;
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    setIsLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, approval_status: 'pending' },
      },
    });
    if (error) {
      setIsLoading(false);
      throw error;
    }
    // signup_requests row is created on first session via resolveAppUser
  };

  const loginWithGoogle = async () => {
    const { lovable } = await import('@/integrations/lovable');
    const result = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: window.location.origin,
    });
    if (result.error) throw result.error;
  };

  const quickLogin = async (role: keyof typeof DEMO_CREDENTIALS) => {
    const creds = DEMO_CREDENTIALS[role];
    await login(creds.email, creds.password);
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      user, session, login, signUp, loginWithGoogle, quickLogin, logout, refreshUser, isLoading,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
