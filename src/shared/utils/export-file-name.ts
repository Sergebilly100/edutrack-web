/** `eleves-2025-2026-2026-11-08.xlsx` : même convention que l'API (ASCII, sans accent ni espace). */
export function exportFileName(prefix: string, yearLabel: string | null | undefined, today: Date = new Date()): string {
  const slug = (yearLabel ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  const date = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-")
  return `${[prefix, slug, date].filter(Boolean).join("-")}.xlsx`
}
