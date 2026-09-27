import { apiClient as api } from '@/shared/api/client'
import { triggerBlobDownload } from '@/shared/api/pdfExport.api'

export const HISTORICAL_TARGETS = [
  { key: 'matricule', label: 'Matricule', required: false },
  { key: 'nom', label: 'Nom', required: true },
  { key: 'prenom', label: 'Prénom', required: true },
  { key: 'historical_class', label: 'Ancienne classe', required: false },
  { key: 'birth_date', label: 'Date de naissance', required: false },
  { key: 'parent_name', label: 'Nom parent', required: false },
  { key: 'parent_phone', label: 'Téléphone parent', required: false },
  { key: 'parent_email', label: 'Email parent', required: false },
  { key: 'parent_name_2', label: 'Nom parent 2', required: false },
  { key: 'parent_phone_2', label: 'Téléphone parent 2', required: false },
] as const
export type HistoricalMappingField = {
  targetField: string; sourceColumnLabel: string; isRequired: boolean
  translations: Array<{ sourceValue: string; targetValue: string }>
}
export type HistoricalError = { rowNumber: number; field: string; reason: string; sheetName?: string }
export type HistoricalAnalysis = {
  schoolYearLabel: string; headers: string[]; rowCount: number; validCount: number; missingTargets: string[]; mappingSaved: boolean
  matchedFields: HistoricalMappingField[]; profile: { fields: HistoricalMappingField[] } | null
  sampleRows: Array<{ rowNumber: number; sheetName?: string; values: Record<string, string> }>; errors: HistoricalError[]
}
export type HistoricalResult = { schoolYearLabel: string; createdCount: number; reusedCount: number; totalRows: number; errors: HistoricalError[] }
const root = '/import/historical-students'
const fileForm = (file: File, schoolYearLabel: string) => { const body = new FormData(); body.append('schoolYearLabel', schoolYearLabel); body.append('file', file); return body }
export async function analyzeHistoricalStudents(file: File, schoolYearLabel: string) {
  return (await api.post<HistoricalAnalysis>(`${root}/analyze`, fileForm(file, schoolYearLabel))).data
}
export async function saveHistoricalMapping(fields: HistoricalMappingField[]) {
  return (await api.put(`${root}/profile`, { fields })).data
}
export async function confirmHistoricalStudents(file: File, schoolYearLabel: string) {
  return (await api.post<HistoricalResult>(`${root}/confirm`, fileForm(file, schoolYearLabel))).data
}
export async function downloadHistoricalTemplate() {
  const response = await api.get<Blob>(`${root}/template`, { responseType: 'blob' })
  triggerBlobDownload(response.data, 'students.xlsx')
}
export function downloadHistoricalErrors(errors: HistoricalError[]) {
  const csv = ['Feuille;Ligne;Champ;Erreur', ...errors.map((error) => [error.sheetName ?? '', error.rowNumber, error.field, error.reason]
    .map((value) => `"${String(value).replace(/"/g, '""')}"`).join(';'))].join('\n')
  triggerBlobDownload(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }), 'erreurs-profils-historiques.csv')
}
