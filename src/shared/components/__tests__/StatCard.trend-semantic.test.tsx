import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Users } from "lucide-react"

import { StatCard } from "@/shared/components/StatCard"

describe("StatCard - Trend Semantic", () => {
  describe("higher-is-better (default)", () => {
    it("should show green for positive trend", () => {
      render(
        <StatCard
          title="Revenus"
          value="50 000 FCFA"
          icon={<Users className="h-4 w-4" />}
          trend={{ value: 15, label: "vs mois dernier" }}
        />
      )

      const trendText = screen.getByText(/\+15%/)
      expect(trendText).toHaveClass("text-green-600")
    })

    it("should show red for negative trend", () => {
      render(
        <StatCard
          title="Revenus"
          value="40 000 FCFA"
          icon={<Users className="h-4 w-4" />}
          trend={{ value: -10, label: "vs mois dernier" }}
        />
      )

      const trendText = screen.getByText(/-10%/)
      expect(trendText).toHaveClass("text-red-600")
    })

    it("should show green for zero trend", () => {
      render(
        <StatCard
          title="Revenus"
          value="45 000 FCFA"
          icon={<Users className="h-4 w-4" />}
          trend={{ value: 0, label: "stable" }}
        />
      )

      const trendText = screen.getByText(/\+0%/)
      expect(trendText).toHaveClass("text-green-600")
    })
  })

  describe("lower-is-better (inverted semantic)", () => {
    it("should show RED for POSITIVE trend (hausse = mauvais)", () => {
      render(
        <StatCard
          title="Absences profs"
          value={12}
          icon={<Users className="h-4 w-4" />}
          trend={{ value: 20, label: "vs mois dernier" }}
          trendSemantic="lower-is-better"
        />
      )

      const trendText = screen.getByText(/\+20%/)
      expect(trendText).toHaveClass("text-red-600")

      // Vérifie aussi l'icône flèche
      const container = trendText.closest("p")
      const svg = container?.querySelector("svg")
      expect(svg).toHaveClass("text-red-600")
    })

    it("should show GREEN for NEGATIVE trend (baisse = bon)", () => {
      render(
        <StatCard
          title="Absences profs"
          value={8}
          icon={<Users className="h-4 w-4" />}
          trend={{ value: -25, label: "vs mois dernier" }}
          trendSemantic="lower-is-better"
        />
      )

      const trendText = screen.getByText(/-25%/)
      expect(trendText).toHaveClass("text-green-600")

      const container = trendText.closest("p")
      const svg = container?.querySelector("svg")
      expect(svg).toHaveClass("text-green-600")
    })

    it("should show green for zero trend (stable = bon)", () => {
      render(
        <StatCard
          title="Retards"
          value={3}
          icon={<Users className="h-4 w-4" />}
          trend={{ value: 0, label: "stable" }}
          trendSemantic="lower-is-better"
        />
      )

      const trendText = screen.getByText(/\+0%/)
      expect(trendText).toHaveClass("text-green-600")
    })
  })

  describe("Edge cases", () => {
    it("should handle missing trend gracefully", () => {
      render(
        <StatCard
          title="Total élèves"
          value={450}
          icon={<Users className="h-4 w-4" />}
        />
      )

      expect(screen.queryByText(/%/)).not.toBeInTheDocument()
    })

    it("should handle very large positive trend", () => {
      render(
        <StatCard
          title="Nouveaux inscrits"
          value={120}
          icon={<Users className="h-4 w-4" />}
          trend={{ value: 350, label: "vs mois dernier" }}
          trendSemantic="higher-is-better"
        />
      )

      const trendText = screen.getByText(/\+350%/)
      expect(trendText).toHaveClass("text-green-600")
    })

    it("should handle very large negative trend with lower-is-better", () => {
      render(
        <StatCard
          title="Abandons scolaires"
          value={2}
          icon={<Users className="h-4 w-4" />}
          trend={{ value: -80, label: "vs année dernière" }}
          trendSemantic="lower-is-better"
        />
      )

      const trendText = screen.getByText(/-80%/)
      expect(trendText).toHaveClass("text-green-600") // Baisse = bon
    })
  })

  describe("Real-world usage examples", () => {
    it("Revenus : hausse = vert (higher-is-better)", () => {
      render(
        <StatCard
          title="Revenus abonnements"
          value="125 000 FCFA"
          icon={<Users className="h-4 w-4" />}
          trend={{ value: 18, label: "vs mois dernier" }}
          trendSemantic="higher-is-better"
        />
      )

      expect(screen.getByText(/\+18%/)).toHaveClass("text-green-600")
    })

    it("Absences élèves : hausse = rouge (lower-is-better)", () => {
      render(
        <StatCard
          title="Absences élèves"
          value={45}
          icon={<Users className="h-4 w-4" />}
          trend={{ value: 12, label: "vs semaine dernière" }}
          trendSemantic="lower-is-better"
        />
      )

      expect(screen.getByText(/\+12%/)).toHaveClass("text-red-600")
    })

    it("Taux de présence : hausse = vert (higher-is-better)", () => {
      render(
        <StatCard
          title="Taux de présence"
          value="92%"
          icon={<Users className="h-4 w-4" />}
          trend={{ value: 5, label: "vs mois dernier" }}
          trendSemantic="higher-is-better"
        />
      )

      expect(screen.getByText(/\+5%/)).toHaveClass("text-green-600")
    })

    it("Salaires impayés : hausse = rouge (lower-is-better)", () => {
      render(
        <StatCard
          title="Salaires en retard"
          value="85 000 FCFA"
          icon={<Users className="h-4 w-4" />}
          trend={{ value: 30, label: "vs mois dernier" }}
          trendSemantic="lower-is-better"
        />
      )

      expect(screen.getByText(/\+30%/)).toHaveClass("text-red-600")
    })
  })
})
