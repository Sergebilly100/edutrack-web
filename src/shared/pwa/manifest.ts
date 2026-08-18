export type PwaInstallAudience = "user" | "parent"

const MANIFEST_BY_AUDIENCE: Record<PwaInstallAudience, string> = {
  user: "/manifest-teacher.webmanifest",
  parent: "/manifest-parent.webmanifest",
}

export const getPwaManifestHref = (audience: PwaInstallAudience): string =>
  MANIFEST_BY_AUDIENCE[audience]

const getManifestLink = (): HTMLLinkElement => {
  const existing = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
  if (existing) return existing

  const link = document.createElement("link")
  link.rel = "manifest"
  document.head.appendChild(link)
  return link
}

export const setPwaManifest = (audience: PwaInstallAudience): void => {
  if (typeof document === "undefined") return
  const link = getManifestLink()
  const href = getPwaManifestHref(audience)
  if (link.getAttribute("href") !== href) {
    link.setAttribute("href", href)
  }
  link.dataset.pwaAudience = audience
}
