import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  listYears: vi.fn(), listLevels: vi.fn(), listClasses: vi.fn(),
  listEnrollments: vi.fn(), listCandidates: vi.fn(), createEnrollment: vi.fn(), toast: vi.fn(),
  listHistoricalYears: vi.fn(),
  reviewVisible: true,
}))
vi.mock('@/modules/academic/academic.api', () => ({
  listSchoolYears: mocks.listYears, listLevels: mocks.listLevels, listClasses: mocks.listClasses,
}))
vi.mock('../enrollments.api', async (original) => ({
  ...(await original<typeof import('../enrollments.api')>()),
  listEnrollments: mocks.listEnrollments,
  listReEnrollmentCandidates: mocks.listCandidates,
  listHistoricalReEnrollmentYears: mocks.listHistoricalYears,
  createEnrollment: mocks.createEnrollment,
}))
vi.mock('@/modules/class-decisions/useEndOfYearReviewStatus', () => ({
  useEndOfYearReviewStatus: () => ({ data: { visible: mocks.reviewVisible } }),
}))
vi.mock('@/shared/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermission: () => true }) }))
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }))

import EnrollmentsPage from '../EnrollmentsPage'

type CandidateStatus = 'decision_pending' | 'ready' | 'awaiting_cashier' | 'awaiting_documents' | 'blocked_unpaid' | 're_enrolled' | 'excluded' | 'financial_unavailable'
const candidate = (id: string, status: CandidateStatus) => ({
  studentId: id, studentFirstName: id, studentLastName: 'Koné', studentMatricule: `MAT-${id}`,
  currentClassName: '6e A', currentSchoolYearId: 'year-1', currentSchoolYearLabel: '2025-2026',
  isHistoricalSource: false,
  sourceSchoolYearStatus: 'closed' as const,
  finalDecision: status === 'decision_pending' ? null : status === 'excluded' ? 'expelled' as const : 'promoted' as const,
  nextLevelId: status === 'decision_pending' || status === 'excluded' ? null : 'level-2',
  nextLevelName: status === 'decision_pending' || status === 'excluded' ? null : '5e',
  status,
  enrollment: status === 'awaiting_cashier' || status === 'awaiting_documents' || status === 're_enrolled'
    ? { id: `enrollment-${id}`, status: status === 're_enrolled' ? 'confirmed' as const : status === 'awaiting_documents' ? 'pending_dossier' as const : 'pending_cashier' as const, className: '5e A' }
    : null,
})
const counts = {
  decisionPending: 1, ready: 1, awaitingCashier: 1, awaitingDocuments: 1, blockedUnpaid: 1,
  reEnrolled: 1, excluded: 1, financialUnavailable: 1, toProcess: 5, confirmed: 1, all: 8,
}
const LocationProbe = () => {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}{location.search}</output>
}
const renderPage = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
    <MemoryRouter initialEntries={['/enrollments?tab=re-enrollment']}><EnrollmentsPage /><LocationProbe /></MemoryRouter>
  </QueryClientProvider>,
)

describe('Réinscriptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.reviewVisible = true
    Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
    mocks.listYears.mockResolvedValue([
      { id: 'year-1', label: '2025-2026', status: 'closed', startDate: '2025-09-01', endDate: '2026-06-30' },
      { id: 'year-2', label: '2026-2027', status: 'active', startDate: '2026-09-01', endDate: '2027-06-30' },
    ])
    mocks.listLevels.mockResolvedValue([{ id: 'level-2', name: '5e' }])
    mocks.listHistoricalYears.mockResolvedValue(['2024-2025'])
    mocks.listClasses.mockResolvedValue({ classes: [{ id: 'class-2', name: '5e A', isActive: true, level: { id: 'level-2', name: '5e' }, studentCount: 0 }] })
    mocks.listEnrollments.mockResolvedValue({ enrollments: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } })
    mocks.listCandidates.mockResolvedValue({
      candidates: ['decision_pending', 'ready', 'awaiting_cashier', 'awaiting_documents', 'blocked_unpaid', 're_enrolled', 'excluded', 'financial_unavailable'].map(
        (status) => candidate(status, status as CandidateStatus),
      ),
      counts, pagination: { page: 1, limit: 20, total: 8, totalPages: 1 },
    })
    mocks.createEnrollment.mockResolvedValue({ enrollment: { status: 'pending_cashier' } })
  })

  it('affiche les statuts réels, la progression et ne propose l’action qu’à un candidat prêt', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Campagne de réinscription → année 2026-2027' })).toBeInTheDocument()
    expect(await screen.findByText('1 réinscrit sur 7 élèves attendus')).toBeInTheDocument()
    expect(screen.getByRole('table')).toHaveTextContent('Classe d’origine')
    expect(screen.getByRole('table')).toHaveTextContent('Décision de fin d’année')
    expect(screen.getByRole('progressbar', { name: 'Progression de la campagne de réinscription' })).toHaveAttribute('aria-valuenow', '14')
    expect(within(screen.getByRole('row', { name: 'Ouvrir le dossier de KONÉ decision_pending' })).getByText('Décision en attente')).toBeInTheDocument()
    expect(within(screen.getByRole('row', { name: 'Ouvrir le dossier de KONÉ blocked_unpaid' })).getByText(/Impayé de l’année d’origine/)).toBeInTheDocument()
    expect(within(screen.getByRole('row', { name: 'Ouvrir le dossier de KONÉ financial_unavailable' })).getByText(/Solde de l’année d’origine indisponible/)).toBeInTheDocument()
    expect(within(screen.getByRole('row', { name: 'Ouvrir le dossier de KONÉ awaiting_documents' })).getByText(/pièces du dossier à compléter/)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Réinscrire' })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Bloqué par impayé : 1' }))
    await waitFor(() => expect(mocks.listCandidates).toHaveBeenCalledWith(expect.objectContaining({ campaignStatus: 'blocked_unpaid' })))
  })

  it('propose les élèves d’une année importée et laisse choisir manuellement la classe active', async () => {
    mocks.listCandidates.mockResolvedValue({
      candidates: [{
        ...candidate('historique', 'ready'),
        currentSchoolYearId: null,
        currentSchoolYearLabel: '2024-2025',
        currentClassName: '6e A',
        finalDecision: null,
        nextLevelId: null,
        nextLevelName: null,
        isHistoricalSource: true,
        sourceSchoolYearStatus: 'historical',
      }],
      counts: { ...counts, decisionPending: 0, ready: 1, awaitingCashier: 0, awaitingDocuments: 0, blockedUnpaid: 0, reEnrolled: 0, excluded: 0, financialUnavailable: 0, toProcess: 1, confirmed: 0, all: 1 },
      targetSchoolYear: { id: 'year-2', label: '2026-2027', status: 'active' },
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    })
    renderPage()

    await screen.findByText('KONÉ historique')
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Année d’origine' }), { key: 'ArrowDown' })
    fireEvent.click(await screen.findByRole('option', { name: '2024-2025 (import historique) · Année clôturée' }))
    await waitFor(() => expect(mocks.listCandidates).toHaveBeenCalledWith(expect.objectContaining({
      schoolYearId: 'year-2',
      sourceSchoolYearLabel: '2024-2025',
      sourceSchoolYearId: undefined,
    })))
    expect(await screen.findByText(/Les élèves importés pour 2024-2025 n’ont pas d’impayé antérieur enregistré/)).toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Classe d’accueil de KONÉ historique' }), { key: 'ArrowDown' })
    fireEvent.click(await screen.findByRole('option', { name: /5e A/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Réinscrire' }))
    await waitFor(() => expect(mocks.createEnrollment).toHaveBeenCalledWith({
      studentId: 'historique',
      classId: 'class-2',
      schoolYearId: 'year-2',
      type: 're_registration',
      isRepeating: false,
      sourceSchoolYearLabel: '2024-2025',
    }))
  })

  it('regroupe les statuts à zéro tout en les gardant filtrables', async () => {
    mocks.listCandidates.mockResolvedValue({
      candidates: [{ ...candidate('confirmed', 're_enrolled'), finalDecision: null }],
      counts: { ...counts, decisionPending: 0, ready: 0, awaitingCashier: 0, awaitingDocuments: 0, blockedUnpaid: 0, reEnrolled: 1, excluded: 0, financialUnavailable: 0, toProcess: 0, confirmed: 1, all: 1 },
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    })
    renderPage()
    expect(await screen.findByRole('button', { name: 'Réinscrit : 1' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Prêt à réinscrire : 0' })).not.toBeInTheDocument()
    expect(within(screen.getByRole('row', { name: 'Ouvrir le dossier de KONÉ confirmed' })).getByText('Non renseignée')).toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole('button', { name: 'Autres statuts' }), { key: 'ArrowDown' })
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Prêt à réinscrire : 0' }))
    await waitFor(() => expect(mocks.listCandidates).toHaveBeenCalledWith(expect.objectContaining({ campaignStatus: 'ready' })))
    expect(await screen.findByRole('button', { name: 'Prêt à réinscrire : 0' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('permet de filtrer directement par classe récente', async () => {
    renderPage()
    await screen.findByText('KONÉ ready')
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Classe récente' }), { key: 'ArrowDown' })
    fireEvent.click(await screen.findByRole('option', { name: '5e A' }))
    await waitFor(() => expect(mocks.listCandidates).toHaveBeenCalledWith(expect.objectContaining({ classId: 'class-2', levelId: undefined })))
  })

  it('crée le dossier après choix de la classe et ouvre le dossier par la ligne', async () => {
    renderPage()
    await screen.findByText('KONÉ ready')
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Classe d’accueil de KONÉ ready' }), { key: 'ArrowDown' })
    fireEvent.click(await screen.findByRole('option', { name: /5e A/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Réinscrire' }))
    await waitFor(() => expect(mocks.createEnrollment).toHaveBeenCalledWith({
      studentId: 'ready', classId: 'class-2', schoolYearId: 'year-2', type: 're_registration', isRepeating: false,
    }))
    fireEvent.click(screen.getByRole('row', { name: 'Ouvrir le dossier de KONÉ ready' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/students/ready/history')
  })

  it('affiche les candidats en lecture seule si la cible n’existe pas', async () => {
    mocks.listYears.mockResolvedValue([{ id: 'year-1', label: '2025-2026', status: 'closed', startDate: '2025-09-01', endDate: '2026-06-30' }])
    renderPage()
    expect(await screen.findByText('KONÉ ready')).toBeInTheDocument()
    expect(screen.getByText(/La campagne s’ouvrira quand l’année 2026-2027 sera créée et ouverte par IvoirEdu/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Réinscrire' })).not.toBeInTheDocument()
    expect(mocks.listCandidates).toHaveBeenCalledWith(expect.objectContaining({ schoolYearId: undefined, sourceSchoolYearId: 'year-1' }))
  })

  it('distingue une année cible préparée mais non ouverte', async () => {
    mocks.listYears.mockResolvedValue([{ id: 'year-1', label: '2025-2026', status: 'closed', startDate: '2025-09-01', endDate: '2026-06-30' }])
    mocks.listCandidates.mockResolvedValue({
      candidates: [candidate('ready', 'ready')], counts: { ...counts, decisionPending: 0, awaitingCashier: 0, awaitingDocuments: 0, blockedUnpaid: 0, reEnrolled: 0, excluded: 0, financialUnavailable: 0, toProcess: 1, confirmed: 0, all: 1 },
      targetSchoolYear: { id: 'year-2', label: '2026-2027', status: 'draft' },
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    })
    renderPage()
    expect(await screen.findByText(/La campagne s’ouvrira quand l’année 2026-2027 sera ouverte par IvoirEdu/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Réinscrire' })).not.toBeInTheDocument()
  })

  it('permet de préparer l’année suivant l’année active et ne montre Fin d’année que si sa route est accessible', async () => {
    mocks.listYears.mockResolvedValue([{ id: 'year-2', label: '2026-2027', status: 'active', startDate: '2026-09-01', endDate: '2027-06-30' }])
    mocks.listCandidates.mockResolvedValue({
      candidates: [{ ...candidate('attente', 'decision_pending'), currentSchoolYearId: 'year-2', currentSchoolYearLabel: '2026-2027', sourceSchoolYearStatus: 'active' }],
      counts: { ...counts, decisionPending: 1, ready: 0, awaitingCashier: 0, awaitingDocuments: 0, blockedUnpaid: 0, reEnrolled: 0, excluded: 0, financialUnavailable: 0, toProcess: 1, confirmed: 0, all: 1 },
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    })
    renderPage()
    expect(await screen.findByText('KONÉ attente')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Campagne de réinscription → année 2027-2028' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ouvrir Fin d’année' })).toHaveAttribute('href', '/end-of-year')
    expect(screen.queryByRole('button', { name: 'Réinscrire' })).not.toBeInTheDocument()
  })

  it('garde les anciennes campagnes clôturées en consultation seule', async () => {
    mocks.listYears.mockResolvedValue([
      { id: 'year-old', label: '2024-2025', status: 'closed', startDate: '2024-09-01', endDate: '2025-06-30' },
      { id: 'year-1', label: '2025-2026', status: 'closed', startDate: '2025-09-01', endDate: '2026-06-30' },
      { id: 'year-2', label: '2026-2027', status: 'active', startDate: '2026-09-01', endDate: '2027-06-30' },
    ])
    mocks.listCandidates.mockImplementation(async (params: { sourceSchoolYearId: string }) => ({
      candidates: [candidate('ready', 'ready')], counts: { ...counts, decisionPending: 0, awaitingCashier: 0, awaitingDocuments: 0, blockedUnpaid: 0, reEnrolled: 0, excluded: 0, financialUnavailable: 0, toProcess: 1, confirmed: 0, all: 1 },
      targetSchoolYear: params.sourceSchoolYearId === 'year-old' ? { id: 'year-1', label: '2025-2026', status: 'closed' } : { id: 'year-2', label: '2026-2027', status: 'active' },
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    }))
    renderPage()
    await screen.findByText('KONÉ ready')
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Année d’origine' }), { key: 'ArrowDown' })
    fireEvent.click(await screen.findByRole('option', { name: '2024-2025 · Année clôturée' }))
    await waitFor(() => expect(mocks.listCandidates).toHaveBeenCalledWith(expect.objectContaining({ sourceSchoolYearId: 'year-old', schoolYearId: 'year-1' })))
    expect(await screen.findByText('L’année 2025-2026 est clôturée. Cette campagne est consultable en lecture seule.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Réinscrire' })).not.toBeInTheDocument()
  })
})
