import { z } from "zod"
import { apiClient as api } from "@/shared/api/client"

// ─── Import history ───────────────────────────────────────────────────────────

export type ImportHistoryItem = {
  id: string
  importedAt: string
  type: "students" | "teachers" | "schedule"
  importedCount: number
  updatedCount: number
  importedBy: string | null
  importedByName: string | null
  importedByRole: string | null
}

const ImportHistoryItemSchema = z.object({
  id: z.string(),
  imported_at: z.string(),
  type: z.enum(["students", "teachers", "schedule"]),
  imported_count: z.number(),
  updated_count: z.number(),
  imported_by: z.string().nullable().optional(),
  imported_by_name: z.string().nullable().optional(),
  imported_by_role: z.string().nullable().optional(),
})

const ImportHistoryResponseSchema = z.object({
  items: z.array(ImportHistoryItemSchema).default([]),
  total: z.number().default(0),
  page: z.number().default(1),
  totalPages: z.number().default(1),
})

export type ImportHistoryFilter = {
  limit?: number
  page?: number
  month?: string   // "YYYY-MM"
  type?: ImportType
}

export type ImportHistoryResult = {
  items: ImportHistoryItem[]
  total: number
  page: number
  totalPages: number
}

export const fetchImportHistory = async (filter: ImportHistoryFilter = {}): Promise<ImportHistoryResult> => {
  const { limit = 20, page = 1, month, type } = filter
  const response = await api.get("/import/history", {
    params: { limit, page, ...(month ? { month } : {}), ...(type ? { type } : {}) },
  })
  const parsed = ImportHistoryResponseSchema.parse(response.data)
  return {
    items: parsed.items.map((item) => ({
      id: item.id,
      importedAt: item.imported_at,
      type: item.type,
      importedCount: item.imported_count,
      updatedCount: item.updated_count,
      importedBy: item.imported_by ?? null,
      importedByName: item.imported_by_name ?? null,
      importedByRole: item.imported_by_role ?? null,
    })),
    total: parsed.total,
    page: parsed.page,
    totalPages: parsed.totalPages,
  }
}

export type ImportType = "students" | "teachers" | "schedule"

export type ImportIssue = {
  row: number
  column: string
  message: string
  value?: string
  severity: "error" | "warning"
  sheet?: string
}

export type DiffPreviewItem = {
  key: string
  displayName: string
  changes?: Record<string, { before: string | null; after: string | null }>
}

export type ImportMode = "merge" | "replace"

export type DryRunResponse = {
  valid: number
  errors: ImportIssue[]
  preview: Record<string, string>[]
  toAdd: DiffPreviewItem[]
  toUpdate: DiffPreviewItem[]
  toDelete: DiffPreviewItem[]
  unchanged: number
  importMode: ImportMode
  conflicts: Array<{
    periodName: string
    weekStart: string
    weekEnd: string
    message: string
  }>
}

export type ConfirmImportResponse = {
  imported: number
  updated: number
  errors: ImportIssue[]
  preview: Record<string, string>[]
  deactivated: number
  importMode: ImportMode
}

type RawImportIssue = {
  row: number
  column: string
  message: string
  value?: string
  severity?: string
  level?: string
  sheet?: string
}

const ImportIssueSchema = z.object({
  row: z.number(),
  column: z.string(),
  message: z.string(),
  value: z.string().optional(),
  severity: z.enum(["error", "warning"]).optional(),
  level: z.string().optional(),
  sheet: z.string().optional(),
})

const DryRunResponseSchema = z.object({
  valid: z.number(),
  errors: z.array(ImportIssueSchema).default([]),
  preview: z.array(z.record(z.string(), z.string())).default([]),
  toAdd: z
    .array(
      z.object({
        key: z.string(),
        displayName: z.string(),
        changes: z.record(z.string(), z.object({ before: z.string().nullable(), after: z.string().nullable() })).optional(),
      })
    )
    .default([]),
  toUpdate: z
    .array(
      z.object({
        key: z.string(),
        displayName: z.string(),
        changes: z.record(z.string(), z.object({ before: z.string().nullable(), after: z.string().nullable() })).optional(),
      })
    )
    .default([]),
  toDelete: z
    .array(
      z.object({
        key: z.string(),
        displayName: z.string(),
      })
    )
    .default([]),
  unchanged: z.number().default(0),
  importMode: z.enum(["merge", "replace"]).default("merge"),
  conflicts: z
    .array(
      z.object({
        periodName: z.string(),
        weekStart: z.string(),
        weekEnd: z.string(),
        message: z.string(),
      })
    )
    .default([]),
})

const ConfirmResponseSchema = z.object({
  imported: z.number(),
  updated: z.number(),
  errors: z.array(ImportIssueSchema).default([]),
  preview: z.array(z.record(z.string(), z.string())).default([]),
  deactivated: z.number().default(0),
  importMode: z.enum(["merge", "replace"]).default("merge"),
})

const toSeverity = (issue: RawImportIssue): "error" | "warning" => {
  const normalized = (issue.severity ?? issue.level ?? "error").toLowerCase()
  return normalized === "warning" || normalized === "warn" ? "warning" : "error"
}

const normalizeIssue = (issue: RawImportIssue): ImportIssue => ({
  ...issue,
  severity: toSeverity(issue)
})

const toFormData = (
  file: File,
  options?: {
    importMode?: ImportMode
    schedulePeriod?: { weekStart: string; weekEnd: string }
    conflictAcknowledged?: boolean
  }
) => {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("mode", options?.importMode ?? "merge")
  if (options?.schedulePeriod) {
    formData.append("week_start", options.schedulePeriod.weekStart)
    formData.append("week_end", options.schedulePeriod.weekEnd)
  }
  if (typeof options?.conflictAcknowledged === "boolean") {
    formData.append("conflict_acknowledged", String(options.conflictAcknowledged))
  }
  return formData
}

const extractFilename = (disposition?: string) => {
  if (!disposition) {
    return null
  }

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1])
  }

  const match = disposition.match(/filename="?([^";]+)"?/i)
  return match?.[1] ?? null
}

export async function downloadTemplate(type: ImportType): Promise<void> {
  const response = await api.get<Blob>(`/import/${type}/template`, {
    responseType: "blob"
  })

  const filename =
    extractFilename(response.headers["content-disposition"]) ??
    `edutrack-import-${type}-template.xlsx`

  const url = window.URL.createObjectURL(response.data)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.URL.revokeObjectURL(url)
}

export async function dryRun(
  type: ImportType,
  file: File,
  options?: {
    importMode?: ImportMode
    schedulePeriod?: { weekStart: string; weekEnd: string }
  }
): Promise<DryRunResponse> {
  const response = await api.post(`/import/${type}/dry-run`, toFormData(file, options))
  const parsed = DryRunResponseSchema.parse(response.data)

  return {
    valid: parsed.valid,
    preview: parsed.preview,
    errors: parsed.errors.map(normalizeIssue),
    toAdd: parsed.toAdd,
    toUpdate: parsed.toUpdate,
    toDelete: parsed.toDelete,
    unchanged: parsed.unchanged,
    importMode: parsed.importMode,
    conflicts: parsed.conflicts,
  }
}

export async function confirmImport(
  type: ImportType,
  file: File,
  options?: {
    importMode?: ImportMode
    schedulePeriod?: { weekStart: string; weekEnd: string }
    conflictAcknowledged?: boolean
  }
): Promise<ConfirmImportResponse> {
  const response = await api.post(`/import/${type}/confirm`, toFormData(file, options))
  const parsed = ConfirmResponseSchema.parse(response.data)

  return {
    imported: parsed.imported,
    updated: parsed.updated,
    preview: parsed.preview,
    errors: parsed.errors.map(normalizeIssue),
    deactivated: parsed.deactivated,
    importMode: parsed.importMode,
  }
}
