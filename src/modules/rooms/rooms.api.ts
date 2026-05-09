import { apiClient as api } from "@/shared/api/client"
import { asBoolean, asNullableNumber, asNullableString, asNumber, asString, isRecord } from "@/shared/utils/parsers"

export type RoomListItem = {
  id: string
  name: string
  building: string | null
  capacity: number | null
  latitude: number | null
  longitude: number | null
  geoRadius: number | null
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

const parseRoom = (value: unknown): RoomListItem => {
  const row = isRecord(value) ? value : {}
  const stats = isRecord(row.stats) ? row.stats : {}

  return {
    id: asString(row.id),
    name: asString(row.name),
    building: asNullableString(row.building),
    capacity: asNullableNumber(row.capacity),
    latitude: asNullableNumber(row.latitude),
    longitude: asNullableNumber(row.longitude),
    geoRadius: asNullableNumber(row.geoRadius ?? row.geo_radius),
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
  latitude?: number | null
  longitude?: number | null
  geoRadius?: number | null
}): Promise<void> => {
  await api.post("/rooms", {
    name: input.name.trim(),
    building: input.building?.trim() ? input.building.trim() : null,
    capacity: input.capacity ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    geoRadius: input.geoRadius ?? 100,
  })
}

export const updateRoom = async (
  roomId: string,
  input: {
    name?: string
    building?: string | null
    capacity?: number | null
    latitude?: number | null
    longitude?: number | null
    geoRadius?: number | null
  }
): Promise<void> => {
  await api.patch(`/rooms/${roomId}`, {
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.building !== undefined ? { building: input.building?.trim() ? input.building.trim() : null } : {}),
    ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
    ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
    ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
    ...(input.geoRadius !== undefined ? { geoRadius: input.geoRadius } : {}),
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
