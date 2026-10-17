export const formatFcfa = (value: number): string =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)} FCFA`

export const formatFcfaBalance = (value: number): string =>
  value < 0 ? `Avance de ${formatFcfa(Math.abs(value))}` : formatFcfa(value)

export const formatRate = (rate: number): string => `${Math.round(rate)}%`
