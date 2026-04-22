import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { isAxiosError } from 'axios';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fetchSchoolInfo } from '@/modules/onboarding/onboarding.api';
import { useAuthStore } from '@/shared/store/auth.store';

import { getMyPermissions, login } from './auth.api';

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
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [schemaName, setSchemaName] = useState('school_sainte_marie');
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsPending(true);
    setAccessToken(null);
    setRefreshToken(null);
    setPermissions([]);

    try {
      const result = await login(identifier, password, schemaName || undefined);
      setAccessToken(result.accessToken);
      setRefreshToken(result.refreshToken ?? null);
      setUser({
        id: result.user.id,
        name: result.user.name,
        role: result.user.role,
        phone: result.user.phone,
        email: result.user.email,
        tenantId: schemaName || 'default-tenant',
        schemaName: schemaName || 'public',
        plan: 'standard',
      });
      const permissions = await getMyPermissions();
      setPermissions(permissions);

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
                <Label htmlFor="schemaName">Schéma tenant</Label>
                <Input
                  id="schemaName"
                  name="schemaName"
                  placeholder="school_sainte_marie"
                  value={schemaName}
                  onChange={(event) => setSchemaName(event.target.value)}
                  required
                />
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
