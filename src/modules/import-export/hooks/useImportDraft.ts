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

function isValidDraft(draft: ImportDraft | null, importType: ImportType): draft is ImportDraft {
  if (!draft) return false
  if (draft.importType !== importType) return false
  if (![1, 2, 3].includes(draft.step)) return false
  if (!draft.fileName.trim()) return false
  if (draft.fileSize <= 0) return false
  if (!draft.fileData || draft.fileData.byteLength === 0) return false
  if (!Number.isFinite(draft.createdAt) || draft.createdAt <= 0) return false
  if (!Number.isFinite(draft.updatedAt) || draft.updatedAt <= 0) return false
  return true
}

/**
 * Hook pour gérer la persistance des drafts d'import dans IndexedDB
 * Permet de reprendre un import interrompu
 */
export function useImportDraft(importType: ImportType): UseImportDraftReturn {
  const [draft, setDraft] = useState<ImportDraft | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const isSupported = isIndexedDBSupported()
  const currentDraft = draft?.importType === importType ? draft : null

  // Charger le draft au mount
  useEffect(() => {
    let isMounted = true

    async function loadDraft() {
      if (!isSupported) {
        if (isMounted) {
          setDraft(null)
          setIsLoading(false)
        }
        return
      }

      setDraft(null)
      setIsLoading(true)
      try {
        const existing = await getDraftByType(importType)
        if (!isMounted) return
        if (!isValidDraft(existing, importType)) {
          if (existing) {
            await deleteDraftDB(importType)
          }
          setDraft(null)
          return
        }
        setDraft(existing)
      } catch (error) {
        console.error("Error loading import draft:", error)
        if (isMounted) {
          setDraft(null)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadDraft()

    return () => {
      isMounted = false
    }
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
        id: currentDraft?.id ?? generateId(),
        importType,
        step: data.step ?? currentDraft?.step ?? 1,
        fileName: data.fileName ?? currentDraft?.fileName ?? "",
        fileData: data.fileData ?? currentDraft?.fileData ?? new ArrayBuffer(0),
        fileSize: data.fileSize ?? currentDraft?.fileSize ?? 0,
        fileMime: data.fileMime ?? currentDraft?.fileMime ?? "",
        dryRunReport: data.dryRunReport ?? currentDraft?.dryRunReport ?? null,
        dryRunResponse: data.dryRunResponse ?? currentDraft?.dryRunResponse ?? null,
        mode: data.mode ?? currentDraft?.mode ?? null,
        selectedColumns: data.selectedColumns ?? currentDraft?.selectedColumns ?? null,
        schedulePeriod: data.schedulePeriod ?? currentDraft?.schedulePeriod ?? null,
        createdAt: currentDraft?.createdAt ?? now,
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
    [currentDraft, importType, isSupported]
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
    draft: currentDraft,
    isLoading,
    hasDraft: currentDraft !== null,
    saveDraft,
    deleteDraft,
    isSupported,
  }
}
