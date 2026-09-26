import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { useAuthStore } from '@/shared/store/auth.store'
import { configurationLink } from '@/modules/onboarding/onboarding.progress'

const mocks = vi.hoisted(() => ({ analyze: vi.fn(), save: vi.fn(), confirm: vi.fn(), template: vi.fn(), errors: vi.fn(), toast: vi.fn(), school: vi.fn() }))
vi.mock('../historical-students.api', async (load) => ({
  ...(await load<typeof import('../historical-students.api')>()),
  analyzeHistoricalStudents: mocks.analyze, saveHistoricalMapping: mocks.save,
  confirmHistoricalStudents: mocks.confirm, downloadHistoricalTemplate: mocks.template,
  downloadHistoricalErrors: mocks.errors,
}))
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }))
vi.mock('@/modules/onboarding/onboarding.api', () => ({ fetchSchoolInfo: mocks.school }))
vi.mock('../import-export.api', async (load) => ({
  ...(await load<typeof import('../import-export.api')>()),
  fetchImportHistory: vi.fn().mockResolvedValue({ items: [], total: 0, totalPages: 1 }),
}))
import { HistoricalStudentsImport } from '../HistoricalStudentsImport'
import ImportPage from '../ImportPage'

const fields = ['matricule', 'nom', 'prenom', 'parent_phone'].map((targetField) => ({ targetField, sourceColumnLabel: targetField, isRequired: targetField !== 'parent_phone', translations: [] }))
const analysis = {
  headers: ['matricule', 'nom', 'prenom', 'parent_phone'], rowCount: 2, validCount: 1,
  missingTargets: [], matchedFields: fields, profile: null,
  sampleRows: [{ rowNumber: 2, values: { matricule: 'H1', nom: 'Kone', prenom: 'Aya', parent_phone: '' } }],
  errors: [{ rowNumber: 3, field: 'nom', reason: 'Nom requis' }],
}
const mount = (node = <HistoricalStudentsImport />, path = '/import?type=students') => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
    <MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>
  </QueryClientProvider>,
)
beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ user: { id: 'director', role: 'director', schemaName: 'school_test', tenantId: 'school-id' } as NonNullable<ReturnType<typeof useAuthStore.getState>['user']>, permissions: ['settings.school', 'import.students'] })
  mocks.school.mockResolvedValue({ id: 'school-id' })
  mocks.analyze.mockResolvedValue(analysis)
  mocks.save.mockResolvedValue({})
  mocks.confirm.mockResolvedValue({ createdCount: 1, reusedCount: 0, totalRows: 2, errors: analysis.errors })
})

describe('historical student import', () => {
  it('maps without mandatory class, previews valid rows, confirms and exports row/field errors', async () => {
    mount()
    expect(screen.getByText(/Ils seront inscrits plus tard/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Fichier Excel des élèves'), { target: { files: [new File(['excel'], 'historique.xlsx')] } })
    fireEvent.click(screen.getByRole('button', { name: 'Analyser les colonnes' }))
    await screen.findByRole('heading', { name: 'Correspondance des colonnes' })
    expect(screen.getAllByRole('combobox')).toHaveLength(4)
    expect(screen.queryByRole('combobox', { name: /classe/i })).not.toBeInTheDocument()
    expect(screen.getByText('(facultatif)')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Importer les profils valides' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les correspondances' }))
    await screen.findByRole('button', { name: 'Importer les profils valides' })
    expect(mocks.save).toHaveBeenCalledWith(fields)
    expect(screen.getByText('Aya')).toBeInTheDocument()
    expect(screen.getByText('Nom requis')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Importer les profils valides' }))
    await screen.findByText(/1 profil\(s\) créé\(s\), 0 profil\(s\) déjà présent/)
    expect(mocks.confirm).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Télécharger le rapport d’erreurs' }))
    expect(mocks.errors).toHaveBeenCalledWith(analysis.errors)
  })
  it('keeps only historical student import and the contextual onboarding return', async () => {
    mount(<ImportPage />, configurationLink('/import?type=students', 'school-id', 4))
    await screen.findByRole('link', { name: 'Retour à la configuration initiale' })
    expect(screen.getByRole('heading', { name: 'Profils élèves historiques' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Importer l’emploi du temps' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /emploi du temps/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Mode de mise à jour')).not.toBeInTheDocument()
    expect(screen.queryByText('Reprise de données')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /historique des imports/i })).not.toBeInTheDocument()
  })
  it('reports a server error visibly and never confirms after mapping failure', async () => {
    mocks.save.mockRejectedValue(new Error('mapping error'))
    mount()
    fireEvent.change(screen.getByLabelText('Fichier Excel des élèves'), { target: { files: [new File(['excel'], 'historique.xlsx')] } })
    fireEvent.click(screen.getByRole('button', { name: 'Analyser les colonnes' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Enregistrer les correspondances' }))
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })))
    expect(mocks.confirm).not.toHaveBeenCalled()
  })
})
