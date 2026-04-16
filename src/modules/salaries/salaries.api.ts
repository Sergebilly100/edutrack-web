import { apiClient as api } from "@/shared/api/client"

export type SalaryStatus = "pending" | "paid" | "disputed" | "Salaire fixe"

export type SalarySummaryItem = {
  teacherId: string
  teacherName: string
  teacherType: "vacataire" | "permanent"
  hoursPlanned: number
  hoursDone: number
  hourlyRate: number | null
  totalFcfa: number | null
  status: SalaryStatus
  salaryRecordId: string | null
}

export type SalarySummaryResponse = {
  month: string
  items: SalarySummaryItem[]
}

export type ComputeSalaryResponse = {
  month: string
  updatedCount: number
}

export type UpdateSalaryStatusInput = {
  recordId: string
  status: "paid" | "disputed"
  notes?: string
}

export type ExportJobState = "queued" | "running" | "done" | "failed" | "unknown"

export type ExportJobStatus = {
  jobId: string
  rawState: string
  state: ExportJobState
  downloadUrl: string | null
  failedReason: string | null
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

const getMonthKey = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}

const addMonths = (month: string, amount: number): string => {
  const [yearRaw, monthRaw] = month.split("-")
  const year = Number(yearRaw)
  const monthIndex = Number(monthRaw) - 1

  const moved = new Date(Date.UTC(year, monthIndex + amount, 1))
  return getMonthKey(moved)
}

const parseSalaryStatus = (value: unknown): SalaryStatus => {
  if (value === "pending" || value === "paid" || value === "disputed" || value === "Salaire fixe") {
    return value
  }

  return "pending"
}

const parseSalaryItem = (value: unknown): SalarySummaryItem => {
  const row = isRecord(value) ? value : {}

  return {
    teacherId: asString(row.teacherId),
    teacherName: asString(row.teacherName, "Professeur"),
    teacherType: asString(row.teacherType) === "permanent" ? "permanent" : "vacataire",
    hoursPlanned: asNumber(row.hoursPlanned, 0),
    hoursDone: asNumber(row.hoursDone, 0),
    hourlyRate: row.hourlyRate === null ? null : asNumber(row.hourlyRate, 0),
    totalFcfa: row.totalFcfa === null ? null : asNumber(row.totalFcfa, 0),
    status: parseSalaryStatus(row.status),
    salaryRecordId: asNullableString(row.salaryRecordId),
  }
}

export const formatMonthLabel = (month: string): string => {
  const [yearRaw, monthRaw] = month.split("-")
  const year = Number(yearRaw)
  const monthIndex = Number(monthRaw) - 1

  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return month
  }

  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, monthIndex, 1)))
}

export const getCurrentMonth = (): string => getMonthKey(new Date())

export const getPreviousMonth = (month: string): string => addMonths(month, -1)

export const getNextMonth = (month: string): string => addMonths(month, 1)

export const getRecentMonthOptions = (aroundMonth: string, count = 18): string[] => {
  const safeCount = Math.max(1, count)

  return Array.from({ length: safeCount }, (_, index) => getPreviousMonth(addMonths(aroundMonth, 1 - index)))
}

export const isFutureMonth = (month: string): boolean => {
  return month > getCurrentMonth()
}

export const getSalarySummary = async (month: string): Promise<SalarySummaryResponse> => {
  const response = await api.get("/billing/salary/summary", {
    params: { month },
  })

  const payload = isRecord(response.data) ? response.data : {}
  const items = Array.isArray(payload.items) ? payload.items.map((entry) => parseSalaryItem(entry)) : []

  return {
    month: asString(payload.month, month),
    items,
  }
}

export const computeSalaries = async (month: string): Promise<ComputeSalaryResponse> => {
  const response = await api.post(
    "/billing/salary/compute",
    undefined,
    {
      params: { month },
    }
  )

  const payload = isRecord(response.data) ? response.data : {}

  return {
    month: asString(payload.month, month),
    updatedCount: asNumber(payload.updatedCount, 0),
  }
}

export const updateSalaryStatus = async (input: UpdateSalaryStatusInput): Promise<void> => {
  await api.patch(`/billing/salary/${input.recordId}/status`, {
    status: input.status,
    notes: input.notes?.trim() ? input.notes.trim() : undefined,
  })
}

const normalizeJobState = (value: unknown): ExportJobState => {
  if (value === "completed" || value === "done") {
    return "done"
  }

  if (value === "waiting" || value === "delayed") {
    return "queued"
  }

  if (value === "active") {
    return "running"
  }

  if (value === "failed") {
    return "failed"
  }

  return "unknown"
}

const resolveDownloadUrl = (value: unknown): string | null => {
  if (typeof value !== "string" || value.length === 0) {
    return null
  }

  if (/^https?:\/\//i.test(value)) {
    return value
  }

  if (value.startsWith("/")) {
    try {
      const base = import.meta.env.VITE_API_URL as string | undefined
      if (base && base.length > 0) {
        return new URL(value, base).toString()
      }
    } catch {
      return value
    }
    return value
  }

  return value
}

const parseJobPayload = (value: unknown): ExportJobStatus => {
  const payload = isRecord(value) ? value : {}
  const result = isRecord(payload.result) ? payload.result : {}
  const status = asString(payload.status)

  const possibleUrl =
    payload.resultUrl ??
    payload.downloadUrl ??
    result.url ??
    result.fileUrl ??
    result.downloadUrl ??
    result.file_url ??
    result.filePath ??
    result.file_path

  const rawState = asString(payload.state, status || "unknown")
  const normalizedFromStatus =
    status === "pending"
      ? "queued"
      : status === "processing"
        ? "running"
        : status === "done" || status === "failed"
          ? status
          : null

  return {
    jobId: asString(payload.jobId),
    rawState,
    state: normalizedFromStatus ?? normalizeJobState(rawState),
    downloadUrl: resolveDownloadUrl(possibleUrl),
    failedReason: asNullableString(payload.failedReason),
  }
}

export const queueSchoolSalaryExport = async (month: string): Promise<{ jobId: string }> => {
  try {
    const response = await api.post(
      "/billing/salary/export/school",
      undefined,
      {
        params: { month },
      }
    )

    const payload = isRecord(response.data) ? response.data : {}
    return { jobId: asString(payload.jobId) }
  } catch {
    const fallback = await api.get("/billing/salary/export/school", {
      params: { month },
    })

    const payload = isRecord(fallback.data) ? fallback.data : {}
    return { jobId: asString(payload.jobId) }
  }
}

export const queueTeacherSalaryExport = async (
  teacherId: string,
  month: string
): Promise<{ jobId: string }> => {
  try {
    const response = await api.post("/billing/salary/export", {
      teacherId,
      periodMonth: month,
    })

    const payload = isRecord(response.data) ? response.data : {}
    return { jobId: asString(payload.jobId) }
  } catch {
    const fallback = await api.get(`/billing/salary/export/${teacherId}`, {
      params: { month },
    })

    const payload = isRecord(fallback.data) ? fallback.data : {}
    return { jobId: asString(payload.jobId) }
  }
}

export const queueBulkSalaryExport = async (input: {
  periodFrom: string
  periodTo: string
  teacherId?: string
}): Promise<{ jobId: string }> => {
  const response = await api.post("/billing/salary/export/bulk", {
    periodFrom: input.periodFrom,
    periodTo: input.periodTo,
    teacherId: input.teacherId ?? null,
  })

  const payload = isRecord(response.data) ? response.data : {}
  return { jobId: asString(payload.jobId) }
}

export const getExportJobStatus = async (jobId: string): Promise<ExportJobStatus> => {
  const response = await api.get(`/jobs/${jobId}/status`)
  return parseJobPayload(response.data)
}
