import { useMutation } from "@tanstack/react-query"

import {
  confirmImport,
  dryRun,
  type ImportType
} from "@/modules/import-export/import-export.api"

export function useDryRun() {
  return useMutation({
    mutationFn: ({ type, file }: { type: ImportType; file: File }) => dryRun(type, file)
  })
}

export function useConfirmImport() {
  return useMutation({
    mutationFn: ({ type, file }: { type: ImportType; file: File }) => confirmImport(type, file)
  })
}
