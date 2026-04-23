import { apiClient } from "@/shared/api/client"

export type TeachingType = "general" | "technical" | "mixed" | "primaire" | "secondaire" | "superieur" | "mixte"
export type SchoolPlan = "essential" | "pro" | "establishment"

export type PositionPermission = string

export type PositionItem = {
  id: string
  name: string
  permissions: PositionPermission[]
  assignmentsCount: number
}

export type AssignableUser = {
  id: string
  name: string
  role: string
  email: string | null
  phone: string | null
  assignedPositions: Array<{
    id: string
    name: string
  }>
  positions: string[]
  permissions: string[]
}

export type SchoolConfigData = {
  school: {
    name: string
    subdomain: string
    plan: SchoolPlan
    city: string
    teachingType: TeachingType
    maxUsers: number
    currentUsers: number
    totalUsers: number
    adminUsersCount: number
    logoUrl: string | null
    activeSchoolYear: string | null
    canEditSmsTemplate: boolean
    allowTeacherQrSkip: boolean
  }
  limits: {
    maxAdminPositions: number
  }
  positions: PositionItem[]
  users: AssignableUser[]
}

export type ChangePasswordInput = {
  currentPassword: string
  newPassword: string
}

export type CreateAdministrativeUserInput = {
  name: string
  email?: string
  phone?: string
  password: string
}

export type UpdateAdministrativeUserInput = {
  id: string
  name?: string
  email?: string | null
  phone?: string | null
}

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null

const asString = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback

const asNullableString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []

const asAssignedPositions = (value: unknown): Array<{ id: string; name: string }> => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => {
      if (!isRecord(item)) {
        return null
      }
      const id = asString(item.id)
      const name = asString(item.name)
      if (!id || !name) {
        return null
      }
      return { id, name }
    })
    .filter((item): item is { id: string; name: string } => item !== null)
}

const asNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return fallback
}

const parseTeachingType = (value: unknown): TeachingType => {
  if (
    value === "general" ||
    value === "technical" ||
    value === "mixed" ||
    value === "primaire" ||
    value === "secondaire" ||
    value === "superieur" ||
    value === "mixte"
  ) {
    return value
  }

  return "general"
}

const parseSchoolPlan = (value: unknown): SchoolPlan => {
  if (value === "essential" || value === "pro" || value === "establishment") {
    return value
  }

  return "essential"
}

const parsePosition = (value: unknown): PositionItem => {
  const row = isRecord(value) ? value : {}

  return {
    id: asString(row.id),
    name: asString(row.name, "Poste"),
    permissions: Array.isArray(row.permissions)
      ? row.permissions.filter((item): item is string => typeof item === "string")
      : [],
    assignmentsCount: asNumber(row.assignmentsCount ?? row.assignments_count, 0),
  }
}

const parseUser = (value: unknown): AssignableUser => {
  const row = isRecord(value) ? value : {}

  return {
    id: asString(row.id),
    name: asString(row.name, "Utilisateur"),
    role: asString(row.role, "user"),
    email: asNullableString(row.email),
    phone: asNullableString(row.phone),
    assignedPositions: asAssignedPositions(row.assignedPositions ?? row.assigned_positions),
    positions: asStringArray(row.positions ?? row.positionNames ?? row.position_names),
    permissions: asStringArray(row.permissions),
  }
}

const parseConfigEnvelope = (value: unknown): SchoolConfigData => {
  const payload = isRecord(value) ? value : {}

  const schoolRaw = isRecord(payload.school) ? payload.school : {}
  const limitsRaw = isRecord(payload.limits) ? payload.limits : {}
  const positionsRaw = Array.isArray(payload.positions) ? payload.positions : []
  const usersRaw = Array.isArray(payload.users) ? payload.users : []

  return {
    school: {
      name: asString(schoolRaw.name),
      subdomain: asString(schoolRaw.subdomain),
      plan: parseSchoolPlan(schoolRaw.plan),
      city: asString(schoolRaw.city),
      teachingType: parseTeachingType(schoolRaw.teachingType ?? schoolRaw.teaching_type),
      maxUsers: asNumber(schoolRaw.maxUsers ?? schoolRaw.max_users, 0),
      currentUsers: asNumber(schoolRaw.currentUsers ?? schoolRaw.current_users, 0),
      totalUsers: asNumber(schoolRaw.totalUsers ?? schoolRaw.total_users, 0),
      adminUsersCount: asNumber(schoolRaw.adminUsersCount ?? schoolRaw.admin_users_count, 0),
      logoUrl: asNullableString(schoolRaw.logoUrl ?? schoolRaw.logo_url),
      activeSchoolYear: asNullableString(schoolRaw.activeSchoolYear ?? schoolRaw.active_school_year),
      canEditSmsTemplate: Boolean(schoolRaw.canEditSmsTemplate ?? schoolRaw.can_edit_sms_template),
      allowTeacherQrSkip: Boolean(
        schoolRaw.allowTeacherQrSkip ?? schoolRaw.allow_teacher_qr_skip
      ),
    },
    limits: {
      maxAdminPositions: asNumber(limitsRaw.max_admin_positions ?? limitsRaw.maxAdminPositions, 0),
    },
    positions: positionsRaw.map((entry) => parsePosition(entry)),
    users: usersRaw.map((entry) => parseUser(entry)),
  }
}

const parsePositionsEnvelope = (value: unknown): PositionItem[] => {
  const payload = isRecord(value) ? value : {}
  const rows = Array.isArray(payload.positions) ? payload.positions : Array.isArray(value) ? value : []
  return rows.map((entry) => parsePosition(entry))
}

const parseSchoolInfo = (value: unknown): SchoolConfigData["school"] => {
  const payload = isRecord(value) ? value : {}

  return {
    name: asString(payload.name),
    subdomain: asString(payload.subdomain),
    plan: parseSchoolPlan(payload.plan),
    city: asString(payload.city),
    teachingType: parseTeachingType(payload.teachingType ?? payload.teaching_type),
    maxUsers: asNumber(payload.maxUsers ?? payload.max_users, 0),
    currentUsers: asNumber(payload.currentUsers ?? payload.current_users, 0),
    totalUsers: asNumber(payload.totalUsers ?? payload.total_users, 0),
    adminUsersCount: asNumber(payload.adminUsersCount ?? payload.admin_users_count, 0),
    logoUrl: asNullableString(payload.logoUrl ?? payload.logo_url),
    activeSchoolYear: asNullableString(payload.activeSchoolYear ?? payload.active_school_year),
    canEditSmsTemplate: false,
    allowTeacherQrSkip: false,
  }
}

export type SchoolSmsTemplateResponse = {
  enabledBySuperAdmin: boolean
  source: "school" | "global" | "default"
  messageTemplate: string
  variables: string[]
  updatedAt: string | null
}

export const fetchSchoolConfig = async (): Promise<SchoolConfigData> => {
  try {
    const response = await apiClient.get("/permissions/config")
    return parseConfigEnvelope(response.data)
  } catch {
    const schoolInfoResponse = await apiClient.get("/school/info")
    const positionsResponse = await apiClient
      .get("/permissions/positions")
      .catch(() => ({ data: { positions: [] } }))

    return {
      school: parseSchoolInfo(schoolInfoResponse.data),
      limits: { maxAdminPositions: 0 },
      positions: parsePositionsEnvelope(positionsResponse.data),
      users: [],
    }
  }
}

export const getSchoolStudentAbsenceSmsTemplate = async (): Promise<SchoolSmsTemplateResponse> => {
  const response = await apiClient.get<SchoolSmsTemplateResponse>("/notifications/templates/student-absence")
  return response.data
}

export const updateSchoolStudentAbsenceSmsTemplate = async (payload: {
  message_template: string
  variables: string[]
}): Promise<void> => {
  await apiClient.put("/notifications/templates/student-absence", payload)
}

export const resetSchoolStudentAbsenceSmsTemplate = async (): Promise<void> => {
  await apiClient.delete("/notifications/templates/student-absence")
}

export const updateSchoolInfo = async (payload: {
  name: string
  city: string
  teachingType: TeachingType
  logoUrl?: string | null
  allowTeacherQrSkip?: boolean
}): Promise<void> => {
  try {
    await apiClient.patch("/permissions/config/school", {
      name: payload.name,
      city: payload.city,
      teachingType: payload.teachingType,
      ...(payload.logoUrl !== undefined ? { logoUrl: payload.logoUrl } : {}),
      ...(payload.allowTeacherQrSkip !== undefined
        ? { allowTeacherQrSkip: payload.allowTeacherQrSkip }
        : {}),
    })
  } catch {
    await apiClient.patch("/school/info", {
      name: payload.name,
      city: payload.city,
    })
  }
}

export const updateSchoolLimit = async (maxAdminPositions: number): Promise<void> => {
  await apiClient.patch("/permissions/config/limits", {
    max_admin_positions: maxAdminPositions,
  })
}

export const deletePosition = async (positionId: string): Promise<void> => {
  await apiClient.delete(`/permissions/positions/${positionId}`)
}

export const assignUserToPosition = async (positionId: string, userId: string): Promise<void> => {
  await apiClient.post(`/permissions/positions/${positionId}/assign`, {
    userId,
  })
}

export const unassignUserFromPosition = async (positionId: string, userId: string): Promise<void> => {
  await apiClient.delete(`/permissions/positions/${positionId}/assign/${userId}`)
}

export const createAdministrativeUser = async (
  payload: CreateAdministrativeUserInput
): Promise<AssignableUser> => {
  const response = await apiClient.post("/permissions/users", payload)
  const envelope = isRecord(response.data) ? response.data : {}
  return parseUser(envelope.user)
}

export const updateAdministrativeUser = async (
  payload: UpdateAdministrativeUserInput
): Promise<AssignableUser> => {
  const response = await apiClient.put(`/permissions/users/${payload.id}`, {
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.email !== undefined ? { email: payload.email } : {}),
    ...(payload.phone !== undefined ? { phone: payload.phone } : {}),
  })
  const envelope = isRecord(response.data) ? response.data : {}
  return parseUser(envelope.user)
}

export const deleteAdministrativeUser = async (userId: string): Promise<void> => {
  await apiClient.delete(`/permissions/users/${userId}`)
}

export const resetAdministrativeUserPassword = async (
  userId: string,
  newPassword: string
): Promise<void> => {
  await apiClient.post(`/permissions/users/${userId}/reset-password`, {
    newPassword,
  })
}

export const changePassword = async (payload: ChangePasswordInput): Promise<void> => {
  await apiClient.post("/auth/change-password", {
    currentPassword: payload.currentPassword,
    newPassword: payload.newPassword,
    confirmPassword: payload.newPassword,
  })
}
