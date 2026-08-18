import { apiClient as api } from '@/shared/api/client';
import { buildTenantContextHeaders } from '@/shared/tenancy/tenant-host';
import type { PermissionKey } from '@/shared/store/auth.store';

type LoginResponse = {
  accessToken: string;
  refreshToken?: string;
  tokenType: 'Bearer';
  expiresIn: string;
  user: {
    id: string;
    role: 'director' | 'staff' | 'teacher' | 'super_admin';
    name: string;
    phone: string | null;
    email: string | null;
    profilePhotoUrl: string | null;
    mustChangePassword?: boolean;
    positionNames?: string[];
    primaryPosition?: string | null;
    username?: string;
  };
};

export const login = async (
  identifier: string,
  password: string
): Promise<LoginResponse> => {
  const response = await api.post<LoginResponse>(
    '/auth/login/teacher',
    { identifier, password },
    {
      headers: buildTenantContextHeaders(),
    }
  );

  return response.data;
};

// Cette fonction est séparée de login car elle utilise une route différente et n'a pas besoin du header x-tenant-subdomain ou x-tenant-schema,
//  car les admins ne sont pas rattachés à une école spécifique et sont gérés dans une table séparée dans la base de données
export const loginAdmin = async (
  identifier: string,
  password: string,
): Promise<LoginResponse> => {
  const response = await api.post<LoginResponse>('/auth/login/admin', { identifier, password });
  return response.data;
};

// La route de logout est la même pour les enseignants et les admins, car elle se contente de supprimer le token côté serveur et de faire du cleanup côté client
// la redirection après logout est gérée côté client dans le store auth.store.ts, et elle redirige vers la page de login classique pour les enseignants et les admins
export const logout = async (): Promise<void> => {
  await api.post("/auth/logout");
};

type PermissionsMeResponse = {
  permissions: string[]
}

type UpdateMyProfilePayload = {
  name?: string
  phone?: string | null
  profilePhotoUrl?: string | null
}

const PERMISSION_KEYS: PermissionKey[] = [
  'teachers.view',
  'teachers.create',
  'teachers.edit',
  'teachers.block',
  'teachers.documents',
  'teachers.ranking.view',
  'teachers.attendance.view',
  'teachers.password.reset',
  'students.view',
  'students.create',
  'students.edit',
  'students.documents',
  'students.excuse',
  'schedule.view',
  'schedule.edit',
  'attendance.view',
  'attendance.mark_students',
  'salary.view',
  'salary.compute',
  'salary.mark_paid',
  'salary.export',
  'validations.view',
  'validations.approve',
  'validations.reject',
  'rooms.view',
  'rooms.create',
  'rooms.edit',
  'rooms.delete',
  'school_years.view',
  'school_years.create',
  'school_years.edit',
  'classes.view',
  'classes.create',
  'classes.edit',
  'classes.delete',
  'import.students',
  'import.teachers',
  'import.schedule',
  'settings.positions',
  'settings.school',
  'settings.sms_templates',
  'subscriptions.view',
  'subscriptions.create',
  'subscriptions.edit',
  'subscriptions.renew',
  'subscriptions.cancel',
  'subscriptions.password.reset',
  'subscriptions.revenue',
];

export const getMyPermissions = async (): Promise<PermissionKey[]> => {
  const response = await api.get<PermissionsMeResponse>("/permissions/me")
  const keys = new Set<PermissionKey>(PERMISSION_KEYS)
  const rawPermissions = Array.isArray(response.data?.permissions) ? response.data.permissions : []
  return rawPermissions.filter((value): value is PermissionKey => keys.has(value as PermissionKey))
};

export const updateMyProfile = async (payload: UpdateMyProfilePayload) => {
  const response = await api.patch<{ user: LoginResponse["user"] }>("/auth/me", payload)
  return response.data.user
}
