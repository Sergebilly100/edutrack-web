import { getCountryName, getDemonym } from "@/shared/lib/nationality"

export type Sex = "M" | "F"

/** État de formulaire (chaînes) pour les champs d'identité. "" = non renseigné. */
export type IdentityFormValues = {
  sex: "" | Sex
  nationality: string
  birthPlace: string
}

export const EMPTY_IDENTITY: IdentityFormValues = { sex: "", nationality: "", birthPlace: "" }

export const SEX_LABELS: Record<Sex, string> = { M: "Masculin", F: "Féminin" }

export const BIRTH_PLACE_MIN = 2
export const BIRTH_PLACE_MAX = 120

export const cleanBirthPlace = (value: string): string => value.replace(/\s+/g, " ").trim()

export const birthPlaceError = (value: string): string | null => {
  const cleaned = cleanBirthPlace(value)
  if (!cleaned) return null
  if (cleaned.length < BIRTH_PLACE_MIN) return `Le lieu de naissance doit contenir au moins ${BIRTH_PLACE_MIN} caractères.`
  if (cleaned.length > BIRTH_PLACE_MAX) return `Le lieu de naissance ne doit pas dépasser ${BIRTH_PLACE_MAX} caractères.`
  return null
}

/** Valeurs API (null = non renseigné) depuis l'état de formulaire. */
export const identityToPayload = (values: IdentityFormValues) => ({
  sex: values.sex || null,
  nationality: values.nationality || null,
  birthPlace: cleanBirthPlace(values.birthPlace) || null,
})

export const identityFromRecord = (record: {
  sex?: Sex | null
  nationality?: string | null
  birthPlace?: string | null
}): IdentityFormValues => ({
  sex: record.sex ?? "",
  nationality: record.nationality ?? "",
  birthPlace: record.birthPlace ?? "",
})

/** Gentilé selon le sexe si connu, sinon nom du pays (jamais de genre deviné). */
export const formatNationality = (code: string | null | undefined, sex?: Sex | null): string | null => {
  if (!code) return null
  return sex ? getDemonym(code, sex) : getCountryName(code)
}
