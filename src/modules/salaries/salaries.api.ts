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
  isPartiallyPaid: boolean
  paidAt: string | null
}

export type SalarySummaryResponse = {
  month: string
  items: SalarySummaryItem[]
}

export type SalaryDetailAttendanceStatus = "present" | "absent" | "late" | "excused" | "not_marked"

export type SalaryDetailRow = {
  date: string
  className: string
  subject: string
  startTime: string
  endTime: string
  attendanceStatus: SalaryDetailAttendanceStatus
  hoursPlanned: number
  hoursDone: number
}

export type SalaryTeacherDetails = {
  teacher: {
    id: string
    name: string
    type: "vacataire" | "permanent"
    hourlyRate: number | null
    monthlySalary: number | null
  }
  summary: {
    hoursPlanned: number
    hoursDone: number
    totalFcfa: number | null
    status: SalaryStatus
    absenceHours: number
    remainingPlannedHours: number
    currentEarnedAmount: number | null
    amountAlreadyPaid: number | null
    amountRemainingToPayNow: number | null
    remainingPotentialAmount: number | null
    absenceAmount: number | null
    isPartiallyPaid: boolean
  }
  payment: {
    paidAt: string | null
    paidBy: string | null
    paidByName: string | null
    notes: string | null
  }
  rows: SalaryDetailRow[]
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
    isPartiallyPaid: Boolean(row.isPartiallyPaid),
    paidAt: asNullableString(row.paidAt),
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

const parseAttendanceStatus = (value: unknown): SalaryDetailAttendanceStatus => {
  if (value === "present" || value === "absent" || value === "late" || value === "excused" || value === "not_marked") {
    return value
  }
  return "not_marked"
}

export const getTeacherSalaryDetails = async (
  teacherId: string,
  month: string
): Promise<SalaryTeacherDetails> => {
  const response = await api.get(`/billing/salary/${teacherId}`, {
    params: { month },
  })
  const payload = isRecord(response.data) ? response.data : {}
  const teacher = isRecord(payload.teacher) ? payload.teacher : {}
  const summary = isRecord(payload.summary) ? payload.summary : {}
  const payment = isRecord(payload.payment) ? payload.payment : {}
  const rowsRaw = Array.isArray(payload.rows) ? payload.rows : []

  return {
    teacher: {
      id: asString(teacher.id, teacherId),
      name: asString(teacher.name, "Professeur"),
      type: asString(teacher.type) === "permanent" ? "permanent" : "vacataire",
      hourlyRate: teacher.hourlyRate === null ? null : asNumber(teacher.hourlyRate, 0),
      monthlySalary: teacher.monthlySalary === null ? null : asNumber(teacher.monthlySalary, 0),
    },
    summary: {
      hoursPlanned: asNumber(summary.hoursPlanned, 0),
      hoursDone: asNumber(summary.hoursDone, 0),
      totalFcfa: summary.totalFcfa === null ? null : asNumber(summary.totalFcfa, 0),
      status: parseSalaryStatus(summary.status),
      absenceHours: asNumber(summary.absenceHours, 0),
      remainingPlannedHours: asNumber(summary.remainingPlannedHours, 0),
      currentEarnedAmount: summary.currentEarnedAmount === null ? null : asNumber(summary.currentEarnedAmount, 0),
      amountAlreadyPaid: summary.amountAlreadyPaid === null ? null : asNumber(summary.amountAlreadyPaid, 0),
      amountRemainingToPayNow:
        summary.amountRemainingToPayNow === null ? null : asNumber(summary.amountRemainingToPayNow, 0),
      remainingPotentialAmount:
        summary.remainingPotentialAmount === null ? null : asNumber(summary.remainingPotentialAmount, 0),
      absenceAmount: summary.absenceAmount === null ? null : asNumber(summary.absenceAmount, 0),
      isPartiallyPaid: Boolean(summary.isPartiallyPaid),
    },
    payment: {
      paidAt: asNullableString(payment.paidAt),
      paidBy: asNullableString(payment.paidBy),
      paidByName: asNullableString(payment.paidByName),
      notes: asNullableString(payment.notes),
    },
    rows: rowsRaw.map((entry) => {
      const row = isRecord(entry) ? entry : {}
      return {
        date: asString(row.date),
        className: asString(row.className),
        subject: asString(row.subject),
        startTime: asString(row.startTime).slice(0, 5),
        endTime: asString(row.endTime).slice(0, 5),
        attendanceStatus: parseAttendanceStatus(row.attendanceStatus),
        hoursPlanned: asNumber(row.hoursPlanned, 0),
        hoursDone: asNumber(row.hoursDone, 0),
      }
    }),
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
    result.file_url

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

export const downloadSalaryExportFile = async (
  downloadUrl: string
): Promise<{ blob: Blob; fileName: string | null }> => {
  const response = await api.get<Blob>(downloadUrl, {
    responseType: "blob",
  })

  const disposition = response.headers["content-disposition"]
  const match = typeof disposition === "string" ? disposition.match(/filename="?([^";]+)"?/i) : null

  return {
    blob: response.data,
    fileName: match?.[1] ?? null,
  }
}
