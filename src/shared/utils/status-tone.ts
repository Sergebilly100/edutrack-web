/**
 * Tons sémantiques partagés pour les badges/encarts de statut du tableau de bord.
 *
 * Centralise les classes Tailwind (fond + texte + bordure, clair ET sombre) afin
 * d'éviter la duplication des chaînes `bg-amber-50 text-amber-900 dark:...`
 * dispersées dans les pages. Les couleurs suivent la sémantique des tokens
 * present (vert) / late (ambre) / absent (rouge) définis dans DESIGN.md.
 *
 * Note : les tokens Tailwind `present/late/absent` n'ont pas (encore) de variante
 * dark mode ni de couleur de texte accessible dédiée ; on s'appuie donc sur les
 * échelles `emerald/amber/red` qui en sont l'équivalent et fournissent le dark mode.
 */
export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral"

/** Classes pour un badge/encart « rempli léger » (fond clair + texte foncé + bordure). */
export const statusToneBadge: Record<StatusTone, string> = {
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200",
  warning:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100",
  danger:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200",
  info: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-200",
  neutral:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
}

/** Couleur de texte seule, pour les valeurs chiffrées (taux, montants). */
export const statusToneText: Record<StatusTone, string> = {
  success: "text-emerald-600 dark:text-emerald-300",
  warning: "text-amber-600 dark:text-amber-300",
  danger: "text-red-600 dark:text-red-300",
  info: "text-sky-600 dark:text-sky-300",
  neutral: "text-muted-foreground",
}

/** Fond léger pour un conteneur d'icône (pastille de KPI). */
export const statusToneIconBg: Record<StatusTone, string> = {
  success: "bg-emerald-50 dark:bg-emerald-950/40",
  warning: "bg-amber-50 dark:bg-amber-950/40",
  danger: "bg-red-50 dark:bg-red-950/40",
  info: "bg-sky-50 dark:bg-sky-950/40",
  neutral: "bg-muted",
}

/**
 * Mappe un taux de présence (0–100) vers un ton : ≥85 succès, ≥60 avertissement,
 * sinon danger. Aligné sur les seuils existants du dashboard.
 */
export function attendanceTone(rate: number): StatusTone {
  if (rate >= 85) return "success"
  if (rate >= 60) return "warning"
  return "danger"
}
