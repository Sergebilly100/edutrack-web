import { describe, expect, it } from "vitest"

import type { AidePage, AideViewer } from "../aide.types"
import { AIDE_PAGES, canView, findAideByPath, isTaskAvailable, matchesQuery, visibleAidePages } from "../aide-registry"

const director = (perms: string[] = []): AideViewer => ({ role: "director", hasPermission: (key) => perms.includes(key) })

describe("registre d'aide", () => {
  it("retrouve la page par sa route, y compris avec un motif", () => {
    expect(findAideByPath("/students")?.id).toBe("students")
    expect(findAideByPath("/students/history")?.id).toBe("students-history")
    expect(findAideByPath("/students/abc-123")?.id).toBe("student-detail")
    expect(findAideByPath("/students/abc-123/history")?.id).toBe("student-detail")
    expect(findAideByPath("/teachers/42")?.id).toBe("teacher-detail")
    expect(findAideByPath("/enrollments")?.id).toBe("enrollments")
    expect(findAideByPath("/enrollments/new")?.id).toBe("enrollment-new")
    expect(findAideByPath("/enrollments/9/edit")?.id).toBe("enrollment-new")
    expect(findAideByPath("/enrollments/9/payment")?.id).toBe("enrollment-payment")
    expect(findAideByPath("/enrollments/students/7/documents")?.id).toBe("enrollment-documents")
    expect(findAideByPath("/nulle-part")).toBeUndefined()
    expect(findAideByPath("/attendance")?.id).toBe("teacher-app")
    expect(findAideByPath("/academic/notes")?.id).toBe("teacher-notes")
    const page: AidePage = { ...AIDE_PAGES[0], id: "x", chemins: ["/x/:id"] }
    expect(findAideByPath("/x/42", [page])?.id).toBe("x")
  })

  it("filtre par rôle et par permission (au moins une)", () => {
    expect(canView({ roles: ["director"] }, director())).toBe(true)
    expect(canView({ roles: ["teacher"] }, director())).toBe(false)
    expect(canView({ requires: ["students.view", "students.edit"] }, director(["students.edit"]))).toBe(true)
    expect(canView({ requires: ["students.view"] }, director())).toBe(false)
    expect(canView({ roles: ["director"] }, { role: undefined, hasPermission: () => true })).toBe(false)
  })

  it("ne propose une tâche que si l'utilisateur peut la faire", () => {
    const task = AIDE_PAGES[0].taches.find((item) => item.id === "ajouter-eleve")!
    expect(isTaskAvailable(task, director())).toBe(false)
    expect(isTaskAvailable(task, director(["enrollments.create"]))).toBe(true)
  })

  it("masque les pages non autorisées dans le centre d'aide", () => {
    const sansDroit = visibleAidePages(director()).map((page) => page.id)
    expect(sansDroit).not.toContain("students")
    expect(sansDroit).not.toContain("salaries")
    const ids = visibleAidePages(director(["students.view"])).map((page) => page.id)
    expect(ids).toContain("students")
    expect(ids).not.toContain("enrollments")
    const teacherIds = visibleAidePages({ role: "teacher", hasPermission: () => true }).map((page) => page.id)
    expect(teacherIds).toEqual(expect.arrayContaining(["account", "teacher-dashboard", "teacher-app", "teacher-notes", "teacher-calculation"]))
    const parentIds = visibleAidePages({ role: "parent", hasPermission: () => false }).map((page) => page.id)
    expect(parentIds).toEqual(expect.arrayContaining(["parent-dashboard", "parent-payments", "parent-account"]))
    expect(parentIds.every((id) => id.startsWith("parent-"))).toBe(true)
    expect(teacherIds).not.toContain("students")
    expect(teacherIds).not.toContain("settings")
  })

  it("cherche sans tenir compte des accents ni de la casse", () => {
    const page = AIDE_PAGES[0]
    expect(matchesQuery(page, "ELEVE")).toBe(true)
    expect(matchesQuery(page, "absences")).toBe(true)
    expect(matchesQuery(page, "bulletin")).toBe(false)
    expect(matchesQuery(page, "  ")).toBe(true)
  })
})

describe("qualité du contenu enregistré", () => {
  it.each(AIDE_PAGES.map((page) => [page.id, page] as const))("%s : structure et longueurs", (_id, page) => {
    expect(page.resume.length).toBeGreaterThan(20)
    expect(page.taches.length).toBeGreaterThanOrEqual(1)
    expect(page.bonASavoir.length).toBeGreaterThanOrEqual(2)
    expect(page.bonASavoir.length).toBeLessThanOrEqual(4)
    expect((page.prerequis ?? []).length).toBeLessThanOrEqual(3)
    for (const point of page.prerequis ?? []) expect(point.split(/\s+/).length).toBeLessThanOrEqual(30)
    for (const task of page.taches) {
      expect(task.titre.endsWith("?")).toBe(true)
      expect(task.etapes.length).toBeGreaterThanOrEqual(3)
      expect(task.etapes.length).toBeLessThanOrEqual(6)
      for (const etape of task.etapes) expect(etape.split(/\s+/).length).toBeLessThanOrEqual(20)
    }
  })

  it("les identifiants de page sont uniques", () => {
    const ids = AIDE_PAGES.map((page) => page.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
