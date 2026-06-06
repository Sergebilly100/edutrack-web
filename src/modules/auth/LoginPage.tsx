import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { Eye, EyeOff, GraduationCap, LogIn } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fetchSchoolInfo } from '@/modules/onboarding/onboarding.api';
import { usePermissions } from '@/shared/hooks/usePermissions';
import { clearDashboardDismissedNotifications } from '@/shared/lib/dashboard-notifications';
import { useAuthStore } from '@/shared/store/auth.store';

import { login } from './auth.api';

const SUBDOMAIN_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const resolveTenantSubdomainFromHost = (): string | undefined => {
  const hostname = window.location.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return undefined;
  }
  const labels = hostname.split('.').filter(Boolean);
  if (labels.length < 3) return undefined;
  const subdomain = labels[0];
  if (!subdomain || subdomain === 'www' || subdomain === 'admin') return undefined;
  return SUBDOMAIN_REGEX.test(subdomain) ? subdomain : undefined;
};

const resolveDirectorPostLoginRoute = async (): Promise<'/dashboard' | '/onboarding'> => {
  const school = await fetchSchoolInfo();
  return school.onboarding_completed === true ? '/dashboard' : '/onboarding';
};

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setUser = useAuthStore((state) => state.setUser);
  const setAccessToken = useAuthStore((state) => state.setAccessToken);
  const setRefreshToken = useAuthStore((state) => state.setRefreshToken);
  const setPermissions = useAuthStore((state) => state.setPermissions);
  const { refreshPermissions } = usePermissions();
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
    setPermissions([]);
    clearDashboardDismissedNotifications();

    try {
      const tenantSubdomain = resolveTenantSubdomainFromHost();
      const result = await login(identifier, password, tenantSubdomain);
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
        positionNames: Array.isArray(result.user.positionNames) ? result.user.positionNames : [],
        primaryPosition: result.user.primaryPosition ?? null,
        tenantId: schemaNameFromToken,
        schemaName: schemaNameFromToken,
        plan: 'standard',
      });

      if (result.user.mustChangePassword) {
        navigate('/account/first-login-password', { replace: true });
        return;
      }

      await refreshPermissions();

      if (result.user.role === 'teacher') {
        navigate('/attendance');
      } else if (result.user.role === 'super_admin') {
        navigate('/admin');
      } else if (result.user.role === 'director') {
        try {
          const target = await resolveDirectorPostLoginRoute();
          navigate(target);
        } catch {
          navigate('/onboarding');
        }
      } else {
        navigate('/dashboard');
      }
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
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 dark:from-[#0a0f1e] dark:via-[#0c1220] dark:to-[#0a0f1e]">
      {/* Blobs décoratifs — s'adaptent au thème */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-blue-400/20 blur-[100px] dark:bg-[#1a56db]/8" />

        {/* Grille subtile */}
        <div
          className="absolute inset-0 opacity-[0.025] dark:opacity-[0.02]"
          style={{
            backgroundImage:
              'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-[420px]">
          {/* Logo + marque */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1a56db] shadow-[0_0_40px_rgba(26,86,219,0.3)] dark:shadow-[0_0_40px_rgba(26,86,219,0.4)]">
              <GraduationCap className="h-8 w-8 text-white" strokeWidth={1.5} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              IvoirEdu
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-white/50">
              Plateforme de gestion scolaire
            </p>
          </div>

          {/* Carte */}
          <div className="rounded-2xl border border-gray-200/80 bg-white/80 p-7 shadow-xl shadow-gray-200/60 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.05] dark:shadow-[0_24px_64px_rgba(0,0,0,0.4)]">
            <div className="mb-6">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Connexion</h2>
              <p className="mt-0.5 text-xs text-gray-400 dark:text-white/40">
                Accès réservé au personnel de l'établissement
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="identifier"
                  className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-white/60"
                >
                  Identifiant
                </Label>
                <Input
                  id="identifier"
                  name="identifier"
                  placeholder="username, téléphone ou email"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  required
                  className="h-11 border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus-visible:border-blue-500 focus-visible:ring-blue-500/20 dark:border-white/10 dark:bg-white/[0.07] dark:text-white dark:placeholder:text-white/25 dark:focus-visible:border-blue-500/70 dark:focus-visible:ring-blue-500/20"
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="password"
                  className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-white/60"
                >
                  Mot de passe
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    className="h-11 border-gray-200 bg-white pr-11 text-gray-900 placeholder:text-gray-400 focus-visible:border-blue-500 focus-visible:ring-blue-500/20 dark:border-white/10 dark:bg-white/[0.07] dark:text-white dark:placeholder:text-white/25 dark:focus-visible:border-blue-500/70 dark:focus-visible:ring-blue-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-gray-400 transition-colors hover:text-gray-600 dark:text-white/30 dark:hover:text-white/60"
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-gray-400 dark:text-white/25">
                L'école est détectée automatiquement via le sous-domaine.
              </p>

              {errorMessage ? (
                <Alert variant="destructive">
                  <AlertDescription className="text-sm">{errorMessage}</AlertDescription>
                </Alert>
              ) : null}

              {searchParams.get('reason') === 'session_expired' ? (
                <Alert className="border-amber-300 text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300">
                  <AlertDescription className="text-sm">
                    Votre session a expiré. Veuillez vous reconnecter.
                  </AlertDescription>
                </Alert>
              ) : null}

              <Button
                type="submit"
                disabled={isPending}
                className="mt-2 h-11 w-full bg-gradient-to-r from-blue-600 to-blue-500 font-semibold text-white shadow-md shadow-blue-500/25 transition-all hover:from-blue-700 hover:to-blue-600 hover:shadow-blue-500/40 active:scale-[0.99] disabled:opacity-60 dark:from-[#1a56db] dark:to-[#1e68f0] dark:shadow-[0_4px_24px_rgba(26,86,219,0.4)] dark:hover:shadow-[0_4px_32px_rgba(26,86,219,0.55)]"
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

          <p className="mt-6 text-center text-[11px] text-gray-400 dark:text-white/20">
            © {new Date().getFullYear()} IvoirEdu · Tous droits réservés
          </p>
        </div>
      </div>
    </div>
  );
}
