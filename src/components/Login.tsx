import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { formatAuthPasswordError, evaluateSignupPassword, validateSignupPassword } from '@/lib/passwordPolicy';
import PasswordStrengthMeter from '@/components/auth/PasswordStrengthMeter';

type AuthMode = 'signin' | 'signup';

const Login: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, signUp, loginWithGoogle, quickLogin } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (mode === 'signup') {
        const evaluation = evaluateSignupPassword(password);
        if (!evaluation.acceptable) {
          toast.error('Choose a stronger password', {
            description: evaluation.summary ?? validateSignupPassword(password) ?? 'Password does not meet requirements.',
          });
          setIsLoading(false);
          return;
        }
        if (!fullName.trim()) {
          toast.error('Full name is required');
          setIsLoading(false);
          return;
        }
        await signUp(email, password, fullName.trim());
        toast.success('Account created!', {
          description: 'Your request was sent for admin approval. You can check status after signing in.',
        });
      } else {
        await login(email, password);
        toast.success('Welcome back!');
      }
    } catch (error: any) {
      const raw = error?.message ?? 'Please try again.';
      const description = formatAuthPasswordError(raw);
      toast.error(mode === 'signup' ? 'Sign up failed' : 'Login failed', {
        description,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogle = async () => {
    try {
      await loginWithGoogle();
    } catch (error: any) {
      toast.error('Google sign-in failed', { description: error?.message });
    }
  };

  const handleQuickLogin = async (role: Parameters<typeof quickLogin>[0]) => {
    setIsLoading(true);
    try {
      await quickLogin(role);
      toast.success('Signed in as demo user');
    } catch (error: any) {
      toast.error('Demo login failed', { description: error?.message ?? 'Demo account unavailable.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-blue-900">Broder Mansoor Muqtadir, Inc. AI</CardTitle>
          <p className="text-muted-foreground text-sm">AI-Powered Tax Document Management</p>
        </CardHeader>
        <CardContent>
          <div className="flex rounded-lg border mb-4 p-1">
            <button
              type="button"
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'signin' ? 'bg-blue-900 text-white' : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setMode('signin')}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'signup' ? 'bg-blue-900 text-white' : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setMode('signup')}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <Input
                type="text"
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            )}
            <Input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <div className="space-y-1">
              <Input
                type="password"
                placeholder={mode === 'signup' ? 'Create a strong password' : 'Password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === 'signup' ? 12 : 6}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
              {mode === 'signup' && (
                <PasswordStrengthMeter password={password} />
              )}
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || (mode === 'signup' && password.length > 0 && !evaluateSignupPassword(password).acceptable)}
            >
              {isLoading ? 'Please wait…' : mode === 'signup' ? 'Create Account' : 'Sign In'}
            </Button>
          </form>

          <Button
            type="button"
            variant="outline"
            className="w-full mt-3 flex items-center gap-2"
            onClick={handleGoogle}
            disabled={isLoading}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </Button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Quick Demo Access</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" className="h-12 border-2 border-blue-700 text-blue-800 hover:bg-blue-50 font-semibold text-xs" onClick={() => handleQuickLogin('admin')} disabled={isLoading}>
              Nick (Admin)
            </Button>
            <Button type="button" variant="outline" className="h-12 border-2 border-indigo-600 text-indigo-700 hover:bg-indigo-50 font-semibold text-xs" onClick={() => handleQuickLogin('preparer-shawn')} disabled={isLoading}>
              Sean (Preparer)
            </Button>
            <Button type="button" variant="outline" className="h-12 border-2 border-indigo-600 text-indigo-700 hover:bg-indigo-50 font-semibold text-xs" onClick={() => handleQuickLogin('preparer-girik')} disabled={isLoading}>
              Girik (Preparer)
            </Button>
            <Button type="button" variant="outline" className="h-12 border-2 border-green-600 text-green-700 hover:bg-green-50 font-semibold text-xs" onClick={() => handleQuickLogin('client')} disabled={isLoading}>
              John (Client)
            </Button>
            <Button type="button" variant="outline" className="h-12 border-2 border-green-600 text-green-700 hover:bg-green-50 font-semibold text-xs" onClick={() => handleQuickLogin('client-sean')} disabled={isLoading}>
              Sean (Test Client)
            </Button>
            <Button type="button" variant="outline" className="h-12 border-2 border-green-600 text-green-700 hover:bg-green-50 font-semibold text-xs" onClick={() => handleQuickLogin('client-girik')} disabled={isLoading}>
              Girik (Test Client)
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground mt-6">Powered by SJ Innovation AI</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
