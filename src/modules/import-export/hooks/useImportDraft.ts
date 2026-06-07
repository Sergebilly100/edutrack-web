import { useCallback, useEffect, useState } from "react"
import {
  deleteDraft as deleteDraftDB,
  getDraftByType,
  isIndexedDBSupported,
  saveDraft as saveDraftDB,
  type ImportDraft,
} from "@/shared/lib/import-draft-db"
import type { ImportType } from "../import-export.api"

function generateId(): string {
  return crypto.randomUUID()
}

type UseImportDraftReturn = {
  draft: ImportDraft | null
  isLoading: boolean
  hasDraft: boolean
  saveDraft: (data: Partial<Omit<ImportDraft, "id" | "createdAt" | "updatedAt">>) => Promise<void>
  deleteDraft: () => Promise<void>
  isSupported: boolean
}

/**
 * Hook pour gérer la persistance des drafts d'import dans IndexedDB
 * Permet de reprendre un import interrompu
 */
export function useImportDraft(importType: ImportType): UseImportDraftReturn {
  const [draft, setDraft] = useState<ImportDraft | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const isSupported = isIndexedDBSupported()

  // Charger le draft au mount
  useEffect(() => {
    async function loadDraft() {
      if (!isSupported) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const existing = await getDraftByType(importType)
        setDraft(existing)
      } catch (error) {
        console.error("Error loading import draft:", error)
        setDraft(null)
      } finally {
        setIsLoading(false)
      }
    }

    void loadDraft()
  }, [importType, isSupported])

  /**
   * Sauvegarde ou met à jour le draft
   */
  const saveDraft = useCallback(
    async (data: Partial<Omit<ImportDraft, "id" | "createdAt" | "updatedAt">>) => {
      if (!isSupported) {
        console.warn("IndexedDB not supported, draft will not be saved")
        return
      }

      const now = Date.now()
      const updated: ImportDraft = {
        id: draft?.id ?? generateId(),
        importType,
        step: data.step ?? draft?.step ?? 1,
        fileName: data.fileName ?? draft?.fileName ?? "",
        fileData: data.fileData ?? draft?.fileData ?? new ArrayBuffer(0),
        fileSize: data.fileSize ?? draft?.fileSize ?? 0,
        fileMime: data.fileMime ?? draft?.fileMime ?? "",
        dryRunReport: data.dryRunReport ?? draft?.dryRunReport ?? null,
        mode: data.mode ?? draft?.mode ?? null,
        selectedColumns: data.selectedColumns ?? draft?.selectedColumns ?? null,
        createdAt: draft?.createdAt ?? now,
        updatedAt: now,
      }

      try {
        await saveDraftDB(updated)
        setDraft(updated)
      } catch (error) {
        console.error("Error saving import draft:", error)
        throw error
      }
    },
    [draft, importType, isSupported]
  )

  /**
   * Supprime le draft
   */
  const deleteDraft = useCallback(async () => {
    if (!isSupported) return

    try {
      await deleteDraftDB(importType)
      setDraft(null)
    } catch (error) {
      console.error("Error deleting import draft:", error)
    }
  }, [importType, isSupported])

  return {
    draft,
    isLoading,
    hasDraft: draft !== null,
    saveDraft,
    deleteDraft,
    isSupported,
  }
}
