import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { Eye, EyeOff, LogIn, Shield } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/shared/store/auth.store';

import { loginAdmin } from './auth.api';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const setUser = useAuthStore((state) => state.setUser);
  const setAccessToken = useAuthStore((state) => state.setAccessToken);
  const setRefreshToken = useAuthStore((state) => state.setRefreshToken);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsPending(true);
    setAccessToken(null);
    setRefreshToken(null);

    try {
      const result = await loginAdmin(identifier, password);

      const schemaNameFromToken = (() => {
        try {
          const tokenPart = result.accessToken.split('.')[1] ?? '';
          const normalized = tokenPart.replace(/-/g, '+').replace(/_/g, '/');
          const payload = JSON.parse(atob(normalized)) as { schemaName?: string };
          return payload.schemaName ?? 'unknown';
        } catch {
          return 'unknown';
        }
      })();

      setAccessToken(result.accessToken);
      setRefreshToken(result.refreshToken ?? null);
      setUser({
        id: result.user.id,
        name: result.user.name,
        role: result.user.role,
        phone: result.user.phone,
        email: result.user.email,
        profilePhotoUrl: result.user.profilePhotoUrl,
        mustChangePassword: Boolean(result.user.mustChangePassword),
        positionNames: [],
        primaryPosition: null,
        tenantId: schemaNameFromToken,
        schemaName: schemaNameFromToken,
        plan: 'standard',
      });

      navigate('/admin', { replace: true });
    } catch (error) {
      if (isAxiosError(error)) {
        const backendMessage =
          (error.response?.data as { error?: string } | undefined)?.error ?? error.message;
        setErrorMessage(backendMessage);
      } else {
        setErrorMessage(error instanceof Error ? error.message : 'Échec de connexion');
      }
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute -bottom-24 right-0 h-[400px] w-[600px] rounded-full bg-indigo-600/10 blur-[140px]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 shadow-[0_0_40px_rgba(99,102,241,0.4)]">
              <Shield className="h-8 w-8 text-white" strokeWidth={1.5} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">IvoirEdu</h1>
            <p className="mt-1 text-sm text-white/40">Administration centrale</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-7 shadow-[0_24px_64px_rgba(0,0,0,0.5)] backdrop-blur-xl">
            <div className="mb-6">
              <h2 className="text-base font-semibold text-white">Connexion administrateur</h2>
              <p className="mt-0.5 text-xs text-white/40">Accès réservé au super administrateur</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="identifier"
                  className="text-xs font-medium uppercase tracking-wider text-white/50"
                >
                  Identifiant
                </Label>
                <Input
                  id="identifier"
                  name="identifier"
                  placeholder="email ou téléphone"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  className="h-11 border-white/10 bg-white/[0.07] text-white placeholder:text-white/25 focus-visible:border-indigo-500/70 focus-visible:ring-indigo-500/20"
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="password"
                  className="text-xs font-medium uppercase tracking-wider text-white/50"
                >
                  Mot de passe
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11 border-white/10 bg-white/[0.07] pr-11 text-white placeholder:text-white/25 focus-visible:border-indigo-500/70 focus-visible:ring-indigo-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-white/30 transition-colors hover:text-white/60"
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {errorMessage ? (
                <Alert variant="destructive">
                  <AlertDescription className="text-sm">{errorMessage}</AlertDescription>
                </Alert>
              ) : null}

              <Button
                type="submit"
                disabled={isPending}
                className="mt-2 h-11 w-full bg-indigo-600 font-semibold text-white shadow-md shadow-indigo-900/40 transition-all hover:bg-indigo-500 active:scale-[0.99] disabled:opacity-60"
              >
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Connexion…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <LogIn className="h-4 w-4" />
                    Se connecter
                  </span>
                )}
              </Button>
            </form>
          </div>

          <p className="mt-6 text-center text-[11px] text-white/20">
            © {new Date().getFullYear()} IvoirEdu · Administration
          </p>
        </div>
      </div>
    </div>
  );
}
