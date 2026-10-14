# UX-02 — portée des jetons de contraste

Le changement de `--input` et des états visuels dans `src/index.css` s'applique à tous les champs et boutons shadcn correspondants. Inventaire établi à partir des pages `*Page.tsx` qui importent directement `input`, `select`, `textarea` ou `button` : **56 pages**, dont les trois pages modifiées pour les filtres (quatre vues avec les deux onglets Inscriptions). Les 53 autres pages sont listées ci-dessous. Les composants intermédiaires peuvent étendre cette portée.

| Module | Autres pages touchées par le thème |
|---|---|
| Académique | `CalculationPage`, `ClassesPage`, `CompletionTrackingPage`, `ConductPage`, `LevelsPage`, `NotesPage`, `ReportCardsPage`, `SchoolYearsPage`, `SubjectsPage`, `TeacherAveragesPage` |
| Compte et connexion | `AccountPage`, `FirstLoginPasswordPage`, `AdminLoginPage`, `LoginPage` |
| Administration | `AdminAccountPage`, `AdminMaintenancePage`, `AdminPage`, `AdminPlansPage`, `AdminRevenuSmsPage`, `AdminSchoolDetailPage`, `AdminSmsPage` |
| Vie scolaire et pilotage | `TeacherSchedulePage`, `ClassDecisionsPage`, `DashboardPage`, `RiskDetailsPage`, `TeacherDashboardPage` |
| Inscriptions, hors onglets cités | `EnrollmentDocumentsPage`, `EnrollmentPaymentPage`, `NewEnrollmentPage` |
| Finance | `FinancePage`, `RecoveryPage`, `SalariesPage`, `SubscriptionRevenuePage`, `SubscriptionsPage` |
| Import | `ImportPage` |
| Portail parent | `ParentAbsenceHistoryPage`, `ParentAccountPage`, `ParentDashboardPage`, `ParentFirstLoginPasswordPage`, `ParentLoginPage`, `ParentNotificationsPage`, `ParentPaymentsPage`, `ParentReportCardsPage`, `ParentSchedulePage` |
| Structure, élèves et enseignants | `RoomsPage`, `SchedulePage`, `SettingsPage`, `StudentDetailPage`, `StudentHistoryDirectoryPage`, `StudentsPage`, `TeacherDetailPage`, `TeachersPage`, `ValidationsPage` |

Les ratios des couples de couleurs clairs et sombres sont consignés dans la section 11 de `archives/DESIGN.md`. Le calcul sRGB confirme 5,24:1 au minimum pour les aides sur le fond teinté retenu. Une vérification visuelle sur appareil Android réel reste nécessaire pour juger le rendu sous forte luminosité.
Une page témoin chargée avec le CSS compilé dans Chromium (profil Pixel 5) a confirmé les couleurs calculées des contrôles en clair et en sombre, ainsi que l'absence de débordement horizontal sur cette page témoin.
