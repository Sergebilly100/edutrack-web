/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_DEFAULT_TENANT_SCHEMA?: string
  readonly VITE_E2E_SCHEMA_NAME?: string
  readonly VITE_FORCE_TENANT_SCHEMA?: string
  readonly VITE_PUBLIC_SITE_HOSTS?: string
  readonly VITE_TENANT_BASE_DOMAINS?: string
  readonly VITE_TENANT_ENV_PREFIXES?: string
  readonly VITE_TENANT_HOST_MAPPINGS?: string
  readonly VITE_TENANT_SUBDOMAIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
