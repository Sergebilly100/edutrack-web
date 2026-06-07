import { useCallback, useState } from "react"

export function useBulkSelection<T extends string>() {
  const [selectedIds, setSelectedIds] = useState<Set<T>>(new Set())

  const toggleSelection = useCallback((id: T) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const toggleAll = useCallback((allIds: T[]) => {
    setSelectedIds((prev) =>
      prev.size === allIds.length ? new Set() : new Set(allIds)
    )
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const isSelected = useCallback((id: T) => selectedIds.has(id), [selectedIds])

  const isAllSelected = useCallback(
    (allIds: T[]) => allIds.length > 0 && selectedIds.size === allIds.length,
    [selectedIds]
  )

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    toggleSelection,
    toggleAll,
    clearSelection,
    isSelected,
    isAllSelected,
  }
}
