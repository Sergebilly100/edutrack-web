import { useQuery } from "@tanstack/react-query"

import { apiClient } from "@/shared/api/client"

/** Réglage de l'école (`can_export_data`) : l'export est autorisé sauf s'il vaut explicitement false. */
export function useCanExportData(): boolean {
  const query = useQuery({
    queryKey: ["school", "can-export-data"],
    queryFn: async () => (await apiClient.get<{ can_export_data?: boolean | null }>("/school/info")).data.can_export_data !== false,
    staleTime: 1000 * 60 * 10,
  })
  return query.data ?? true
}
