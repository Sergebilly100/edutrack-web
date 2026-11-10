/**
 * Choix de la zone mise en valeur par une visite guidée.
 * Une zone trop haute (grand tableau, carte pleine page) sort de l'écran : on met alors en valeur
 * son en-tête (ligne d'en-tête du tableau, titre de la carte). Un élément masqué n'est jamais ciblé.
 */

/** Part de la hauteur de l'écran au-delà de laquelle une zone est jugée trop haute. */
export const TALL_RATIO = 0.3
/** Même seuil, abaissé quand la zone contient un tableau : on préfère son en-tête. */
export const TALL_TABLE_RATIO = 0.3

/** Vrai pour une liste d'éléments semblables (cartes, lignes) : un exemple suffit à la montrer. */
function isRepeatedList(element: Element): boolean {
  const items = Array.from(element.children).filter(isRendered)
  if (items.length < 2) return false
  const first = items[0]
  return items.every((item) => item.tagName === first.tagName && item.className === first.className)
}

/** Éléments qui servent d'en-tête, du plus précis au plus général. */
const HEADER_SELECTORS = ["thead", "caption", "legend", "h2", "h3", "[role='tablist']", ".tracking-tight"]

/** Vrai pour un contenu réservé aux lecteurs d'écran (classe sr-only, ou boîte de moins de 2 px). */
export function isScreenReaderOnly(element: Element): boolean {
  if (element.closest(".sr-only") !== null) return true
  // Sans mise en page (tests), toutes les boîtes mesurent 0 : on ne conclut que dans un vrai navigateur.
  const hasLayout = element.ownerDocument.documentElement.getBoundingClientRect().width > 0
  if (!hasLayout) return false
  const box = element.getBoundingClientRect()
  // Une boîte sans largeur ou sans hauteur n'a rien à montrer (conteneur vide, contenu masqué).
  return box.width < 2 || box.height < 2
}

/** Faux si l'élément est masqué : display:none sur lui ou un parent (tableau caché sur téléphone), ou réservé aux lecteurs d'écran. */
export function isRendered(element: Element): boolean {
  if (isScreenReaderOnly(element)) return false
  const check = (element as Element & { checkVisibility?: () => boolean }).checkVisibility
  return typeof check === "function" ? check.call(element) : true
}

function firstRendered(root: Element, selector: string): Element | null {
  if (root.matches(selector) && isRendered(root)) return root
  for (const candidate of Array.from(root.querySelectorAll(selector))) {
    if (isRendered(candidate)) return candidate
  }
  return null
}

/** Élément réellement mis en valeur pour un sélecteur de visite, ou null s'il est absent ou masqué. */
export function resolveTourAnchor(selector: string, doc: Document = document, viewportHeight: number = window.innerHeight): HTMLElement | null {
  let element: Element | null
  try {
    element = doc.querySelector(selector)
  } catch {
    return null
  }
  if (!element || !isRendered(element)) return null

  const height = element.getBoundingClientRect().height
  const hasTable = element.matches("table") || Array.from(element.querySelectorAll("table")).some(isRendered)
  const tooTall = height > viewportHeight * TALL_RATIO || (hasTable && height > viewportHeight * TALL_TABLE_RATIO)
  if (!tooTall) return element as HTMLElement

  // Une liste de cartes ou de lignes identiques : la première sert d'exemple, plutôt qu'un titre isolé.
  if (!hasTable && isRepeatedList(element)) {
    const first = Array.from(element.children).find(isRendered)
    if (first) return first as HTMLElement
  }

  for (const headerSelector of HEADER_SELECTORS) {
    const header = firstRendered(element, headerSelector)
    if (header && header !== element) return header as HTMLElement
  }
  // Sans en-tête : le premier enfant visible sert d'exemple (première ligne d'une liste, par exemple).
  for (const child of Array.from(element.children)) {
    if (isRendered(child) && child.getBoundingClientRect().height <= viewportHeight * TALL_RATIO) return child as HTMLElement
  }
  return element as HTMLElement
}

/** Bas de la zone figée en haut de l'écran (barre mobile, en-tête collant du tableau de bord). */
export function stickyTopOffset(doc: Document = document, win: Window = window): number {
  let bottom = 0
  for (const element of Array.from(doc.querySelectorAll("header, nav, [class*='sticky'], [data-sticky]"))) {
    const style = win.getComputedStyle(element)
    if (style.position !== "sticky" && style.position !== "fixed") continue
    const rect = element.getBoundingClientRect()
    const atTop = rect.top <= 1 && rect.bottom > 0
    const isBar = rect.height > 0 && rect.height < 260 && rect.width >= win.innerWidth * 0.4
    if (atTop && isBar) bottom = Math.max(bottom, rect.bottom)
  }
  return Math.ceil(bottom) + 16
}

/** Hauteur de la barre figée en bas de l'écran (menu du portail parent, barre d'actions), 0 s'il n'y en a pas. */
export function fixedBottomInset(doc: Document = document, win: Window = window): number {
  let inset = 0
  for (const element of Array.from(doc.querySelectorAll("nav, footer, [class*='fixed'], [class*='sticky'], [data-sticky]"))) {
    const style = win.getComputedStyle(element)
    if (style.position !== "fixed" && style.position !== "sticky") continue
    const rect = element.getBoundingClientRect()
    const atBottom = rect.bottom >= win.innerHeight - 1 && rect.top > win.innerHeight * 0.5
    const isBar = rect.height > 0 && rect.height < 200 && rect.width >= win.innerWidth * 0.4
    if (atBottom && isBar) inset = Math.max(inset, win.innerHeight - rect.top)
  }
  return Math.ceil(inset)
}
