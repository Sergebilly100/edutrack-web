import { describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ post: vi.fn() }))

vi.mock("@/shared/api/client", () => ({ apiClient: { post: mocks.post } }))

import { createSchool } from "../admin.api"

describe("createSchool", () => {
  it("transmet le flag de reprise de données choisi à la création", async () => {
    mocks.post.mockResolvedValueOnce({
      data: {
        tenantId: "tenant-1",
        schoolSchemaName: "school-demo",
        directorCredentials: { userId: "user-1", name: "Awa Koné", phone: "2250700000000", email: null, password: "secret" },
      },
    })

    await createSchool({
      name: "Collège Démo",
      subdomain: "college-demo",
      city: "Abidjan",
      teaching_type: "secondaire",
      plan: "pro",
      active_school_year: "09/2026 - 06/2027",
      director_name: "Awa Koné",
      director_phone: "2250700000000",
      midYearOnboarding: true,
    })

    expect(mocks.post).toHaveBeenCalledWith("/admin/schools", expect.objectContaining({ midYearOnboarding: true }))
  })
})
