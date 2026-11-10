/**
 * Mémorisation locale de l'aide, par école et par utilisateur.
 * Clé : ivoiredu-aide:<tenantId>:<userId>:<pageId>
 * Tout accès est protégé : le stockage peut être indisponible (navigation privée, quota).
 */
const PREFIX = "ivoiredu-aide"
const LEGACY_TOUR_PREFIX = "ivoiredu-tour-done-"

export type AideScope = { tenantId: string; userId: string }

export const aideKey = (scope: AideScope, pageId: string) => `${PREFIX}:${scope.tenantId}:${scope.userId}:${pageId}`
export const aidePrefsKey = (scope: AideScope) => aideKey(scope, "__prefs")

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* stockage indisponible : l'aide reste utilisable, la pastille réapparaîtra */
  }
}

function remove(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* rien à faire */
  }
}

/** L'aide de cette page a-t-elle déjà été ouverte ? Lit une fois l'ancienne clé de visite pour migration. */
export function wasAideOpened(scope: AideScope, pageId: string): boolean {
  const key = aideKey(scope, pageId)
  if (read(key) === "1") return true
  const legacyKey = `${LEGACY_TOUR_PREFIX}${pageId}`
  if (read(legacyKey) === "1") {
    write(key, "1")
    remove(legacyKey)
    return true
  }
  return false
}

export function markAideOpened(scope: AideScope, pageId: string) {
  write(aideKey(scope, pageId), "1")
}

export function readHideBadges(scope: AideScope): boolean {
  return read(aidePrefsKey(scope)) === "hide-badge"
}

export function writeHideBadges(scope: AideScope, hide: boolean) {
  if (hide) write(aidePrefsKey(scope), "hide-badge")
  else remove(aidePrefsKey(scope))
}
