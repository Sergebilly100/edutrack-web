# C25 — Effectif scolaire confirmé

## Contrat lu dans le code

`confirmedSchoolStudent` et `confirmedSchoolClassCount` dans l'API C24 prennent l'année scolaire et, si nécessaire, la classe. Ils comptent des élèves distincts avec une inscription `confirmed` et ignorent le rattachement historique du profil. Les quatre statuts d'inscription restent visibles dans `/enrollments` : `pending_cashier`, `pending_dossier`, `blocked_unpaid`, `confirmed`.

L'intégration API existante `edutrack-api/tests/integration/student-roster.routes.test.ts` prépare les quatre statuts, un profil historique, une classe vide et une deuxième année. Elle compare notamment `/students`, `/classes`, `/dashboard/pilotage`, `/risk/students`, `/subscriptions/students`, `/report-cards/readiness` et les absences. Son exécution nécessite PostgreSQL et Redis de recette.

Le client ne filtre pas les réponses scolaires par statut. `SchoolClass.studentCount` désigne les élèves distincts confirmés dans `SchoolClass.schoolYear.id` et la classe. `/students` utilise le total et la pagination de l'API, avec 20 élèves par page ; les petits compteurs « affichés » concernent uniquement la page courante. Le paramètre `enrollmentValidation=1` du choix de classe d'inscription reste `NetworkOnly` dans Workbox. La confirmation purge les anciens replis Workbox de classes, élèves, dashboard, présence du jour et abonnements, puis invalide les familles TanStack Query de population pour toutes les années et classes. Les données de population sont réinitialisées avant relecture des requêtes actives et la copie IndexedDB est immédiatement réécrite ; les référentiels statiques de l'école sont conservés.

## Parcours et requêtes à contrôler

| Parcours | Lectures utilisées | Vérification |
| --- | --- | --- |
| Dashboard, performance, risques | `/dashboard/pilotage?schoolYearId&gradingPeriodId`, `/students`, `/risk/students`, `/finance/financial-summary?school_year_id` | Effectif et moyennes de la même année ; zéro confirmé expliqué ; niveaux fournis par l'API conservés. |
| Classes et choix d'inscription | `/classes?schoolYearId`, `/classes?schoolYearId&enrollmentValidation=1` | `studentCount` exclut les dossiers ; relecture serveur au choix critique. |
| Bulletins | `/report-cards/readiness?grading_period_id`, `/report-cards/completion`, `/report-cards/class/:id` | `headcount` et complétude n'incluent que les inscrits confirmés ; génération désactivée à zéro. |
| Évaluations, notes, moyennes et notes spontanées | `/evaluations/scope?classId&gradingPeriodId`, `/academic/evaluations/options`, `/academic/evaluations`, `/academic/evaluations/spontaneous`, `/students` | Sélections, notes et calculs limités par C24 à l'année et la classe. |
| Conduite et fin d'année | `/conduct/inputs/scope`, `/conduct/students/:id/overview`, `/class-decisions/review-status`, `/class-decisions` | Aucun dossier en attente dans les sélections, la décision ou les exports dérivés. |
| Élèves et absences | `/students`, `/students/:id/school-profile`, `/attendance/students`, `/students/absence-stats`, `/students/absence-stats/export` | Même population dans liste, fiche scolaire active, absence, impression et export. |
| Finance, recouvrement, encaissements, journal et historique | `/finance/financial-summary`, `/finance/recovery`, `/finance/recovery/class-students`, `/payments/cash-journal`, `/payments/cash-journal/export`, `/finance/payment-history` | Comparer les élèves scolarisés sur la même année ; garder le paiement d'un dossier à confirmer dans le parcours d'inscription. |
| Abonnements et portail parent | `/subscriptions/classes`, `/subscriptions/students`, `/parent/students` | Une inscription non confirmée ne crée pas d'élève scolarisé ni de droit parent scolaire. |
| Paramètres école | `/settings/*` | Aucun effectif ni liste scolaire dans les onglets, dialogues ou tour guidé. Les textes SMS restent inchangés. |

## Fiches courantes et anciennes

`GET /students/:id` reste la lecture générale du dossier utilisée dans les inscriptions. La fiche scolaire `/students/:id` utilise `GET /students/:id/school-profile`, qui répond 404 sans inscription confirmée dans l'année active. Un lien direct vers une fiche non inscrite explique la situation et oriente vers Réinscriptions.

Le bouton « Voir dossier » de Réinscriptions ouvre `/enrollments/re-enrollment/students/:studentId`. L'API `GET /students/:id/historical-profile` exige `enrollments.view` et une inscription confirmée dans une année close. La fiche historique affiche l'année scolaire en cours, le fait que l'élève y soit inscrit ou non, sa dernière année confirmée, le parcours et la situation financière de chaque année. Un sélecteur permet de consulter une année précise, ou toutes les années : la classe et l'année de l'en-tête, les finances, absences, bulletins, documents datés, événements et notifications suivent cette sélection. Les contacts parents restent les coordonnées actuelles du dossier. Elle conserve les onglets du dossier complet : absences, fil d'activité, documents disponibles, bulletins publiés, contacts et notifications parents. Chaque bulletin peut être consulté en détail et téléchargé en PDF. Les données et soldes des années closes restent consultables même si le profil élève ou son ancienne classe est inactif, ou qu'une réinscription récente attend sa confirmation. La consultation historique est en lecture seule dans l'interface. Les documents de type inscription sont rattachés au profil et les documents partagés restent visibles selon les permissions ; les fichiers remplacés avant ce correctif ne peuvent pas être recréés. Un document ajouté après la clôture de son année apparaît selon sa date d'ajout ou dans « Toutes les années ».

La fiche scolaire courante ajoute l'état des échéances et respecte les permissions financières du rôle. Elle expose également les bulletins publiés de l'année active dans l'onglet « Bulletins » si le rôle peut les consulter.

### Aperçu sans données historiques réelles

Le test navigateur autonome `c25-reenrollment-profile.spec.ts` prépare trois années closes, une réinscription en attente, des absences, un document, deux bulletins publiés et des soldes annuels fictifs. Il vérifie la sélection de l'année, le détail d'un bulletin, le lancement du PDF et les largeurs 320, 360 et 393 px. Lancer `C25_CAPTURE_DEMO=1 npx playwright test e2e/director/c25-reenrollment-profile.spec.ts --project=director-tests` depuis `edutrack-web` pour régénérer les captures suivantes avec ces données fictives :

- [Fiche historique, année 2025-2026](./c25-dossier-historique-demo.png)
- [Bulletins publiés, année 2025-2026](./c25-bulletins-historiques-demo.png)
- [Détail du bulletin publié](./c25-bulletin-detail-demo.png)

## Scénarios de recette navigateur

Sur deux années scolaires et une classe par année, préparer un profil historique sans inscription et quatre dossiers représentant chacun des statuts `pending_cashier`, `pending_dossier`, `blocked_unpaid` et `confirmed`. Pour chaque ligne du tableau, ouvrir la route, ses filtres, dialogues, vues imprimables et exports, puis vérifier :

1. Avant confirmation, les trois dossiers non confirmés restent dans Inscriptions. Les parcours scolaires affichent zéro ou seulement l'élève déjà confirmé. L'état vide explique qu'aucune inscription n'est confirmée.
2. Confirmer un dossier en caisse dans la session. Sans recharger le navigateur, revenir à Classes, Élèves, Dashboard, Bulletins, Évaluations, Notes, Conduite, Fin d'année, Absences, Risques et Finance. L'effectif augmente d'une seule unité dans l'année et la classe visées ; l'autre année ne change pas.
3. Refaire le parcours avec un ancien cache Workbox des classes et un réseau lent. Le choix de classe au moment de l'inscription exige le serveur ; après confirmation, les anciennes réponses de population ne réapparaissent pas.
4. Vérifier les états vides, sélecteurs et dialogues à 320, 360 et 393 px, sans débordement horizontal.

Les tests Vitest couvrent l'invalidation de toutes les familles, les deux années, la purge du cache, les compteurs de classe, l'état vide du dashboard et celui des bulletins. Les tests de fiche vérifient le refus des dossiers non confirmés dans l'année active, l'accès historique depuis Réinscriptions, trois années passées et leurs finances. Le test Playwright autonome `c25-population-mobile.spec.ts` vérifie les cartes et le dialogue de classe aux trois largeurs mobiles ; `c25-reenrollment-profile.spec.ts` vérifie la fiche historique complète, ses documents et le fil d'activité aux mêmes largeurs. `director/students.spec.ts` vérifie la pagination, le blocage d'un accès direct non confirmé et les finances de la fiche courante à 320, 360 et 393 px. Le scénario réel `enrollment-class-creation.spec.ts` contrôle la confirmation et l'effectif de la classe sans rechargement. Son exécution complète requiert l'API et la base de recette.
