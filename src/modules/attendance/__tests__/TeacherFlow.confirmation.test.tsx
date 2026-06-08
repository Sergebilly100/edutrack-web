import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import TeacherFlow, { type TeacherSchedule } from "@/modules/attendance/TeacherFlow"

// Mock des hooks
vi.mock("@/shared/hooks/useNetworkStatus", () => ({
  useNetworkStatus: () => ({ isOnline: true }),
}))

vi.mock("@/shared/hooks/useOfflineMutation", () => ({
  useOfflineMutation: vi.fn((fn) => ({
    mutateAsync: vi.fn(async (variables) => {
      return await fn(variables)
    }),
    isPending: false,
  })),
  OfflineMutationQueuedError: class extends Error {},
}))

vi.mock("@/shared/hooks/useStudentLabel", () => ({
  useStudentLabels: () => ({
    singular: "Élève",
    plural: "Élèves",
    singularLower: "élève",
    pluralLower: "élèves",
  }),
}))

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

// Mock des API calls
vi.mock("@/modules/attendance/attendance.api", () => ({
  checkIn: vi.fn(async () => ({ late_minutes: 0 })),
  qrScan: vi.fn(async () => ({ room_mismatch: false })),
  bulkStudents: vi.fn(async () => ({
    success: true,
    notifSendAfter: Date.now() + 15 * 60 * 1000,
    isLocked: false,
  })),
  fetchRooms: vi.fn(async () => []),
  fetchStudents: vi.fn(async () => [
    { id: "student-1", full_name: "Jean Dupont", matricule: "001" },
    { id: "student-2", full_name: "Marie Martin", matricule: "002" },
  ]),
}))

const mockSchedule: TeacherSchedule = {
  id: "schedule-1",
  class_id: "class-1",
  class_name: "6ème A",
  subject_name: "Mathématiques",
  room_id: "room-1",
  room_name: "Salle 101",
  start_at: new Date().toISOString(),
  end_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
}

describe("TeacherFlow - Confirmation Dialog", () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }

  /** Navigate from step 1 to step 3 in demoMode */
  const goToStep3 = async () => {
    const startBtns = await screen.findAllByText(/Je suis présent/i)
    fireEvent.click(startBtns[0])
    // Step 2: "Passer le scan (démo)"
    const skipBtn = await screen.findByText(/Passer le scan/i)
    fireEvent.click(skipBtn)
    // Step 3: wait for student list (DEMO_STUDENTS)
    await screen.findByText(/Kouadio Amani/i)
  }

  /** Click the first student's "Marquer X absent" aria-labeled button */
  const toggleFirstStudentAbsent = () => {
    // aria-label is "Marquer Kouadio Amani absent" (first DEMO_STUDENT)
    const btn = screen.getByRole("button", { name: /Marquer Kouadio Amani absent/i })
    fireEvent.click(btn)
  }

  it("should show confirmation dialog before submitting call", async () => {
    render(<TeacherFlow schedule={mockSchedule} demoMode={true} />, {
      wrapper: createWrapper(),
    })

    await goToStep3()
    toggleFirstStudentAbsent()

    // Click "Valider l'appel (1 absents)"
    const submitBtn = screen.getByRole("button", { name: /Valider l'appel/i })
    fireEvent.click(submitBtn)

    // Dialog should appear with title
    await waitFor(() => {
      expect(screen.getByRole("alertdialog")).toBeInTheDocument()
    })

    // "Vous avez marqué 1 élève(s) absent(s)" is split across a <span> inside a <p>
    // Match the innermost <p> that contains the full text
    expect(screen.getByText((_, el) => {
      return (
        el?.tagName === "P" &&
        !el.querySelector("p") &&
        (el.textContent ?? "").includes("1 élève(s)") &&
        (el.textContent ?? "").includes("absent(s)")
      )
    })).toBeInTheDocument()
    expect(
      screen.getByText(/Cette action enverra des SMS de notification aux parents/i)
    ).toBeInTheDocument()
  })

  it("should allow canceling the confirmation", async () => {
    render(<TeacherFlow schedule={mockSchedule} demoMode={true} />, {
      wrapper: createWrapper(),
    })

    await goToStep3()
    toggleFirstStudentAbsent()

    fireEvent.click(screen.getByRole("button", { name: /Valider l'appel/i }))

    await waitFor(() => {
      expect(screen.getByRole("alertdialog")).toBeInTheDocument()
    })

    const cancelButton = screen.getByText(/Vérifier à nouveau/i)
    fireEvent.click(cancelButton)

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    })

    expect(screen.getByText(/Appel de 6ème A/i)).toBeInTheDocument()
  })

  it("should submit call after confirmation and go to step 4", async () => {
    render(<TeacherFlow schedule={mockSchedule} demoMode={true} />, {
      wrapper: createWrapper(),
    })

    await goToStep3()
    toggleFirstStudentAbsent()

    fireEvent.click(screen.getByRole("button", { name: /Valider l'appel/i }))

    await waitFor(() => {
      expect(screen.getByRole("alertdialog")).toBeInTheDocument()
    })

    // Confirm - button inside dialog
    const confirmBtn = screen.getAllByRole("button").find(
      (btn) => /Confirmer l'appel/i.test(btn.textContent ?? "")
    )!
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(screen.getByText(/Cours démarré. Bonne journée/i)).toBeInTheDocument()
    })

    expect(screen.getByText((_, el) => {
      return el?.tagName === "P" && (el.textContent ?? "").includes("absent(s) enregistré(s)")
    })).toBeInTheDocument()
  })

  it("should not show SMS warning when no absences", async () => {
    render(<TeacherFlow schedule={mockSchedule} demoMode={true} />, {
      wrapper: createWrapper(),
    })

    await goToStep3()

    // No toggles - click validate with 0 absents
    fireEvent.click(screen.getByRole("button", { name: /Valider l'appel/i }))

    await waitFor(() => {
      expect(screen.getByRole("alertdialog")).toBeInTheDocument()
    })

    expect(screen.getByText((_, el) => {
      return (
        el?.tagName === "P" &&
        !el.querySelector("p") &&
        (el.textContent ?? "").includes("0 élève(s)") &&
        (el.textContent ?? "").includes("absent(s)")
      )
    })).toBeInTheDocument()
    expect(
      screen.queryByText(/Cette action enverra des SMS/i)
    ).not.toBeInTheDocument()
  })
})
