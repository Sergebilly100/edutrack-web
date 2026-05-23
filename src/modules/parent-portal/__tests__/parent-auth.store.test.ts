import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { useParentAuthStore } from "../parent-auth.store"

const STORAGE_KEY = "parent-auth"

describe("parent-auth.store", () => {
  beforeEach(() => {
    window.localStorage.clear()
    useParentAuthStore.setState({ user: null, accessToken: null })
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it("does NOT persist accessToken to localStorage (XSS safety)", () => {
    useParentAuthStore.getState().setUser({
      id: "u1",
      role: "parent",
      phone: "+225 07 12 34 56 78",
      studentIds: ["s1"],
      mustChangePassword: false,
    })
    useParentAuthStore.getState().setAccessToken("eyJ.access.token")

    const persisted = window.localStorage.getItem(STORAGE_KEY)
    expect(persisted).not.toBeNull()
    const parsed = JSON.parse(persisted as string) as { state: Record<string, unknown> }
    expect(parsed.state).toHaveProperty("user")
    expect(parsed.state).not.toHaveProperty("accessToken")
    expect(JSON.stringify(parsed)).not.toContain("eyJ.access.token")
  })

  it("does NOT persist refreshToken (refresh must live in HttpOnly cookie)", () => {
    useParentAuthStore.getState().setUser({
      id: "u1",
      role: "parent",
      phone: "+225 07 12 34 56 78",
      studentIds: ["s1"],
      mustChangePassword: false,
    })

    const persisted = window.localStorage.getItem(STORAGE_KEY)
    const parsed = JSON.parse(persisted as string) as { state: Record<string, unknown> }
    expect(parsed.state).not.toHaveProperty("refreshToken")
  })

  it("logout clears in-memory state and removes localStorage entry", () => {
    useParentAuthStore.getState().setUser({
      id: "u1",
      role: "parent",
      phone: "+225 07 12 34 56 78",
      studentIds: ["s1"],
      mustChangePassword: false,
    })
    useParentAuthStore.getState().setAccessToken("token-x")

    useParentAuthStore.getState().logout()

    expect(useParentAuthStore.getState().user).toBeNull()
    expect(useParentAuthStore.getState().accessToken).toBeNull()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
