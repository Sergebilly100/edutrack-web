import { apiClient } from "@/shared/api/client"

export type TeachingType = "general" | "technical" | "mixed"

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
}

export type SchoolConfigData = {
  school: {
    name: string
    city: string
    teachingType: TeachingType
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

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null

const asString = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback

const asNullableString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null

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
  if (value === "general" || value === "technical" || value === "mixed") {
    return value
  }

  return "general"
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
      city: asString(schoolRaw.city),
      teachingType: parseTeachingType(schoolRaw.teachingType ?? schoolRaw.teaching_type),
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
    city: asString(payload.city),
    teachingType: parseTeachingType(payload.teachingType ?? payload.teaching_type),
  }
}

export const fetchSchoolConfig = async (): Promise<SchoolConfigData> => {
  try {
    const response = await apiClient.get("/permissions/config")
    return parseConfigEnvelope(response.data)
  } catch {
    const [schoolInfoResponse, positionsResponse] = await Promise.all([
      apiClient.get("/school/info"),
      apiClient.get("/permissions/positions"),
    ])

    return {
      school: parseSchoolInfo(schoolInfoResponse.data),
      limits: { maxAdminPositions: 0 },
      positions: parsePositionsEnvelope(positionsResponse.data),
      users: [],
    }
  }
}

export const updateSchoolInfo = async (payload: {
  name: string
  city: string
  teachingType: TeachingType
}): Promise<void> => {
  try {
    await apiClient.patch("/permissions/config/school", {
      name: payload.name,
      city: payload.city,
      teachingType: payload.teachingType,
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

export const changePassword = async (payload: ChangePasswordInput): Promise<void> => {
  await apiClient.post("/auth/change-password", {
    currentPassword: payload.currentPassword,
    newPassword: payload.newPassword,
  })
}
