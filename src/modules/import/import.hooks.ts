import { useMutation, useQueryClient } from "@tanstack/react-query"

import {
  confirmImport,
  dryRun,
  type ImportMode,
  type ImportType
} from "@/modules/import-export/import-export.api"

export function useDryRun() {
  return useMutation({
    mutationFn: ({
      type,
      file,
      importMode,
      schedulePeriod,
    }: {
      type: ImportType
      file: File
      importMode?: ImportMode
      schedulePeriod?: { weekStart: string; weekEnd: string }
    }) => dryRun(type, file, { importMode, schedulePeriod })
  })
}

export function useConfirmImport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      type,
      file,
      importMode,
      schedulePeriod,
      conflictAcknowledged,
    }: {
      type: ImportType
      file: File
      importMode?: ImportMode
      schedulePeriod?: { weekStart: string; weekEnd: string }
      conflictAcknowledged?: boolean
    }) => confirmImport(type, file, { importMode, schedulePeriod, conflictAcknowledged }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["import-history"] })
    },
  })
}
