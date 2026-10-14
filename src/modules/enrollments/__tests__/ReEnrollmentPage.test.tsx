import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  listYears: vi.fn(), listLevels: vi.fn(), listClasses: vi.fn(),
  listEnrollments: vi.fn(), listCandidates: vi.fn(), createEnrollment: vi.fn(), toast: vi.fn(),
}))
vi.mock('@/modules/academic/academic.api', () => ({
  listSchoolYears: mocks.listYears, listLevels: mocks.listLevels, listClasses: mocks.listClasses,
}))
vi.mock('../enrollments.api', async (original) => ({
  ...(await original<typeof import('../enrollments.api')>()),
  listEnrollments: mocks.listEnrollments,
  listReEnrollmentCandidates: mocks.listCandidates,
  createEnrollment: mocks.createEnrollment,
}))
vi.mock('@/shared/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermission: () => true }) }))
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }))

import EnrollmentsPage from '../EnrollmentsPage'

describe('Réinscriptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
    mocks.listYears.mockResolvedValue([{ id: 'year-1', label: '2025-2026', status: 'closed' }, { id: 'year-2', label: '2026-2027', status: 'active' }])
    mocks.listLevels.mockResolvedValue([{ id: 'level-2', name: '5e' }])
    mocks.listClasses.mockResolvedValue({ classes: [{ id: 'class-2', name: '5e A', isActive: true, level: { id: 'level-2', name: '5e' }, studentCount: 0 }] })
    mocks.listEnrollments.mockResolvedValue({ enrollments: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } })
    mocks.listCandidates.mockResolvedValue({ candidates: [{ studentId: 'student-1', studentFirstName: 'Aya', studentLastName: 'Koné', studentMatricule: null, currentClassName: '6e A', currentSchoolYearId: 'year-1', currentSchoolYearLabel: '2025-2026', finalDecision: 'promoted', nextLevelId: 'level-2', nextLevelName: '5e', enrollment: null }], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } })
    mocks.createEnrollment.mockResolvedValue({ enrollment: { status: 'pending_cashier' } })
  })

  it('ouvre le formulaire du candidat et conserve le type re_registration', async () => {
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter initialEntries={['/enrollments?tab=re-enrollment']}><EnrollmentsPage /></MemoryRouter>
    </QueryClientProvider>)
    expect(await screen.findByText('Koné Aya')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Campagne 2026-2027' })).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Année cible active' })).not.toBeInTheDocument()
    const form = await screen.findByLabelText('Réinscription de Aya Koné')
    fireEvent.keyDown(form.querySelector('[role="combobox"]')!, { key: 'ArrowDown' })
    fireEvent.click(await screen.findByRole('option', { name: /5e A/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Créer la réinscription' }))
    await waitFor(() => expect(mocks.createEnrollment).toHaveBeenCalledWith({ studentId: 'student-1', classId: 'class-2', schoolYearId: 'year-2', type: 're_registration' }))
  })

  it('explique l’absence de campagne et ne charge aucun candidat sans année cible', async () => {
    mocks.listYears.mockResolvedValue([{ id: 'year-1', label: '2025-2026', status: 'closed', endDate: '2026-06-30' }])
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/enrollments?tab=re-enrollment']}><EnrollmentsPage /></MemoryRouter>
    </QueryClientProvider>)

    expect(await screen.findByText('Aucune campagne active')).toBeInTheDocument()
    expect(mocks.listCandidates).not.toHaveBeenCalled()
  })

  it('filtre la campagne par état, année d’origine clôturée et recherche', async () => {
    mocks.listYears.mockResolvedValue([
      { id: 'year-old', label: '2024-2025', status: 'closed', startDate: '2024-09-01', endDate: '2025-06-30' },
      { id: 'year-1', label: '2025-2026', status: 'closed', startDate: '2025-09-01', endDate: '2026-06-30' },
      { id: 'year-2', label: '2026-2027', status: 'active', startDate: '2026-09-01', endDate: '2027-06-30' },
    ])
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/enrollments?tab=re-enrollment']}><EnrollmentsPage /></MemoryRouter>
    </QueryClientProvider>)

    await waitFor(() => expect(mocks.listCandidates).toHaveBeenCalledWith(expect.objectContaining({ schoolYearId: 'year-2', campaignStatus: 'to_process' })))
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'État de la campagne' }), { key: 'ArrowDown' })
    fireEvent.click(await screen.findByRole('option', { name: 'Confirmé' }))
    await waitFor(() => expect(mocks.listCandidates).toHaveBeenCalledWith(expect.objectContaining({ schoolYearId: 'year-2', campaignStatus: 'confirmed' })))

    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Année d’origine clôturée' }), { key: 'ArrowDown' })
    expect(screen.queryByRole('option', { name: /2026-2027/ })).not.toBeInTheDocument()
    fireEvent.click(await screen.findByRole('option', { name: '2024-2025' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Filtrer les élèves' }), { target: { value: 'MAT-42' } })
    await waitFor(() => expect(mocks.listCandidates).toHaveBeenCalledWith(expect.objectContaining({ schoolYearId: 'year-2', campaignStatus: 'confirmed', sourceSchoolYearId: 'year-old', search: 'MAT-42' })))
  })
})
