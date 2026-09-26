import { apiClient as api } from '@/shared/api/client'
import { triggerBlobDownload } from '@/shared/api/pdfExport.api'

export const HISTORICAL_TARGETS = [
  { key: 'matricule', label: 'Matricule', required: true },
  { key: 'nom', label: 'Nom', required: true },
  { key: 'prenom', label: 'Prénom', required: true },
  { key: 'parent_phone', label: 'Téléphone parent', required: false },
] as const
export type HistoricalMappingField = {
  targetField: string; sourceColumnLabel: string; isRequired: boolean
  translations: Array<{ sourceValue: string; targetValue: string }>
}
export type HistoricalError = { rowNumber: number; field: string; reason: string }
export type HistoricalAnalysis = {
  headers: string[]; rowCount: number; validCount: number; missingTargets: string[]
  matchedFields: HistoricalMappingField[]; profile: { fields: HistoricalMappingField[] } | null
  sampleRows: Array<{ rowNumber: number; values: Record<string, string> }>; errors: HistoricalError[]
}
export type HistoricalResult = { createdCount: number; reusedCount: number; totalRows: number; errors: HistoricalError[] }
const root = '/import/historical-students'
const fileForm = (file: File) => { const body = new FormData(); body.append('file', file); return body }
export async function analyzeHistoricalStudents(file: File) {
  return (await api.post<HistoricalAnalysis>(`${root}/analyze`, fileForm(file))).data
}
export async function saveHistoricalMapping(fields: HistoricalMappingField[]) {
  return (await api.put(`${root}/profile`, { fields })).data
}
export async function confirmHistoricalStudents(file: File) {
  return (await api.post<HistoricalResult>(`${root}/confirm`, fileForm(file))).data
}
export async function downloadHistoricalTemplate() {
  const response = await api.get<Blob>(`${root}/template`, { responseType: 'blob' })
  triggerBlobDownload(response.data, 'profils-historiques.xlsx')
}
export function downloadHistoricalErrors(errors: HistoricalError[]) {
  const csv = ['Ligne;Champ;Erreur', ...errors.map((error) => [error.rowNumber, error.field, error.reason]
    .map((value) => `"${String(value).replace(/"/g, '""')}"`).join(';'))].join('\n')
  triggerBlobDownload(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }), 'erreurs-profils-historiques.csv')
}
