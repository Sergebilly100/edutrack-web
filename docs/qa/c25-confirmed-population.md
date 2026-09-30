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
| Élèves et absences | `/students`, `/students/:id`, `/attendance/students`, `/students/absence-stats`, `/students/absence-stats/export` | Même population dans liste, détail, absence, impression et export. |
| Finance, recouvrement, encaissements, journal et historique | `/finance/financial-summary`, `/finance/recovery`, `/finance/recovery/class-students`, `/payments/cash-journal`, `/payments/cash-journal/export`, `/finance/payment-history` | Comparer les élèves scolarisés sur la même année ; garder le paiement d'un dossier à confirmer dans le parcours d'inscription. |
| Abonnements et portail parent | `/subscriptions/classes`, `/subscriptions/students`, `/parent/students` | Une inscription non confirmée ne crée pas d'élève scolarisé ni de droit parent scolaire. |
| Paramètres école | `/settings/*` | Aucun effectif ni liste scolaire dans les onglets, dialogues ou tour guidé. Les textes SMS restent inchangés. |

## Point de contrat à trancher

`GET /students/:id` renvoie actuellement un profil en attente ou historique lorsqu'on connaît son identifiant. C'est couvert volontairement par `student-roster.routes.test.ts` et utilisé par le formulaire de réinscription. La route web `/students/:id` consomme le même endpoint pour une fiche scolaire. Tant que la portée de cette fiche n'est pas décidée, un lien direct peut encore afficher un dossier sans inscription confirmée. La liste `/students`, les filtres et ses compteurs ne présentent pas ce dossier.

## Scénarios de recette navigateur

Sur deux années scolaires et une classe par année, préparer un profil historique sans inscription et quatre dossiers représentant chacun des statuts `pending_cashier`, `pending_dossier`, `blocked_unpaid` et `confirmed`. Pour chaque ligne du tableau, ouvrir la route, ses filtres, dialogues, vues imprimables et exports, puis vérifier :

1. Avant confirmation, les trois dossiers non confirmés restent dans Inscriptions. Les parcours scolaires affichent zéro ou seulement l'élève déjà confirmé. L'état vide explique qu'aucune inscription n'est confirmée.
2. Confirmer un dossier en caisse dans la session. Sans recharger le navigateur, revenir à Classes, Élèves, Dashboard, Bulletins, Évaluations, Notes, Conduite, Fin d'année, Absences, Risques et Finance. L'effectif augmente d'une seule unité dans l'année et la classe visées ; l'autre année ne change pas.
3. Refaire le parcours avec un ancien cache Workbox des classes et un réseau lent. Le choix de classe au moment de l'inscription exige le serveur ; après confirmation, les anciennes réponses de population ne réapparaissent pas.
4. Vérifier les états vides, sélecteurs et dialogues à 320, 360 et 393 px, sans débordement horizontal.

Les tests Vitest couvrent l'invalidation de toutes les familles, les deux années, la purge du cache, les compteurs de classe, l'état vide du dashboard et celui des bulletins. Le test Playwright autonome `c25-population-mobile.spec.ts` vérifie les cartes, le dialogue de classe et l'absence de débordement aux trois largeurs mobiles avec des réponses API simulées. `director/students.spec.ts` vérifie le total serveur et le passage à la 21e fiche après pagination à 320 px. Le scénario réel `enrollment-class-creation.spec.ts` contrôle la confirmation et l'effectif de la classe sans rechargement aux mêmes largeurs. Son exécution complète requiert l'API et la base de recette.
