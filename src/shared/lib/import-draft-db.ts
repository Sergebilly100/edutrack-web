import { del, get, set, createStore } from "idb-keyval"
import type { ImportMode, ImportType } from "@/modules/import-export/import-export.api"

export type WizardStep = 1 | 2 | 3

export type DryRunReport = {
  previewData: Array<Record<string, unknown>>
  issues: Array<{
    row: number
    column: string
    message: string
    severity: "error" | "warning"
  }>
  summary: {
    totalRows: number
    validRows: number
    errorRows: number
    warningRows: number
  }
}

export type ImportDraft = {
  id: string
  importType: ImportType
  step: WizardStep
  fileName: string
  fileData: ArrayBuffer
  fileSize: number
  fileMime: string
  dryRunReport: DryRunReport | null
  mode: ImportMode | null
  selectedColumns: string[] | null
  createdAt: number
  updatedAt: number
}

// Custom store pour les drafts d'import
const draftStore = createStore("ivoiredu-import-drafts", "drafts")

/**
 * Génère une clé unique pour un type d'import
 */
function getDraftKey(importType: ImportType): string {
  return `draft-${importType}`
}

/**
 * Sauvegarde un draft d'import dans IndexedDB
 */
export async function saveDraft(draft: ImportDraft): Promise<void> {
  try {
    const key = getDraftKey(draft.importType)
    await set(key, { ...draft, updatedAt: Date.now() }, draftStore)
  } catch (error) {
    console.error("Failed to save import draft:", error)
    throw new Error("Impossible de sauvegarder le brouillon d'import")
  }
}

/**
 * Charge le draft d'import pour un type donné
 */
export async function getDraftByType(importType: ImportType): Promise<ImportDraft | null> {
  try {
    const key = getDraftKey(importType)
    const draft = await get<ImportDraft>(key, draftStore)
    return draft ?? null
  } catch (error) {
    console.error("Failed to load import draft:", error)
    return null
  }
}

/**
 * Supprime un draft d'import
 */
export async function deleteDraft(importType: ImportType): Promise<void> {
  try {
    const key = getDraftKey(importType)
    await del(key, draftStore)
  } catch (error) {
    console.error("Failed to delete import draft:", error)
  }
}

/**
 * Vérifie si IndexedDB est supporté
 */
export function isIndexedDBSupported(): boolean {
  try {
    return typeof indexedDB !== "undefined"
  } catch {
    return false
  }
}
