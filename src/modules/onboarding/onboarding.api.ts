import { apiClient as api } from "@/shared/api/client"

export type SchoolInfoPayload = {
  name: string
  address: string
  phone: string
}

export type SchoolInfoResponse = {
  id?: string
  name?: string
  address?: string
  phone?: string
  onboarding_completed?: boolean
}

export type TeacherCreatePayload = {
  name: string
  subjects: string[]
  type: "vacataire" | "permanent"
}

export type TeacherItem = {
  id: string
  name: string
  username?: string
  subject?: string
}

export type StudentCreatePayload = {
  first_name: string
  last_name: string
  class_name: string
}

export type ScheduleCreatePayload = {
  teacher_id: string
  class_name: string
  day_of_week: number
  time_slot_label: string
}

export const fetchSchoolInfo = () =>
  api.get<SchoolInfoResponse>("/school/info").then((response) => response.data)

export const patchSchoolInfo = (payload: SchoolInfoPayload) =>
  api.patch<SchoolInfoResponse>("/school/info", payload).then((response) => response.data)

export const fetchTeachers = () =>
  api.get<TeacherItem[]>("/teachers").then((response) => response.data)

export const createTeacher = (payload: TeacherCreatePayload) =>
  api.post<TeacherItem>("/teachers", payload).then((response) => response.data)

export const createStudent = (payload: StudentCreatePayload) =>
  api.post<{ id: string }>("/students", payload).then((response) => response.data)

export const createScheduleSlot = (payload: ScheduleCreatePayload) =>
  api.post<{ id: string }>("/schedule", payload).then((response) => response.data)

export const completeOnboarding = () =>
  api.patch("/school/onboarding-complete").then((response) => response.data)
