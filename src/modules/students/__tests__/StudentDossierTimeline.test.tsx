import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { describe, expect, it } from "vitest"

import { StudentDossierTimeline } from "@/modules/students/components/StudentDossierTimeline"
import { server } from "@/test/msw/server"

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
)

describe("StudentDossierTimeline", () => {
  it("affiche les événements du dossier sans absence", async () => {
    server.use(
      http.get("*/students/student-1/dossier", () =>
        HttpResponse.json({
          student: { id: "student-1", firstName: "Mariam", lastName: "Bamba", className: "3e A", matricule: "MAT-01" },
          events: [
            { type: "document", date: "2026-08-21", label: "Certificat médical", detail: "fourni" },
            { type: "report_card", date: "2026-07-18", label: "Bulletin publié · Trimestre 3", detail: "Moyenne 14/20, rang 1er / 30" },
          ],
        })
      )
    )

    render(<StudentDossierTimeline studentId="student-1" />, { wrapper })

    expect(await screen.findByText("Bulletin publié · Trimestre 3")).toBeInTheDocument()
    expect(screen.getByText("Moyenne 14/20, rang 1er / 30")).toBeInTheDocument()
    expect(screen.getByText("Certificat médical")).toBeInTheDocument()
    expect(screen.queryByText(/Paiement/)).not.toBeInTheDocument()
  })
})
