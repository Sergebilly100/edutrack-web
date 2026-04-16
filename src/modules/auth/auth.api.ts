import { apiClient as api } from '@/shared/api/client';

type LoginResponse = {
  accessToken: string;
  refreshToken?: string;
  tokenType: 'Bearer';
  expiresIn: string;
  user: {
    id: string;
    role: 'director' | 'secretary' | 'teacher' | 'super_admin';
    name: string;
    phone: string | null;
    email: string | null;
    username?: string;
  };
};

export const login = async (
  identifier: string,
  password: string,
  schemaName?: string
): Promise<LoginResponse> => {
  const response = await api.post<LoginResponse>(
    '/auth/login/teacher',
    { identifier, password },
    schemaName
      ? {
          headers: {
            'x-tenant-schema': schemaName,
          },
        }
      : undefined
  );

  return response.data;
};

export const logout = async (): Promise<void> => {
  await api.post("/auth/logout");
};
