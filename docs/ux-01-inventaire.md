# UX-01 — Inventaire des pages et de leurs filtres académiques

Constat établi sur les 60 composants `*Page.tsx` de `src/modules`, avant modification des écrans UX-01. « Année » désigne un sélecteur d'année scolaire pour consulter des données ; « Période » désigne une période d'évaluation. Les valeurs « Non » n'excluent pas une année ou une période affichée comme donnée, paramètre d'URL, champ de formulaire ou période d'un autre domaine. La catégorie indique si le filtre académique déjà présent relève du composant partagé. Seuls les quatre écrans marqués **UX-01** ont été modifiés.

| Page (`src/modules/…`) | Année | Période | Catégorie | Constat |
|---|---|---|---|---|
| academic/CalculationPage | Non | Non | À discuter | Contexte reçu par URL depuis Moyennes, sans filtre local. |
| academic/ClassesPage | Oui | Non | En a besoin | Filtre année de la liste des classes. |
| academic/CompletionTrackingPage | Non | Oui | En a besoin | Sélection de période pour la complétion. |
| academic/ConductPage | Non | Oui | En a besoin | Sélection de période de conduite. |
| academic/EvaluationReviewPage | Oui | Oui | En a besoin — **UX-01** | Filtres de suivi des évaluations. |
| academic/LevelsPage | Non | Non | N'en a pas besoin | Référentiel des niveaux. |
| academic/NotesPage | Non | Oui | En a besoin | La classe détermine l'année ; période sélectionnable. |
| academic/ReportCardClaimsPage | Oui | Oui | En a besoin — **UX-01** | Filtres des réclamations. |
| academic/ReportCardsPage | Oui | Oui | En a besoin | Filtres des bulletins. |
| academic/SchoolYearsPage | Non | Non | N'en a pas besoin | Gestion des années et calendriers, pas un filtre de consultation. |
| academic/SubjectsPage | Non | Non | N'en a pas besoin | Référentiel des matières. |
| academic/TeacherAveragesPage | Non | Oui | En a besoin | Période sélectionnable dans la préparation des moyennes. |
| account/AccountPage | Non | Non | N'en a pas besoin | Compte utilisateur. |
| account/FirstLoginPasswordPage | Non | Non | N'en a pas besoin | Mot de passe initial. |
| admin/AdminAccountPage | Non | Non | N'en a pas besoin | Compte super administrateur. |
| admin/AdminMaintenancePage | Non | Non | N'en a pas besoin | Maintenance. |
| admin/AdminPage | Non | Non | N'en a pas besoin | Liste des écoles. |
| admin/AdminPlansPage | Non | Non | N'en a pas besoin | Plans. |
| admin/AdminRevenuSmsPage | Non | Non | N'en a pas besoin | Revenus SMS, sans filtre académique. |
| admin/AdminRevenuePage | Non | Non | N'en a pas besoin | Revenus plateforme, sans filtre académique. |
| admin/AdminSchoolDetailPage | Non | Non | N'en a pas besoin | Année active configurée et périodes de facturation, sans filtre académique de page. |
| admin/AdminSmsPage | Non | Non | N'en a pas besoin | SMS. |
| attendance/AttendancePage | Non | Non | N'en a pas besoin | Pointage. |
| attendance/TeacherSchedulePage | Non | Non | N'en a pas besoin | Emploi du temps du professeur. |
| auth/AdminLoginPage | Non | Non | N'en a pas besoin | Connexion administrateur. |
| auth/LoginPage | Non | Non | N'en a pas besoin | Connexion école. |
| auth/MaintenancePage | Non | Non | N'en a pas besoin | Écran de maintenance. |
| class-decisions/ClassDecisionsPage | Non | Non | À discuter | Décisions de fin d'année sur l'année de campagne, sans filtre local. |
| dashboard/DashboardPage | Oui | Oui | En a besoin | Sélecteurs locaux à la page dans son en-tête ; aucun sélecteur du layout commun. |
| dashboard/RiskDetailsPage | Non | Non | N'en a pas besoin | Détail des risques. |
| dashboard/TeacherDashboardPage | Non | Non | N'en a pas besoin | Période courante affichée, pas sélectionnable. |
| enrollments/EnrollmentDocumentsPage | Non | Non | N'en a pas besoin | Documents d'une inscription précise. |
| enrollments/EnrollmentPaymentPage | Non | Non | N'en a pas besoin | Année affichée, sans filtre. |
| enrollments/EnrollmentsPage — Dossiers | Oui | Non | En a besoin — **UX-01** | Filtre année ; « Toutes les années » existait. |
| enrollments/EnrollmentsPage — Réinscriptions | Oui | Non | En a besoin — **UX-01** | Filtre d'année d'origine clôturée. |
| enrollments/NewEnrollmentPage | Non | Non | N'en a pas besoin | Année de campagne déterminée par le formulaire, sans filtre de consultation. |
| finance/FinancePage | Oui | Non | En a besoin | Sélecteur année des vues financières. |
| finance/RecoveryPage | Oui | Non | En a besoin | Filtre année du recouvrement. |
| import-export/ImportPage | Non | Non | N'en a pas besoin | Import de données. |
| marketing/MarketingHomePage | Non | Non | N'en a pas besoin | Site public. |
| parent-portal/ParentAbsenceHistoryPage | Non | Non | N'en a pas besoin | Historique du parent. |
| parent-portal/ParentAccountPage | Non | Non | N'en a pas besoin | Compte parent. |
| parent-portal/ParentDashboardPage | Non | Non | N'en a pas besoin | Accueil parent. |
| parent-portal/ParentFirstLoginPasswordPage | Non | Non | N'en a pas besoin | Mot de passe initial parent. |
| parent-portal/ParentLoginPage | Non | Non | N'en a pas besoin | Connexion parent. |
| parent-portal/ParentNotificationsPage | Non | Non | N'en a pas besoin | Notifications parent. |
| parent-portal/ParentPaymentsPage | Non | Non | N'en a pas besoin | Sélection de l'enfant, pas de l'année. |
| parent-portal/ParentReportCardsPage | Oui | Non | En a besoin | Année des bulletins du parent. |
| parent-portal/ParentSchedulePage | Non | Non | N'en a pas besoin | Emploi du temps de l'enfant. |
| rooms/RoomsPage | Non | Non | N'en a pas besoin | Salles et QR codes. |
| salaries/SalariesPage | Non | Non | N'en a pas besoin | Filtres par mois/période de paie, pas par période d'évaluation. |
| schedule/SchedulePage | Non | Non | N'en a pas besoin | Périodes de validité de l'emploi du temps, distinctes des périodes d'évaluation. |
| settings/SettingsPage | Oui | Non | À discuter | Sélection année dans la configuration financière ; ce n'est pas une carte de filtres de consultation. |
| students/StudentDetailPage | Oui | Non | À discuter | Année consultée dans le dossier individuel ; présentation différente d'une carte de filtres. |
| students/StudentHistoryDirectoryPage | Oui | Non | En a besoin | Année dans le répertoire historique. |
| students/StudentsPage | Non | Non | À discuter | Liste courante, sans filtre année existant. |
| subscriptions/SubscriptionRevenuePage | Non | Non | N'en a pas besoin | Plage de mois pour les revenus d'abonnement. |
| subscriptions/SubscriptionsPage | Non | Non | N'en a pas besoin | Mois de souscription, pas de période d'évaluation. |
| teachers/TeacherDetailPage | Non | Non | N'en a pas besoin | Fiche professeur. |
| teachers/TeachersPage | Non | Non | N'en a pas besoin | Liste des professeurs. |
| validations/ValidationsPage | Non | Non | N'en a pas besoin | Validations de présence. |

Les cas « à discuter » n'ont reçu aucun nouveau filtre. Les autres pages dotées de filtres académiques sont inventoriées mais laissées intactes selon le périmètre UX-01 de quatre écrans.
