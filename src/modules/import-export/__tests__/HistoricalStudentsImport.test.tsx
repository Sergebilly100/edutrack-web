import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { useAuthStore } from '@/shared/store/auth.store'
import { configurationLink } from '@/modules/onboarding/onboarding.progress'

const mocks = vi.hoisted(() => ({ analyze: vi.fn(), save: vi.fn(), confirm: vi.fn(), template: vi.fn(), errors: vi.fn(), toast: vi.fn(), school: vi.fn(), access: vi.fn() }))
vi.mock('../historical-students.api', async (load) => ({
  ...(await load<typeof import('../historical-students.api')>()),
  analyzeHistoricalStudents: mocks.analyze, saveHistoricalMapping: mocks.save,
  confirmHistoricalStudents: mocks.confirm, downloadHistoricalTemplate: mocks.template,
  downloadHistoricalErrors: mocks.errors,
}))
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }))
vi.mock('@/modules/onboarding/onboarding.api', () => ({ fetchSchoolInfo: mocks.school }))
vi.mock('../import-export.api', async (load) => ({
  ...(await load<typeof import('../import-export.api')>()), fetchImportContext: mocks.access,
  fetchImportHistory: vi.fn().mockResolvedValue({ items: [], total: 0, totalPages: 1 }),
}))
import { HistoricalStudentsImport } from '../HistoricalStudentsImport'
import { HISTORICAL_TARGETS } from '../historical-students.api'
import ImportPage from '../ImportPage'

const fields = HISTORICAL_TARGETS.map((target) => ({ targetField: target.key, sourceColumnLabel: target.key, isRequired: target.required, translations: [] }))
const analysis = {
  schoolYearLabel: '2024-2025', mappingSaved: false,
  headers: fields.map((field) => field.targetField), rowCount: 2, validCount: 1,
  missingTargets: [], matchedFields: fields, profile: null,
  sampleRows: [{ rowNumber: 2, sheetName: '4e A', values: { matricule: 'H1', nom: 'Kone', prenom: 'Aya', historical_class: '4e A', birth_date: '2010-03-04', parent_name: 'Parent principal test', parent_phone: '2250700000000', parent_email: 'parent@example.ci', parent_name_2: 'Second parent test', parent_phone_2: '2250100000000' } }],
  errors: [{ rowNumber: 3, sheetName: '4e A', field: 'nom', reason: 'Nom requis' }],
}
const mount = (node = <HistoricalStudentsImport />, path = '/import?type=students') => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
    <MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>
  </QueryClientProvider>,
)
const chooseFile = () => {
  const file = new File(['excel'], 'historique.xlsx')
  fireEvent.change(screen.getByLabelText('Année scolaire de l’historique *'), { target: { value: '2024 / 2025' } })
  fireEvent.change(screen.getByLabelText('Fichier Excel des élèves', { selector: 'input' }), { target: { files: [file] } })
  return file
}
beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ user: { id: 'director', role: 'director', schemaName: 'school_test', tenantId: 'school-id' } as NonNullable<ReturnType<typeof useAuthStore.getState>['user']>, permissions: ['settings.school', 'import.students', 'import.teachers', 'import.schedule'] })
  mocks.school.mockResolvedValue({ id: 'school-id', onboarding_completed: false })
  mocks.access.mockResolvedValue({ initialConfiguration: true, canImportProfiles: true })
  mocks.analyze.mockResolvedValue({ ...analysis, matchedFields: fields.map((field) => ({ ...field, id: `stored-${field.targetField}` })) })
  mocks.save.mockResolvedValue({})
  mocks.confirm.mockResolvedValue({ schoolYearLabel: '2024-2025', createdCount: 1, reusedCount: 0, totalRows: 2, errors: analysis.errors })
})

describe('historical student import', () => {
  it('requires an explicit historical year and accepts drag and drop without mandatory class', async () => {
    mount()
    expect(screen.getByRole('button', { name: 'Analyser les colonnes' })).toBeDisabled()
    const file = new File(['excel'], 'historique.xlsx')
    fireEvent.drop(screen.getByRole('region', { name: 'Fichier Excel des élèves' }), { dataTransfer: { files: [file] } })
    expect(screen.getByText('historique.xlsx')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Analyser les colonnes' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Année scolaire de l’historique *'), { target: { value: '2024-2026' } })
    expect(screen.getByRole('button', { name: 'Analyser les colonnes' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Année scolaire de l’historique *'), { target: { value: '2024-2025' } })
    fireEvent.click(screen.getByRole('button', { name: 'Analyser les colonnes' }))
    await screen.findByRole('heading', { name: 'Correspondance des colonnes' })
    expect(mocks.analyze).toHaveBeenCalledWith(file, '2024-2025')
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier les correspondances' }))
    expect(screen.getAllByRole('combobox')).toHaveLength(10)
    expect(screen.getByRole('combobox', { name: /Ancienne classe/ })).not.toHaveAttribute('aria-required', 'true')
  })
  it('previews both parents and historical class, confirms, exports errors and permits another batch', async () => {
    mount()
    const file = chooseFile()
    fireEvent.click(screen.getByRole('button', { name: 'Analyser les colonnes' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Enregistrer les correspondances' }))
    await screen.findByRole('button', { name: 'Importer les profils valides' })
    expect(mocks.save).toHaveBeenCalledWith(fields)
    expect(screen.getByText('Kone Aya')).toBeInTheDocument()
    expect(screen.getByText('Parent principal test')).toBeInTheDocument()
    expect(screen.getByText('Second parent test')).toBeInTheDocument()
    expect(screen.getByText('4e A', { exact: true })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Importer les profils valides' }))
    await screen.findByText(/1 profil\(s\) créé\(s\), 0 profil\(s\) déjà présent/)
    expect(mocks.confirm).toHaveBeenCalledWith(file, '2024-2025')
    fireEvent.click(screen.getByRole('button', { name: 'Télécharger le rapport d’erreurs' }))
    expect(mocks.errors).toHaveBeenCalledWith(analysis.errors)
    fireEvent.click(screen.getByRole('button', { name: 'Importer un autre lot' }))
    expect(screen.getByLabelText('Année scolaire de l’historique *')).toHaveValue('2024 / 2025')
    expect(screen.getByRole('button', { name: 'Analyser les colonnes' })).toBeDisabled()
    expect(screen.queryByText('historique.xlsx')).not.toBeInTheDocument()
  })
  it('keeps historical import within the contextual onboarding return', async () => {
    mount(<ImportPage />, configurationLink('/import?type=students', 'school-id', 4))
    await screen.findByRole('heading', { name: 'Profils élèves historiques' })
    expect(screen.getByRole('link', { name: 'Retour à la configuration initiale' })).toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(screen.queryByText('Mode de mise à jour')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /historique des imports/i })).not.toBeInTheDocument()
  })
  it.each([false, true])('keeps the normal import page on timetable outside onboarding (completed=%s)', async (completed) => {
    mocks.access.mockResolvedValue({ initialConfiguration: !completed, canImportProfiles: !completed })
    mount(<ImportPage />)
    await screen.findByRole('tab', { name: /Emploi du temps/ })
    expect(screen.queryByRole('heading', { name: 'Profils élèves historiques' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /Élèves|Professeurs/ })).not.toBeInTheDocument()
    if (!completed) expect(screen.getByRole('link', { name: 'Préparer les profils à l’étape 4' })).toBeInTheDocument()
  })
  it('rejects an old onboarding link after finalization', async () => {
    mocks.access.mockResolvedValue({ initialConfiguration: false, canImportProfiles: false })
    mocks.school.mockResolvedValue({ id: 'school-id', onboarding_completed: true })
    mount(<ImportPage />, configurationLink('/import?type=students', 'school-id', 4))
    await screen.findByRole('tab', { name: /Emploi du temps/ })
    expect(screen.queryByRole('heading', { name: 'Profils élèves historiques' })).not.toBeInTheDocument()
  })
  it('reports a server error and never confirms after mapping failure', async () => {
    mocks.save.mockRejectedValue(new Error('mapping error'))
    mount()
    chooseFile()
    fireEvent.click(screen.getByRole('button', { name: 'Analyser les colonnes' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Enregistrer les correspondances' }))
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })))
    expect(mocks.confirm).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Importer les profils valides' })).not.toBeInTheDocument()
  })
  it('clears the previous valid file when an invalid file is dropped', () => {
    mount()
    chooseFile()
    fireEvent.drop(screen.getByRole('region', { name: 'Fichier Excel des élèves' }), { dataTransfer: { files: [new File(['bad'], 'invalid.csv')] } })
    expect(screen.getByRole('alert')).toHaveTextContent('Format invalide')
    expect(screen.getByRole('button', { name: 'Analyser les colonnes' })).toBeDisabled()
  })
})
