export const FILTER_HELP = {
  year: "Choisissez une année précise.",
  level: "Choisissez d'abord un niveau.",
  class: "Choisissez d'abord une classe.",
  subject: "Choisissez d'abord une matière.",
  teacher: "Choisissez d'abord un professeur.",
  unavailable: "Aucune option disponible pour ce filtre.",
  loading: "Chargement des options…",
} as const

export type FilterDependency = Exclude<keyof typeof FILTER_HELP, "unavailable" | "loading">
