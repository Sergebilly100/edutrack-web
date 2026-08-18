import { describe, expect, it } from "vitest"

import {
  buildTenantContextHeaders,
  resolveDefaultTenantSchema,
  resolveTenantSubdomainFromHostname,
} from "@/shared/lib/tenant-context"

describe("tenant-context", () => {
  it("résout le sous-domaine tenant sur le domaine wildcard configuré", () => {
    expect(
      resolveTenantSubdomainFromHostname("sainte-marie.ivoiredu.ci", {
        tenantBaseDomains: "ivoiredu.ci",
      })
    ).toBe("sainte-marie")
  })

  it("ignore le domaine principal et les sous-domaines réservés", () => {
    const env = { tenantBaseDomains: "ivoiredu.ci" }
    expect(resolveTenantSubdomainFromHostname("ivoiredu.ci", env)).toBeUndefined()
    expect(resolveTenantSubdomainFromHostname("www.ivoiredu.ci", env)).toBeUndefined()
    expect(resolveTenantSubdomainFromHostname("admin.ivoiredu.ci", env)).toBeUndefined()
  })

  it("n'extrait pas le premier label d'un domaine non configuré", () => {
    expect(resolveTenantSubdomainFromHostname("dev.ivoiredu.novatrixsys.com")).toBeUndefined()
  })

  it("peut utiliser un domaine racine alternatif quand il est configuré", () => {
    expect(
      resolveTenantSubdomainFromHostname("sainte-marie.novatrixsys.com", {
        tenantBaseDomains: "novatrixsys.com",
      })
    ).toBe("sainte-marie")
  })

  it("refuse les préfixes multi-label comme sous-domaine tenant", () => {
    expect(
      resolveTenantSubdomainFromHostname("dev.ivoiredu.novatrixsys.com", {
        tenantBaseDomains: "novatrixsys.com",
      })
    ).toBeUndefined()
  })

  it("résout un schéma par défaut valide", () => {
    expect(resolveDefaultTenantSchema({ defaultTenantSchema: "school_sainte_marie" })).toBe("school_sainte_marie")
    expect(resolveDefaultTenantSchema({ defaultTenantSchema: "dev.ivoiredu" })).toBeUndefined()
  })

  it("priorise le sous-domaine tenant sur le schéma par défaut", () => {
    expect(
      buildTenantContextHeaders("sainte-marie.ivoiredu.ci", {
        defaultTenantSchema: "school_default",
      })
    ).toEqual({ "x-tenant-subdomain": "sainte-marie" })
  })

  it("utilise le schéma par défaut sur un domaine preview sans sous-domaine tenant valide", () => {
    expect(
      buildTenantContextHeaders("dev.ivoiredu.novatrixsys.com", {
        defaultTenantSchema: "school_sainte_marie",
      })
    ).toEqual({ "x-tenant-schema": "school_sainte_marie" })
  })

  it("peut forcer le schéma même sur un hostname wildcard valide", () => {
    expect(
      buildTenantContextHeaders("sainte-marie.ivoiredu.ci", {
        defaultTenantSchema: "school_sainte_marie",
        forceTenantSchema: "true",
      })
    ).toEqual({ "x-tenant-schema": "school_sainte_marie" })
  })
})
