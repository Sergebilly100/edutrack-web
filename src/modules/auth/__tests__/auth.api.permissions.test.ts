import { beforeEach, describe, expect, it, vi } from "vitest"

const getMock = vi.hoisted(() => vi.fn())
vi.mock("@/shared/api/client", () => ({ apiClient: { get: getMock, post: vi.fn(), patch: vi.fn() } }))

import { getMyPermissions } from "../auth.api"

describe("getMyPermissions", () => {
  beforeEach(() => vi.clearAllMocks())

  it("conserve les permissions financières reconnues et écarte les clés inconnues", async () => {
    getMock.mockResolvedValue({ data: { permissions: [
      "payments.record", "payments.view", "tuition.edit", "subscription_plans.edit", "unknown.permission",
    ] } })

    await expect(getMyPermissions()).resolves.toEqual([
      "payments.record", "payments.view", "tuition.edit", "subscription_plans.edit",
    ])
  })
})
