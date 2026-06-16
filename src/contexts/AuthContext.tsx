import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { fetchClientByAuthUser } from '@/lib/db';
import {
  fetchSignupRequestByAuthUser,
  upsertSignupRequest,
} from '@/lib/signupRequests';

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
  quickLogin: (role: 'admin' | 'preparer-shawn' | 'preparer-girik' | 'client' | 'client-sean' | 'client-girik') => Promise<void>;
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

const DEMO_PASSWORD = 'BMM-Demo-2026!';

const DEMO_CREDENTIALS = {
  admin:            { email: 'nick@brodermansoor.com',       password: DEMO_PASSWORD },
  'preparer-shawn': { email: 'shawn@brodermansoor.com',      password: DEMO_PASSWORD },
  'preparer-girik': { email: 'girik@brodermansoor.com',      password: DEMO_PASSWORD },
  client:           { email: 'john.smith@email.com',         password: DEMO_PASSWORD },
  'client-sean':    { email: 'sean.test@brodermansoor.com',  password: DEMO_PASSWORD },
  'client-girik':   { email: 'girik.test@brodermansoor.com', password: DEMO_PASSWORD },
};

function authProviderLabel(su: SupabaseUser): string {
  const fromMeta = su.app_metadata?.provider;
  if (fromMeta && fromMeta !== 'email') return fromMeta;
  const identity = su.identities?.find((i) => i.provider !== 'email');
  return identity?.provider ?? 'email';
}

async function resolveAppUser(su: SupabaseUser): Promise<User> {
  const meta = su.user_metadata ?? {};
  const name = meta.full_name ?? meta.name ?? su.email ?? 'User';
  const rawRole = meta.role as string | undefined;

  if (rawRole === 'admin' || rawRole === 'preparer') {
    return {
      id: su.id,
      email: su.email ?? '',
      name,
      role: rawRole,
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

  if (!signup && rawRole !== 'admin' && rawRole !== 'preparer') {
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
    setSession(newSession);
    if (!newSession) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const resolved = await resolveAppUser(newSession.user);
      setUser(resolved);
    } catch {
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
        data: { full_name: fullName, role: 'client', approval_status: 'pending' },
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
