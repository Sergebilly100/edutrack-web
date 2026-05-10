export const PHONE_CI_REGEX = /^225\d{10}$/

export const normalizePhoneInput = (value: string) => value.replace(/\D/g, "").slice(0, 13)

export const isValidOptionalPhone = (value: string) => {
  const clean = value.trim()
  return clean.length === 0 || PHONE_CI_REGEX.test(clean)
}
