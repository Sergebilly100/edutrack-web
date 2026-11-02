import { createContext, useContext, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import type { OnboardingStep } from "./onboarding.progress"

export type OnboardingContextValue = {
  target: string | null
  focusStep: OnboardingStep | null
  schoolId: string | null
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null)

export function OnboardingContextProvider({
  value,
  children,
}: {
  value: OnboardingContextValue
  children: ReactNode
}) {
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>
}

export function useOnboardingContext(): OnboardingContextValue {
  return useContext(OnboardingContext) ?? { target: null, focusStep: null, schoolId: null }
}

export function useOnboardingReturn() { return useOnboardingContext().target }

export function OnboardingReturn() {
  const { target, focusStep } = useOnboardingContext()
  if (focusStep) return null
  if (!target) return null
  return <Button asChild variant="outline" className="min-h-[48px]"><Link to={target}>Retour à la configuration</Link></Button>
}
