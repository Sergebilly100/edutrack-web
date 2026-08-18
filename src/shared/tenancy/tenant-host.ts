const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"])
const RESERVED_TENANT_LABELS = new Set(["www", "admin"])
const SUBDOMAIN_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const splitList = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)

const normalizeHostname = (hostname: string): string =>
  hostname.trim().toLowerCase().replace(/\.$/, "")

const isReservedOrInvalid = (subdomain: string): boolean =>
  !SUBDOMAIN_REGEX.test(subdomain) || RESERVED_TENANT_LABELS.has(subdomain)

export type TenantHostMapping = {
  hostname: string
  target: string
  targetType: "schema" | "subdomain"
}

const parseHostMappings = (value: string | undefined): TenantHostMapping[] =>
  splitList(value)
    .map((entry) => {
      const separatorIndex = entry.indexOf(":")
      if (separatorIndex < 1) {
        return null
      }

      const hostname = normalizeHostname(entry.slice(0, separatorIndex))
      const rawTarget = entry.slice(separatorIndex + 1).trim().toLowerCase()
      const [prefix, prefixedTarget] = rawTarget.includes(":")
        ? (rawTarget.split(":", 2) as [string, string])
        : ["", rawTarget]
      const target = prefixedTarget.trim()
      if (!hostname || !target) {
        return null
      }

      const targetType = prefix === "schema" || target.includes("_") ? "schema" : "subdomain"
      return { hostname, target, targetType }
    })
    .filter((mapping): mapping is TenantHostMapping => mapping !== null)

export type TenantHostConfig = {
  baseDomains: string[]
  environmentPrefixes: string[]
  hostMappings: TenantHostMapping[]
}

export type TenantHostResolution = {
  value: string
  type: "schema" | "subdomain"
}

export const resolveTenantFromHostname = (
  hostname: string,
  config: TenantHostConfig = {
    baseDomains: splitList(import.meta.env.VITE_TENANT_BASE_DOMAINS),
    environmentPrefixes: splitList(import.meta.env.VITE_TENANT_ENV_PREFIXES ?? "dev,staging,preprod"),
    hostMappings: parseHostMappings(import.meta.env.VITE_TENANT_HOST_MAPPINGS),
  }
): TenantHostResolution | undefined => {
  const normalizedHostname = normalizeHostname(hostname)
  if (LOCAL_HOSTS.has(normalizedHostname)) {
    return undefined
  }

  const mappedTenant = config.hostMappings.find((mapping) => mapping.hostname === normalizedHostname)
  if (mappedTenant) {
    return { value: mappedTenant.target, type: mappedTenant.targetType }
  }

  const labels = normalizedHostname.split(".").filter(Boolean)
  if (labels.length < 3) {
    return undefined
  }

  const matchedBaseDomain = config.baseDomains
    .map(normalizeHostname)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .find((baseDomain) => normalizedHostname === baseDomain || normalizedHostname.endsWith(`.${baseDomain}`))

  if (matchedBaseDomain) {
    const baseLabelCount = matchedBaseDomain.split(".").filter(Boolean).length
    const tenantLabels = labels.slice(0, labels.length - baseLabelCount)
    const effectiveLabels =
      tenantLabels.length > 1 && config.environmentPrefixes.includes(tenantLabels[0] ?? "")
        ? tenantLabels.slice(1)
        : tenantLabels
    const candidate = effectiveLabels[0] ?? ""
    return candidate && !isReservedOrInvalid(candidate)
      ? { value: candidate, type: "subdomain" }
      : undefined
  }

  const firstLabel = labels[0] ?? ""
  return firstLabel && !isReservedOrInvalid(firstLabel)
    ? { value: firstLabel, type: "subdomain" }
    : undefined
}

export const resolveTenantSubdomainFromHostname = (
  hostname: string,
  config?: TenantHostConfig
): string | undefined => {
  const resolution = resolveTenantFromHostname(hostname, config)
  return resolution?.type === "subdomain" ? resolution.value : undefined
}

const getDefaultTenantSchema = (): string =>
  import.meta.env.VITE_DEFAULT_TENANT_SCHEMA ??
  import.meta.env.VITE_E2E_SCHEMA_NAME ??
  "school_sainte_marie"

const isTruthyEnv = (value: string | undefined): boolean => {
  const normalized = (value ?? "").trim().toLowerCase()
  return normalized === "true" || normalized === "1" || normalized === "yes"
}

export const buildTenantContextHeaders = (
  hostname = typeof window !== "undefined" ? window.location.hostname : ""
): Record<string, string> | undefined => {
  const explicitSubdomain = import.meta.env.VITE_TENANT_SUBDOMAIN?.trim().toLowerCase()
  if (explicitSubdomain) {
    if (!SUBDOMAIN_REGEX.test(explicitSubdomain)) {
      return undefined
    }
    return { "x-tenant-subdomain": explicitSubdomain }
  }

  const normalizedHostname = normalizeHostname(hostname)
  const isLocalhost = LOCAL_HOSTS.has(normalizedHostname)
  const fallbackSchema = getDefaultTenantSchema()

  if (isLocalhost || isTruthyEnv(import.meta.env.VITE_FORCE_TENANT_SCHEMA)) {
    return { "x-tenant-schema": fallbackSchema }
  }

  const tenant = resolveTenantFromHostname(normalizedHostname)
  if (tenant?.type === "schema") {
    return { "x-tenant-schema": tenant.value }
  }
  return tenant?.type === "subdomain" ? { "x-tenant-subdomain": tenant.value } : undefined
}
