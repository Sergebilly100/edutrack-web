import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"

import LoginPage from "./modules/auth/LoginPage"

function AttendancePage() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold">Attendance Page</h1>
    </div>
  )
}

function DashboardPage() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold">Dashboard Page</h1>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/attendance" element={<AttendancePage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
