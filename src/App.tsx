import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"

import { Toaster } from "@/components/ui/toaster"
import AttendancePage from "@/modules/attendance/AttendancePage"
import OnboardingWizard from "@/modules/onboarding/OnboardingWizard"
import { useAutoSync } from "@/shared/hooks/useAutoSync"
import LoginPage from "./modules/auth/LoginPage"
import ComponentsDemoPage from "./modules/dev/ComponentsDemoPage"

function DashboardPage() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold">Dashboard Page</h1>
    </div>
  )
}

export default function App() {
  useAutoSync()

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/attendance" element={<AttendancePage />} />
        <Route path="/onboarding" element={<OnboardingWizard />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/dev" element={<ComponentsDemoPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  )
}
