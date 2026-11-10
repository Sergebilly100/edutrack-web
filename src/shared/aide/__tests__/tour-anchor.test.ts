import { afterEach, describe, expect, it } from "vitest"

import { fixedBottomInset, isRendered, resolveTourAnchor, stickyTopOffset } from "../tour-anchor"

function box(element: Element, height: number, extra: { top?: number; width?: number } = {}) {
  element.getBoundingClientRect = () =>
    ({ top: extra.top ?? 0, bottom: (extra.top ?? 0) + height, height, width: extra.width ?? 800, left: 0, right: extra.width ?? 800, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
}

afterEach(() => {
  document.body.innerHTML = ""
})

describe("zone mise en valeur par la visite", () => {
  it("garde une zone de taille raisonnable telle quelle", () => {
    document.body.innerHTML = `<div id="z" data-tour="a"><h2>Titre</h2></div>`
    box(document.getElementById("z")!, 200)
    expect(resolveTourAnchor("[data-tour='a']", document, 800)).toBe(document.getElementById("z"))
  })

  it("met en valeur l'en-tête du tableau quand la zone est trop haute", () => {
    document.body.innerHTML = `<div id="z" data-tour="t"><input/><table><thead id="h"><tr><th>Nom</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table></div>`
    box(document.getElementById("z")!, 900)
    expect(resolveTourAnchor("[data-tour='t']", document, 800)?.id).toBe("h")
  })

  it("préfère l'en-tête d'un tableau même moyennement haut", () => {
    document.body.innerHTML = `<div id="z" data-tour="t"><table><thead id="h"></thead></table></div>`
    box(document.getElementById("z")!, 300)
    expect(resolveTourAnchor("[data-tour='t']", document, 800)?.id).toBe("h")
  })

  it("met en valeur le titre d'une grande carte", () => {
    document.body.innerHTML = `<section id="z" data-tour="c"><div class="font-semibold tracking-tight" id="t">Titre</div><p>…</p></section>`
    box(document.getElementById("z")!, 1200)
    expect(resolveTourAnchor("[data-tour='c']", document, 800)?.id).toBe("t")
  })

  it("montre la première carte d'une liste de cartes identiques", () => {
    document.body.innerHTML = `<div id="z" data-tour="r"><div id="c1" class="card"><div class="font-semibold tracking-tight">14,11/20</div></div><div class="card"></div></div>`
    box(document.getElementById("z")!, 400)
    expect(resolveTourAnchor("[data-tour='r']", document, 800)?.id).toBe("c1")
  })

  it("retombe sur le premier enfant quand une grande zone n'a pas d'en-tête", () => {
    document.body.innerHTML = `<section id="z" data-tour="l"><div id="first"></div><div></div></section>`
    box(document.getElementById("z")!, 2000)
    box(document.getElementById("first")!, 120)
    expect(resolveTourAnchor("[data-tour='l']", document, 800)?.id).toBe("first")
  })

  it("ignore un élément masqué (tableau caché sur téléphone)", () => {
    document.body.innerHTML = `<div id="z" data-tour="m"></div>`
    ;(document.getElementById("z") as HTMLElement & { checkVisibility: () => boolean }).checkVisibility = () => false
    expect(isRendered(document.getElementById("z")!)).toBe(false)
    expect(resolveTourAnchor("[data-tour='m']", document, 800)).toBeNull()
  })

  it("ignore le tableau réservé aux lecteurs d'écran d'un graphique", () => {
    document.body.innerHTML = `<div id="z" data-tour="g"><div class="font-semibold tracking-tight" id="t">Montants</div><div class="sr-only"><table><caption>Texte</caption><thead id="h"></thead></table></div></div>`
    box(document.getElementById("z")!, 600)
    expect(resolveTourAnchor("[data-tour='g']", document, 800)?.id).toBe("t")
  })

  it("renvoie null pour une cible absente ou un sélecteur invalide", () => {
    expect(resolveTourAnchor("[data-tour='rien']", document, 800)).toBeNull()
    expect(resolveTourAnchor("[[", document, 800)).toBeNull()
  })
})

describe("zone figée en haut de l'écran", () => {
  it("laisse de la place sous un en-tête collant", () => {
    document.body.innerHTML = `<header id="h" style="position: sticky"></header>`
    const header = document.getElementById("h")!
    box(header, 96, { top: 0, width: 1200 })
    expect(stickyTopOffset(document, { ...window, innerWidth: 1200, getComputedStyle: window.getComputedStyle.bind(window) } as Window)).toBe(96 + 16)
  })

  it("ignore un en-tête qui n'est pas collant", () => {
    document.body.innerHTML = `<header id="h"></header>`
    box(document.getElementById("h")!, 96, { top: 0, width: 1200 })
    expect(stickyTopOffset(document, { ...window, innerWidth: 1200, getComputedStyle: window.getComputedStyle.bind(window) } as Window)).toBe(16)
  })
})

describe("barre figée en bas de l'écran", () => {
  const win = { ...window, innerWidth: 400, innerHeight: 800, getComputedStyle: window.getComputedStyle.bind(window) } as Window

  it("réserve la hauteur du menu fixe du bas", () => {
    document.body.innerHTML = `<nav id="n" style="position: fixed"></nav>`
    box(document.getElementById("n")!, 56, { top: 744, width: 400 })
    expect(fixedBottomInset(document, win)).toBe(56)
  })

  it("ignore une barre qui n'est pas figée ou pas en bas", () => {
    document.body.innerHTML = `<nav id="n"></nav>`
    box(document.getElementById("n")!, 56, { top: 744, width: 400 })
    expect(fixedBottomInset(document, win)).toBe(0)
  })
})
