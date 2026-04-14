import { z } from "zod"
import { apiClient as api } from "@/shared/api/client"

export type ImportType = "students" | "teachers" | "schedule"

export type ImportIssue = {
  row: number
  column: string
  message: string
  value?: string
  severity: "error" | "warning"
}

export type DryRunResponse = {
  valid: number
  errors: ImportIssue[]
  preview: Record<string, string>[]
}

export type ConfirmImportResponse = {
  imported: number
  updated: number
  errors: ImportIssue[]
  preview: Record<string, string>[]
}

type RawImportIssue = {
  row: number
  column: string
  message: string
  value?: string
  severity?: string
  level?: string
}

const ImportIssueSchema = z.object({
  row: z.number(),
  column: z.string(),
  message: z.string(),
  value: z.string().optional(),
  severity: z.enum(["error", "warning"]).optional(),
  level: z.string().optional()
})

const DryRunResponseSchema = z.object({
  valid: z.number(),
  errors: z.array(ImportIssueSchema).default([]),
  preview: z.array(z.record(z.string(), z.string())).default([])
})

const ConfirmResponseSchema = z.object({
  imported: z.number(),
  updated: z.number(),
  errors: z.array(ImportIssueSchema).default([]),
  preview: z.array(z.record(z.string(), z.string())).default([])
})

const toSeverity = (issue: RawImportIssue): "error" | "warning" => {
  const normalized = (issue.severity ?? issue.level ?? "error").toLowerCase()
  return normalized === "warning" || normalized === "warn" ? "warning" : "error"
}

const normalizeIssue = (issue: RawImportIssue): ImportIssue => ({
  ...issue,
  severity: toSeverity(issue)
})

const toFormData = (file: File) => {
  const formData = new FormData()
  formData.append("file", file)
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

export async function dryRun(type: ImportType, file: File): Promise<DryRunResponse> {
  const response = await api.post(`/import/${type}/dry-run`, toFormData(file))
  const parsed = DryRunResponseSchema.parse(response.data)

  return {
    valid: parsed.valid,
    preview: parsed.preview,
    errors: parsed.errors.map(normalizeIssue)
  }
}

export async function confirmImport(
  type: ImportType,
  file: File
): Promise<ConfirmImportResponse> {
  const response = await api.post(`/import/${type}/confirm`, toFormData(file))
  const parsed = ConfirmResponseSchema.parse(response.data)

  return {
    imported: parsed.imported,
    updated: parsed.updated,
    preview: parsed.preview,
    errors: parsed.errors.map(normalizeIssue)
  }
}
