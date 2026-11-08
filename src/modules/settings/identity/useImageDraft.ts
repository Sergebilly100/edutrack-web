import { useCallback, useEffect, useRef, useState } from "react"
import { useMutation } from "@tanstack/react-query"

import { previewSchoolImage, type SchoolImageKind } from "../settings.api"
import { extractApiErrorMessage, precheckImageFile, readImageDimensions } from "./school-image.utils"

export type ImageDraft = {
  file: File
  removeWhite: boolean
  previewUrl: string | null
  dimensions: { width: number; height: number } | null
}

/**
 * Brouillon d'import : le fichier est validé et traité par le serveur (aperçu) mais RIEN n'est
 * enregistré tant que l'utilisateur n'a pas confirmé. Les réponses d'aperçu obsolètes sont ignorées.
 */
export function useImageDraft(kind: SchoolImageKind) {
  const [draft, setDraft] = useState<ImageDraft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)
  const currentUrl = useRef<string | null>(null)

  const previewMutation = useMutation({
    mutationFn: (input: { file: File; removeWhite: boolean }) => previewSchoolImage(kind, input.file, input.removeWhite),
  })

  const replaceUrl = (next: string | null) => {
    if (currentUrl.current) URL.revokeObjectURL(currentUrl.current)
    currentUrl.current = next
  }

  useEffect(() => () => replaceUrl(null), [])

  const runPreview = async (file: File, removeWhite: boolean) => {
    const id = ++requestId.current
    try {
      const blob = await previewMutation.mutateAsync({ file, removeWhite })
      if (id !== requestId.current) return null
      const url = URL.createObjectURL(blob)
      replaceUrl(url)
      return url
    } catch (caught) {
      if (id === requestId.current) setError(await extractApiErrorMessage(caught))
      return null
    }
  }

  const selectFile = async (file: File) => {
    setError(null)
    const problem = precheckImageFile(file)
    if (problem) {
      setError(problem)
      return
    }
    // Un JPEG ne peut pas être transparent : c'est presque toujours un scan sur fond blanc.
    const removeWhite = kind === "seal" && file.type === "image/jpeg"
    const [previewUrl, dimensions] = await Promise.all([runPreview(file, removeWhite), readImageDimensions(file)])
    if (previewUrl) setDraft({ file, removeWhite, previewUrl, dimensions })
  }

  const setRemoveWhite = async (removeWhite: boolean) => {
    if (!draft) return
    setError(null)
    const previewUrl = await runPreview(draft.file, removeWhite)
    if (previewUrl) setDraft((current) => (current ? { ...current, removeWhite, previewUrl } : current))
  }

  const cancel = useCallback(() => {
    requestId.current += 1
    replaceUrl(null)
    setDraft(null)
    setError(null)
  }, [])

  return {
    draft,
    error,
    setError,
    isPreviewing: previewMutation.isPending,
    selectFile,
    setRemoveWhite,
    cancel,
  }
}
