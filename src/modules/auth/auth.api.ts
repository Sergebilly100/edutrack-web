import { apiClient as api } from '@/shared/api/client';
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
  password: string,
  tenantSubdomain?: string
): Promise<LoginResponse> => {
  const hostname = typeof window !== "undefined" ? window.location.hostname : ""
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1"
  const fallbackSchema =
    import.meta.env.VITE_DEFAULT_TENANT_SCHEMA ??
    import.meta.env.VITE_E2E_SCHEMA_NAME ??
    "school_sainte_marie"

  const response = await api.post<LoginResponse>(
    '/auth/login/teacher',
    { identifier, password },
    {
      headers: tenantSubdomain
        ? { "x-tenant-subdomain": tenantSubdomain }
        : isLocalhost
          ? { "x-tenant-schema": fallbackSchema }
          : undefined,
    }
  );

  return response.data;
};

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
