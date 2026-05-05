import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { isAxiosError } from 'axios';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  if (labels.length < 3) {
    return undefined;
  }

  const subdomain = labels[0];
  if (!subdomain || subdomain === 'www' || subdomain === 'admin') {
    return undefined;
  }

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
        positionNames: Array.isArray(result.user.positionNames) ? result.user.positionNames : [],
        primaryPosition: result.user.primaryPosition ?? null,
        tenantId: schemaNameFromToken,
        schemaName: schemaNameFromToken,
        plan: 'standard',
      });
      await refreshPermissions();

      if (result.user.role === 'teacher') {
        navigate('/attendance');
      } else if (result.user.role === 'super_admin') {
        navigate('/admin');
      } else {
        if (result.user.role === 'director') {
          try {
            const target = await resolveDirectorPostLoginRoute();
            navigate(target);
          } catch {
            navigate('/onboarding');
          }
        } else {
          navigate('/dashboard');
        }
      }
    } catch (error) {
      if (isAxiosError(error)) {
        const backendMessage =
          (error.response?.data as { error?: string } | undefined)?.error ??
          error.message;
        setErrorMessage(backendMessage);
      } else {
        setErrorMessage(error instanceof Error ? error.message : 'Échec de connexion');
      }
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-semibold tracking-tight">Connexion</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="identifier">Identifiant</Label>
                <Input
                  id="identifier"
                  name="identifier"
                  placeholder="username, téléphone ou email"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Le tenant de votre école est détecté automatiquement via le sous-domaine.
                </p>
              </div>

              {errorMessage ? (
                <Alert variant="destructive">
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              ) : null}

              {searchParams.get('reason') === 'session_expired' ? (
                <Alert className="border-amber-300 text-amber-800 dark:border-amber-600 dark:text-amber-300">
                  <AlertDescription>Votre session a expiré. Veuillez vous reconnecter.</AlertDescription>
                </Alert>
              ) : null}

              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? 'Connexion...' : 'Se connecter'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
