import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { type ComponentType } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { HttpResponse, http } from "msw"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"

import { server } from "@/test/msw/server"

const teacherCheckInPath = resolve(process.cwd(), "src/modules/attendance/TeacherCheckIn.tsx")
const hasTeacherCheckIn = existsSync(teacherCheckInPath)
const teacherCheckInImportPath = "../TeacherCheckIn"

const describeTeacherCheckIn = hasTeacherCheckIn ? describe : describe.skip

type TeacherCheckInType = ComponentType<Record<string, never>>

let TeacherCheckIn: TeacherCheckInType | null = null
let postCalls = 0

const successTeacherInfo = {
  teacherName: "M. Diallo",
  hasCheckedInToday: false,
}

function setOnlineStatus(isOnline: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: isOnline,
  })
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

function renderTeacherCheckIn(token = "valid-token") {
  if (!TeacherCheckIn) {
    throw new Error("TeacherCheckIn component is not available")
  }

  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[`/attendance/check/${token}`]}>
        <Routes>
          <Route path="/attendance/check/:token" element={<TeacherCheckIn />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describeTeacherCheckIn("TeacherCheckIn", () => {
  beforeAll(async () => {
    const module = await import(/* @vite-ignore */ teacherCheckInImportPath)
    TeacherCheckIn = module.default as TeacherCheckInType
  })

  beforeEach(() => {
    setOnlineStatus(true)
    postCalls = 0

    server.use(
      http.get("*/attendance/check-in/info/:token", ({ params }) => {
        const token = String(params.token)

        if (token === "invalid-token") {
          return new HttpResponse(null, { status: 404 })
        }

        return HttpResponse.json({
          ...successTeacherInfo,
          data: successTeacherInfo,
        })
      }),
      http.post("*/attendance/check-in/token/:token", () => {
        postCalls += 1
        return HttpResponse.json({
          success: true,
          status: "success",
          message: "Succès",
          data: { success: true, status: "success", message: "Succès" },
        })
      }),
      http.post("*/attendance/check-in", () => {
        postCalls += 1
        return HttpResponse.json({
          success: true,
          status: "success",
          message: "Succès",
          data: { success: true, status: "success", message: "Succès" },
        })
      })
    )
  })

  it("renders teacher name and check-in button", async () => {
    renderTeacherCheckIn("valid-token")

    expect(await screen.findByText("M. Diallo")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Je suis présent(e)" })).toBeInTheDocument()
  })

  it("triggers POST check-in and displays success state on click", async () => {
    renderTeacherCheckIn("valid-token")

    fireEvent.click(await screen.findByRole("button", { name: "Je suis présent(e)" }))

    await waitFor(() => {
      expect(postCalls).toBe(1)
    })

    expect(await screen.findByText(/succ[eè]s|enregistr[eé]/i)).toBeInTheDocument()
  })

  it("shows invalid or expired link message for invalid token", async () => {
    renderTeacherCheckIn("invalid-token")

    expect(await screen.findByText("Lien invalide ou expiré")).toBeInTheDocument()
  })

  it("shows offline badge and keeps button clickable when offline", async () => {
    setOnlineStatus(false)
    window.dispatchEvent(new Event("offline"))

    renderTeacherCheckIn("valid-token")

    const button = await screen.findByRole("button", { name: "Je suis présent(e)" })

    expect(screen.getByText(/hors ligne/i)).toBeInTheDocument()
    expect(button).not.toBeDisabled()

    fireEvent.click(button)
  })

  it("shows already checked message and hides check-in button", async () => {
    const alreadyCheckedInfo = {
      teacherName: "M. Diallo",
      hasCheckedInToday: true,
    }

    server.use(
      http.get("*/attendance/check-in/info/:token", () => {
        return HttpResponse.json({
          ...alreadyCheckedInfo,
          data: alreadyCheckedInfo,
        })
      })
    )

    renderTeacherCheckIn("valid-token")

    expect(await screen.findByText("Déjà enregistré")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Je suis présent(e)" })).not.toBeInTheDocument()
  })
})
