import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/shared/store/auth.store'
import type { SchoolDetailsResponse } from '../admin.api'

const mocks = vi.hoisted(() => ({
  details: vi.fn(),
  flag: vi.fn(),
  toast: vi.fn(),
  year: vi.fn(),
  smsStats: vi.fn(),
  activateSms: vi.fn(),
  deactivateSms: vi.fn(),
}))
vi.mock('../admin.api', async (load) => ({
  ...(await load<typeof import('../admin.api')>()),
  getSchoolDetails: mocks.details, setMidYearFlag: mocks.flag, getSchoolYearStatus: mocks.year,
  getSchoolUsers: vi.fn().mockResolvedValue(null), getSchoolPayments: vi.fn().mockResolvedValue([]),
  getSchoolSmsFeatureStats: mocks.smsStats,
  activateSchoolSmsFeature: mocks.activateSms,
  deactivateSchoolSmsFeature: mocks.deactivateSms,
}))
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }))
import AdminSchoolDetailPage from '../AdminSchoolDetailPage'

const school = (enabled: boolean): SchoolDetailsResponse => ({
  tenantId: 'tenant-1',
  metadata: { name: 'École de recette', subdomain: 'recette', schemaName: 'school_recette', plan: 'pro', status: 'active', city: 'Abidjan', address: null, teachingType: 'secondaire', maxAdminPositions: 5, maxUsers: 50, maxSmsPerMonth: 0, studentLabel: 'Élève', directorTitle: 'Directeur', canEditSmsTemplate: false, canExportData: true, midYearOnboarding: enabled, activeSchoolYear: null, logoUrl: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  usageStats: { nbUsers: 1, activeUsers7d: 0, teachersCount: 0, studentsCount: 0, attendanceRecords30d: 0, mrrFcfa: 0, planMonthlyPriceFcfa: 0, subscriptionStartedAt: null, currentPeriodStart: null, currentPeriodEnd: null, billingCycle: null, paidCurrentPeriodFcfa: 0, remainingCurrentPeriodFcfa: 0, nextDueDate: null, lastPaymentReminderAt: null, lastConnection: null },
  connectionHistory30d: [],
})
const smsStats = (isEnabled: boolean, monetizeParentAlerts: boolean) => ({
  config: {
    is_enabled: isEnabled,
    commission_pct: 12,
    sms_cap_per_student: 60,
    monetize_parent_alerts: monetizeParentAlerts,
    use_real_hours: false,
    geo_check_enabled: false,
  },
  current_month: {
    subscriptions_active: 0,
    subscriptions_new: 0,
    total_collected_fcfa: 0,
    commission_due_fcfa: 0,
    commission_paid_fcfa: 0,
    commission_remaining_fcfa: 0,
  },
  history: [],
  sms_sent_this_month: 0,
})
const mount = (tab = '') => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
  <MemoryRouter initialEntries={[`/admin/schools/tenant-1${tab ? `?tab=${tab}` : ''}`]}><Routes><Route path='/admin/schools/:tenantId' element={<AdminSchoolDetailPage />} /></Routes></MemoryRouter>
</QueryClientProvider>)
const openImports = async () => {
  fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Imports de l’école' }), { button: 0, ctrlKey: false })
  await screen.findByRole('checkbox', { name: 'Activer la reprise en cours d’année' })
}
beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ user: { id: 'admin', role: 'super_admin' } as NonNullable<ReturnType<typeof useAuthStore.getState>['user']> })
  mocks.details.mockResolvedValue(school(false))
  mocks.year.mockResolvedValue({ activeYear: { id: 'year-1', label: '2026-2027' } })
  mocks.smsStats.mockResolvedValue(smsStats(false, false))
  mocks.flag.mockImplementation(async (_id: string, enabled: boolean) => { mocks.details.mockResolvedValue(school(enabled)); return { enabled } })
})

describe('school imports regrouping', () => {
  it('provides one import entry and keeps assignments available without enabling recovery', async () => {
    mount(); await openImports()
    expect(screen.queryByRole('tab', { name: 'Données professeurs' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Reprise de données' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('region', { name: 'Imports de l’école' })).toHaveLength(1)
    expect(screen.getByRole('button', { name: /Professeurs : affectations/ })).toBeVisible()
    expect(screen.queryByRole('button', { name: /Élèves et inscriptions/ })).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Activer la reprise en cours d’année' })).not.toBeChecked()
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Configuration', exact: true }), { button: 0, ctrlKey: false })
    expect(screen.queryByRole('checkbox', { name: 'Activer la reprise en cours d’année' })).not.toBeInTheDocument()
  })
  it('opens all recovery operations within the same tab, then withdraws them on deactivation', async () => {
    mount(); await openImports()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Activer la reprise en cours d’année' }))
    await screen.findByRole('button', { name: /Élèves et inscriptions/ })
    expect(mocks.flag).toHaveBeenCalledWith('tenant-1', true)
    expect(screen.getByRole('tab', { name: 'Imports de l’école' })).toHaveAttribute('data-state', 'active')
    expect(screen.getByRole('button', { name: /Paiements déjà reçus/ })).toBeVisible()
    expect(screen.getAllByRole('region', { name: 'Imports de l’école' })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: /Élèves et inscriptions/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Activer la reprise en cours d’année' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: /Élèves et inscriptions/ })).not.toBeInTheDocument())
    expect(screen.getByRole('tab', { name: 'Imports de l’école' })).toHaveAttribute('data-state', 'active')
    expect(screen.getByRole('heading', { name: 'Importer les affectations des professeurs' })).toBeVisible()
    expect(screen.getByLabelText(/Fichier Excel/)).toBeDisabled()
    expect(mocks.flag).toHaveBeenLastCalledWith('tenant-1', false)
  })
  it('does not expose recovery imports when activation fails', async () => {
    mocks.flag.mockRejectedValue(new Error('unavailable'))
    mount(); await openImports()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Activer la reprise en cours d’année' }))
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })))
    expect(screen.queryByRole('button', { name: /Élèves et inscriptions/ })).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Activer la reprise en cours d’année' })).not.toBeChecked()
  })
  it.each(['imports', 'teacher-data', 'import-midyear'])('opens the common entry from the %s link', async (tab) => {
    mount(tab)
    await screen.findByRole('heading', { name: 'Importer les affectations des professeurs' })
    expect(screen.getByRole('tab', { name: 'Imports de l’école' })).toHaveAttribute('data-state', 'active')
  })
  it('keeps the school detail and its imports reserved for the super administrator', async () => {
    useAuthStore.setState({ user: { id: 'director', role: 'director' } as NonNullable<ReturnType<typeof useAuthStore.getState>['user']> })
    mount('imports')
    expect(screen.getByText('Cette page est réservée au super admin.')).toBeVisible()
    expect(screen.queryByRole('tab', { name: 'Imports de l’école' })).not.toBeInTheDocument()
    expect(mocks.details).not.toHaveBeenCalled()
  })

  it('lets the super admin activate parent portal and free alerts independently from paid mode', async () => {
    mocks.smsStats
      .mockResolvedValueOnce(smsStats(false, false))
      .mockResolvedValue(smsStats(true, false))
    mocks.activateSms.mockResolvedValue({ is_enabled: true, commission_pct: 12, activated_at: '2026-11-04' })
    mount('sms-revenus')

    expect(await screen.findByText('Désactivé — le portail parent et les alertes ne sont pas opérationnels.')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Activer le portail et les alertes gratuites' }))
    expect(await screen.findByRole('alertdialog')).toBeVisible()
    expect(screen.getByRole('alertdialog')).toHaveTextContent(/sans abonnement/)
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }))

    await waitFor(() => expect(mocks.activateSms).toHaveBeenCalledWith('tenant-1', { commission_pct: 12 }))
    await waitFor(() => expect(screen.getByText('Activé — portail parent et alertes gratuites disponibles.')).toBeVisible())
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Feature SMS activée' }))
  })
})
