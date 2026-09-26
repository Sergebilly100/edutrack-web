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
  use_real_hours?: boolean
  geo_check_enabled?: boolean
}

export type OnboardingStatus = {
  schoolId: string
  schoolInfoComplete: boolean
  activeYear: boolean
  levels: boolean
  subjects: boolean
  rooms: boolean
  fees: boolean
  teachers: boolean
  missing: string[]
  canComplete: boolean
}

export const fetchSchoolInfo = () =>
  api.get<SchoolInfoResponse>("/school/info").then((response) => response.data)

export const patchSchoolInfo = (payload: SchoolInfoPayload) =>
  api.patch<SchoolInfoResponse>("/school/info", payload).then((response) => response.data)

export const fetchOnboardingStatus = () =>
  api.get<OnboardingStatus>("/school/onboarding-status").then((response) => response.data)

export const completeOnboarding = () =>
  api.patch<SchoolInfoResponse>("/school/onboarding-complete").then((response) => response.data)
