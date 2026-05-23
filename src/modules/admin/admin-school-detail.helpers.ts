import type {
  TeachingType,
  TenantPlan,
  TenantStatus,
} from "@/modules/admin/admin.api"

export const PLAN_OPTIONS: TenantPlan[] = ["essential", "pro", "establishment"]
export const TEACHING_OPTIONS: TeachingType[] = [
  "primaire",
  "secondaire",
  "superieur",
  "mixte",
]
export const STATUS_OPTIONS: TenantStatus[] = [
  "trial",
  "active",
  "suspended",
  "cancelled",
]

export type CreatedDirectorCredentials = {
  userId: string
  name: string
  phone: string
  email: string | null
  password: string
}

export type AdminSchoolDetailLocationState = {
  createdDirectorCredentials?: CreatedDirectorCredentials
}

export const formatFcfa = (value: number) =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)} FCFA`

export const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString("fr-FR") : "-"

export const formatDateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString("fr-FR") : "-"

export const credentialLabel = (phone: string | null, email: string | null) =>
  email ?? phone ?? "-"

export const toBarWidthClass = (pct: number) => {
  if (pct >= 100) return "w-full"
  if (pct >= 90) return "w-11/12"
  if (pct >= 80) return "w-5/6"
  if (pct >= 70) return "w-4/5"
  if (pct >= 60) return "w-3/5"
  if (pct >= 50) return "w-1/2"
  if (pct >= 40) return "w-2/5"
  if (pct >= 30) return "w-1/3"
  if (pct >= 20) return "w-1/4"
  if (pct >= 10) return "w-1/6"
  return "w-1/12"
}
