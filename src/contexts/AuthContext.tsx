import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type UserRole = 'client' | 'admin' | 'preparer';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  clientId?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  quickLogin: (role: 'admin' | 'preparer-shawn' | 'preparer-girik' | 'client') => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

const DEMO_CREDENTIALS = {
  admin:           { email: 'nick@brodermansoor.com',  password: 'password123' },
  'preparer-shawn': { email: 'shawn@brodermansoor.com', password: 'password123' },
  'preparer-girik': { email: 'girik@brodermansoor.com', password: 'password123' },
  client:          { email: 'john.smith@email.com',    password: 'password123' },
};

function supabaseUserToAppUser(su: SupabaseUser): User {
  const meta = su.user_metadata ?? {};
  const rawRole = meta.role ?? 'client';
  const role: UserRole =
    rawRole === 'admin' ? 'admin' :
    rawRole === 'preparer' ? 'preparer' :
    'client';
  return {
    id:       su.id,
    email:    su.email ?? '',
    name:     meta.full_name ?? meta.name ?? su.email ?? 'User',
    role,
    clientId: meta.client_id ?? undefined,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser]       = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSession(data.session);
        setUser(supabaseUserToAppUser(data.session.user));
      }
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession ? supabaseUserToAppUser(newSession.user) : null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setIsLoading(false);
    if (error) throw error;
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
    <AuthContext.Provider value={{ user, session, login, loginWithGoogle, quickLogin, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};
