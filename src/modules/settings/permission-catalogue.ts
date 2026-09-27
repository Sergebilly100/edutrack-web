import { useQuery } from "@tanstack/react-query"
import { fetchPermissionCatalogue, type CataloguePermission } from "./settings.api"

export const usePermissionCatalogue = (enabled = true) => useQuery({
  queryKey: ["settings", "permission-catalogue"],
  queryFn: fetchPermissionCatalogue,
  enabled,
  retry: false,
  staleTime: 30_000,
})

export const isPermissionRequired = (
  key: string, selected: readonly string[], catalogue: readonly CataloguePermission[],
) => catalogue.some((entry) => selected.includes(entry.key) && entry.requiredPermissions.includes(key))

// Modifier seulement les droits touchés explicitement. Les attributions
// historiques inconnues/inactives restent conservées jusqu’à un retrait explicite.
export const changePermissions = (
  selected: readonly string[], entries: readonly CataloguePermission[], checked: boolean,
  catalogue: readonly CataloguePermission[],
) => {
  const next = new Set(selected)
  const editable = entries.filter((entry) => entry.available)
  if (checked) {
    for (const entry of editable) {
      next.add(entry.key)
      for (const required of entry.requiredPermissions) next.add(required)
    }
  } else {
    for (const entry of editable) next.delete(entry.key)
    for (const entry of editable) {
      if (isPermissionRequired(entry.key, [...next], catalogue)) next.add(entry.key)
    }
  }
  return [...next].sort()
}
