import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

type LoginResponse = {
  accessToken: string;
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
