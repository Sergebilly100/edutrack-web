import { apiClient as api } from "@/shared/api/client"
import { asBoolean, asNumber, asString, isRecord } from "@/shared/utils/parsers"

export type SchoolYearStatus = "draft" | "active" | "closed"

export type SchoolYear = {
  id: string
  label: string
  startDate: string
  endDate: string
  status: SchoolYearStatus
  createdAt: string
  updatedAt: string
}

export type Level = {
  id: string
  name: string
  orderIndex: number
  isExamClass: boolean
  createdAt: string
  updatedAt: string
}

export type SchoolClass = {
  id: string
  name: string
  studentCount: number
  isActive: boolean
  level: Pick<Level, "id" | "name" | "orderIndex">
  schoolYear: Pick<SchoolYear, "id" | "label">
  homeroomTeacher: { id: string; name: string } | null
  createdAt: string
  updatedAt: string
}

export type SchoolYearPayload = {
  label: string
  startDate: string
  endDate: string
  status: SchoolYearStatus
}

export type LevelPayload = {
  name: string
  orderIndex: number
  isExamClass: boolean
}

export type ClassPayload = {
  name: string
  levelId: string
  homeroomTeacherId: string | null
}

export type ClassesResponse = {
  schoolYear: SchoolYear | null
  activeSchoolYear: SchoolYear | null
  classes: SchoolClass[]
}

const asRecord = (value: unknown): Record<string, unknown> => isRecord(value) ? value : {}

const parseStatus = (value: unknown): SchoolYearStatus =>
  value === "active" || value === "closed" ? value : "draft"

const parseSchoolYear = (value: unknown): SchoolYear => {
  const row = asRecord(value)
  return {
    id: asString(row.id),
    label: asString(row.label),
    startDate: asString(row.startDate ?? row.start_date),
    endDate: asString(row.endDate ?? row.end_date),
    status: parseStatus(row.status),
    createdAt: asString(row.createdAt ?? row.created_at),
    updatedAt: asString(row.updatedAt ?? row.updated_at),
  }
}

const parseLevel = (value: unknown): Level => {
  const row = asRecord(value)
  return {
    id: asString(row.id),
    name: asString(row.name),
    orderIndex: asNumber(row.orderIndex ?? row.order_index),
    isExamClass: asBoolean(row.isExamClass ?? row.is_exam_class),
    createdAt: asString(row.createdAt ?? row.created_at),
    updatedAt: asString(row.updatedAt ?? row.updated_at),
  }
}

const parseClass = (value: unknown): SchoolClass => {
  const row = asRecord(value)
  const level = asRecord(row.level)
  const schoolYear = asRecord(row.schoolYear ?? row.school_year)
  const teacherValue = row.homeroomTeacher ?? row.homeroom_teacher
  const teacher = isRecord(teacherValue) ? teacherValue : null

  return {
    id: asString(row.id),
    name: asString(row.name),
    studentCount: asNumber(row.studentCount ?? row.student_count),
    isActive: asBoolean(row.isActive ?? row.is_active),
    level: {
      id: asString(level.id),
      name: asString(level.name),
      orderIndex: asNumber(level.orderIndex ?? level.order_index),
    },
    schoolYear: {
      id: asString(schoolYear.id),
      label: asString(schoolYear.label),
    },
    homeroomTeacher: teacher
      ? { id: asString(teacher.id), name: asString(teacher.name) }
      : null,
    createdAt: asString(row.createdAt ?? row.created_at),
    updatedAt: asString(row.updatedAt ?? row.updated_at),
  }
}

export async function listSchoolYears(): Promise<SchoolYear[]> {
  const response = await api.get("/school-years")
  const payload = asRecord(response.data)
  const rows = Array.isArray(payload.schoolYears) ? payload.schoolYears : []
  return rows.map(parseSchoolYear)
}

export async function createSchoolYear(payload: SchoolYearPayload): Promise<SchoolYear> {
  const response = await api.post("/school-years", payload)
  return parseSchoolYear(asRecord(response.data).schoolYear)
}

export async function updateSchoolYear(id: string, payload: SchoolYearPayload): Promise<SchoolYear> {
  const response = await api.patch(`/school-years/${id}`, payload)
  return parseSchoolYear(asRecord(response.data).schoolYear)
}

export async function listLevels(): Promise<Level[]> {
  const response = await api.get("/levels")
  const payload = asRecord(response.data)
  const rows = Array.isArray(payload.levels) ? payload.levels : []
  return rows.map(parseLevel)
}

export async function createLevel(payload: LevelPayload): Promise<Level> {
  const response = await api.post("/levels", payload)
  return parseLevel(asRecord(response.data).level)
}

export async function updateLevel(id: string, payload: LevelPayload): Promise<Level> {
  const response = await api.patch(`/levels/${id}`, payload)
  return parseLevel(asRecord(response.data).level)
}

export async function listClasses(schoolYearId?: string): Promise<ClassesResponse> {
  const response = await api.get("/classes", {
    params: schoolYearId ? { schoolYearId } : undefined,
  })
  const payload = asRecord(response.data)
  const rows = Array.isArray(payload.classes) ? payload.classes : []
  const schoolYearValue = payload.schoolYear ?? payload.activeSchoolYear

  return {
    schoolYear: isRecord(schoolYearValue) ? parseSchoolYear(schoolYearValue) : null,
    activeSchoolYear: isRecord(payload.activeSchoolYear)
      ? parseSchoolYear(payload.activeSchoolYear)
      : null,
    classes: rows.map(parseClass),
  }
}

export async function createClass(payload: ClassPayload): Promise<SchoolClass> {
  const response = await api.post("/classes", payload)
  return parseClass(asRecord(response.data).class)
}

export async function updateClass(id: string, payload: ClassPayload): Promise<SchoolClass> {
  const response = await api.patch(`/classes/${id}`, payload)
  return parseClass(asRecord(response.data).class)
}

export async function archiveClass(id: string): Promise<SchoolClass> {
  const response = await api.delete(`/classes/${id}`)
  return parseClass(asRecord(response.data).class)
}
