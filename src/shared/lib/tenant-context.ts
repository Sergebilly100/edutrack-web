const SUBDOMAIN_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SCHEMA_NAME_REGEX = /^[a-z][a-z0-9_]{2,63}$/
const RESERVED_SUBDOMAINS = new Set(["www", "admin"])

type TenantContextEnv = {
  defaultTenantSchema?: string
  e2eSchemaName?: string
  tenantBaseDomains?: string
  tenantSubdomain?: string
  forceTenantSchema?: string
}

const cleanEnvValue = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : undefined
}

const parseBooleanEnv = (value: string | undefined): boolean => {
  const normalized = value?.trim().toLowerCase()
  return normalized === "true" || normalized === "1" || normalized === "yes"
}

const readTenantEnv = (): TenantContextEnv => ({
  defaultTenantSchema: cleanEnvValue(import.meta.env.VITE_DEFAULT_TENANT_SCHEMA),
  e2eSchemaName: cleanEnvValue(import.meta.env.VITE_E2E_SCHEMA_NAME),
  tenantBaseDomains: cleanEnvValue(import.meta.env.VITE_TENANT_BASE_DOMAINS),
  tenantSubdomain: cleanEnvValue(import.meta.env.VITE_TENANT_SUBDOMAIN),
  forceTenantSchema: cleanEnvValue(import.meta.env.VITE_FORCE_TENANT_SCHEMA),
})

const isLocalHost = (hostname: string): boolean =>
  hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"

const parseBaseDomains = (value: string | undefined): string[] => {
  const configured = cleanEnvValue(value) ?? "ivoiredu.ci"
  return configured
    .split(",")
    .map((domain) => domain.trim().toLowerCase().replace(/^\.+|\.+$/g, ""))
    .filter(Boolean)
}

const isValidTenantSubdomain = (value: string): boolean =>
  SUBDOMAIN_REGEX.test(value) && !RESERVED_SUBDOMAINS.has(value)

export const resolveTenantSubdomainFromHostname = (
  hostname: string,
  env: TenantContextEnv = readTenantEnv()
): string | undefined => {
  const normalizedHostname = hostname.trim().toLowerCase()
  if (!normalizedHostname || isLocalHost(normalizedHostname)) {
    return undefined
  }

  const forcedSubdomain = cleanEnvValue(env.tenantSubdomain)?.toLowerCase()
  if (forcedSubdomain && isValidTenantSubdomain(forcedSubdomain)) {
    return forcedSubdomain
  }

  for (const baseDomain of parseBaseDomains(env.tenantBaseDomains)) {
    if (normalizedHostname === baseDomain || normalizedHostname === `www.${baseDomain}`) {
      return undefined
    }

    const suffix = `.${baseDomain}`
    if (!normalizedHostname.endsWith(suffix)) {
      continue
    }

    const tenantPart = normalizedHostname.slice(0, -suffix.length)
    return isValidTenantSubdomain(tenantPart) ? tenantPart : undefined
  }

  return undefined
}

export const resolveDefaultTenantSchema = (
  env: TenantContextEnv = readTenantEnv()
): string | undefined => {
  const schema = cleanEnvValue(env.defaultTenantSchema) ?? cleanEnvValue(env.e2eSchemaName)
  return schema && SCHEMA_NAME_REGEX.test(schema) ? schema : undefined
}

export const buildTenantContextHeaders = (
  hostname = typeof window !== "undefined" ? window.location.hostname : "",
  env: TenantContextEnv = readTenantEnv()
): Record<string, string> | undefined => {
  const fallbackSchema = resolveDefaultTenantSchema(env)

  if (parseBooleanEnv(env.forceTenantSchema) && fallbackSchema) {
    return { "x-tenant-schema": fallbackSchema }
  }

  const tenantSubdomain = resolveTenantSubdomainFromHostname(hostname, env)
  if (tenantSubdomain) {
    return { "x-tenant-subdomain": tenantSubdomain }
  }

  if (fallbackSchema) {
    return { "x-tenant-schema": fallbackSchema }
  }

  return undefined
}
