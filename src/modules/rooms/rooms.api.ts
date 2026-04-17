import { apiClient as api } from "@/shared/api/client"

type UnknownRecord = Record<string, unknown>

export type RoomListItem = {
  id: string
  name: string
  building: string | null
  capacity: number | null
  isActive: boolean
  createdAt: string
  stats: {
    weeklySchedulesCount: number
    scansCount: number
  }
}

export type RoomQrPayload = {
  roomName: string
  qrToken: string
  qrUrl: string
}

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null

const asString = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback

const asNullableString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null

const asNullableNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const asNumber = (value: unknown, fallback = 0): number => {
  const parsed = asNullableNumber(value)
  return parsed ?? fallback
}

const asBoolean = (value: unknown, fallback = false): boolean =>
  typeof value === "boolean" ? value : fallback

const parseRoom = (value: unknown): RoomListItem => {
  const row = isRecord(value) ? value : {}
  const stats = isRecord(row.stats) ? row.stats : {}

  return {
    id: asString(row.id),
    name: asString(row.name),
    building: asNullableString(row.building),
    capacity: asNullableNumber(row.capacity),
    isActive: asBoolean(row.isActive, true),
    createdAt: asString(row.createdAt),
    stats: {
      weeklySchedulesCount: asNumber(stats.weeklySchedulesCount, 0),
      scansCount: asNumber(stats.scansCount, 0),
    },
  }
}

export const listRooms = async (): Promise<RoomListItem[]> => {
  const response = await api.get<unknown>("/rooms")
  const payload = isRecord(response.data) ? response.data : {}
  const rows = Array.isArray(payload.rooms) ? payload.rooms : []
  return rows.map(parseRoom)
}

export const createRoom = async (input: {
  name: string
  building?: string | null
  capacity?: number | null
}): Promise<void> => {
  await api.post("/rooms", {
    name: input.name.trim(),
    building: input.building?.trim() ? input.building.trim() : null,
    capacity: input.capacity ?? null,
  })
}

export const updateRoom = async (
  roomId: string,
  input: { name?: string; building?: string | null; capacity?: number | null }
): Promise<void> => {
  await api.put(`/rooms/${roomId}`, {
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.building !== undefined ? { building: input.building?.trim() ? input.building.trim() : null } : {}),
    ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
  })
}

export const deleteRoom = async (roomId: string): Promise<void> => {
  await api.delete(`/rooms/${roomId}`)
}

export const regenerateRoomQr = async (roomId: string): Promise<RoomQrPayload> => {
  const response = await api.post<unknown>(`/rooms/${roomId}/regenerate-token`)
  const payload = isRecord(response.data) ? response.data : {}
  const room = isRecord(payload.room) ? payload.room : {}

  return {
    roomName: asString(room.name),
    qrToken: asString(room.qrToken),
    qrUrl: asString(payload.qr_url),
  }
}

export const getRoomQr = async (roomId: string): Promise<RoomQrPayload> => {
  const response = await api.get<unknown>(`/rooms/${roomId}/qr`)
  const payload = isRecord(response.data) ? response.data : {}

  return {
    roomName: asString(payload.room_name),
    qrToken: asString(payload.qr_token),
    qrUrl: asString(payload.qr_url),
  }
}
