# C9 : créer une classe et revenir à l’inscription

Implémentation du 26 septembre 2026. Aucun commit effectué ; les changements sont prêts à être revus dans les deux dépôts.

## Parcours et accès

Depuis **Vie scolaire → Inscriptions → Nouvelle inscription**, sélectionner l’année active et le niveau puis cliquer sur **Créer une classe**. La fenêtre existante de création s’ouvre sur la page Classes avec le niveau prérempli. Le nom et le professeur principal restent au choix du responsable. Après la création explicite, un toast confirme la mutation et **Retour à l’inscription** ramène au formulaire avec l’identité conservée.

La fenêtre Classes reste accessible depuis **Académique → Structure scolaire → Classes → Ajouter une classe**. Aucun nouvel écran ni nouvelle route n’a été créé. Le parcours standard ne montre pas le bouton de retour contextuel. En cas d’annulation de la fenêtre, le retour explicite permet également de récupérer le brouillon sans création.

Un utilisateur qui ne possède pas `classes.create` et `classes.view` reçoit l’indication de contacter le directeur ou un responsable autorisé. Les droits API existants continuent à contrôler toutes les mutations. La liste des professeurs principaux n’est demandée que lorsque l’utilisateur peut consulter les enseignants ; le choix reste facultatif.

## Décisions vérifiées dans le code

- C7 est présent : `createStudent` n’est pas appelé avec une classe et la classe est portée par `createEnrollment`.
- `NewEnrollmentPage` n’avait pas de filtre de niveau. C9 l’ajoute et conserve la possibilité de sélectionner une classe existante, laquelle renseigne alors le niveau. Les classes proposées sont actives et filtrées par année et niveau.
- L’écran de création existant est `ClassDialog`, dans `ClassesPage`, et non une page de création distincte.
- L’inscription n’avait aucun stockage de brouillon. Les brouillons IndexedDB existants sont spécifiques aux imports ; le formulaire utilisait uniquement son état React. C9 conserve le brouillon en mémoire dans l’onglet, sans utiliser le cache TanStack, IndexedDB, localStorage, sessionStorage ou l’historique pour les données saisies.
- Le contrat initial de création de classe choisissait exclusivement l’année active. Il accepte désormais `expectedSchoolYearId`, facultatif, pour vérifier au moment de l’insertion SQL que cette année est toujours active. Le comportement standard demeure compatible.
- Les nouvelles inscriptions et modifications contextuelles transmettent `levelId` et `expectedActiveSchoolYearId`. L’API vérifie les références dans le service et de nouveau dans la mutation SQL. Les anciens contrats sans ces gardes restent compatibles, notamment les inscriptions historiques sur une année non active.

## Brouillon et revalidation

Le contexte de navigation validé contient seulement `origin`, `draftId`, `returnTo`, `schoolYearId`, `levelId`, puis éventuellement `createdClassId`. Les noms, matricules, dates et contacts ne sont jamais transportés dans une URL ou un état d’historique.

Le brouillon est isolé par UUID de dossier, utilisateur, tenant et schéma. Une déconnexion ou un changement d’identité/d’école purge la mémoire. Il expire après trente minutes et est consommé au retour validé. Les routes de retour autorisées sont exclusivement `/enrollments/new`, la même route avec un UUID `studentId`, et `/enrollments/:uuid/edit`. Toute autre URL, contexte falsifié ou cible différente est refusé.

Chaque entrée de navigation remonte le formulaire ; ouvrir un autre dossier sur la même route ne réutilise pas les données du précédent. Une actualisation efface le brouillon en mémoire et affiche un état lisible. Elle n’enregistre ni classe ni inscription. Une classe explicitement créée et confirmée reste naturellement enregistrée.

Au retour, TanStack recharge années, niveaux et classes, même si les données sont encore fraîches dans son cache. Les lectures de classes contextuelles portent `enrollmentValidation=1`, traité par une règle Workbox `NetworkOnly` avant la règle habituelle `NetworkFirst`. Un cache offline ne peut donc pas confirmer cette sélection. Les queries en pause bloquent aussi la confirmation. La nouvelle classe est sélectionnée seulement si elle est active, disponible et appartient encore à l’année active et au niveau du dossier. Une erreur, un niveau disparu, une classe archivée/supprimée ou un changement d’année bloque la sélection et explique la correction nécessaire.

## Fichiers

Frontend modifié :

- `src/modules/enrollments/NewEnrollmentPage.tsx`, `enrollments.api.ts`.
- `src/modules/academic/ClassesPage.tsx`, `academic.api.ts`, `components/AcademicDialogs.tsx`.
- `vite.config.ts` : revalidation des classes sans cache offline.
- `src/modules/enrollments/__tests__/NewEnrollmentPage.test.tsx`, `src/modules/academic/__tests__/academic.api.test.ts`.
- `e2e/critical/workflows.spec.ts` : sélection de classe par son nom accessible.

Frontend créé :

- `src/shared/lib/enrollment-class-flow.ts` : contexte, isolation, expiration et règles de retour.
- `src/modules/enrollments/__tests__/enrollment-class-flow.test.ts` et `EnrollmentClassJourney.test.tsx`.
- `e2e/critical/enrollment-class-creation.spec.ts`.
- Le présent compte rendu.

API modifiée :

- `src/modules/academic/academic.types.ts`, `academic.service.ts`, `academic.repository.ts`.
- `src/modules/enrollments/enrollments.types.ts`, `enrollments.service.ts`, `enrollments.repository.ts`.
- `tests/unit/academic.service.test.ts`, `tests/unit/enrollments.service.test.ts`.

API créée : `tests/integration/enrollment-class-creation.routes.test.ts`, utilisant `tests/integration/setup.ts` et ses vrais contrôleurs/services/repositories.

## Validation

Baseline avant modification des parcours : 23 tests frontend et 18 tests unitaires API réussis ; 6 tests d’intégration historiques réussis après préparation d’une base jetable complète.

Suites complètes réussies :

- Frontend : `npm test`, 476 tests dans 88 fichiers.
- API : `npm run test:unit -- --run`, 611 tests dans 53 fichiers.
- API : `npm run test:integration`, 422 tests dans 52 fichiers.

Après le renforcement SQL, les unités académique/inscriptions/élèves historiques ont été rejouées : 35 tests réussis. Les intégrations C9, académique, inscriptions et élèves historiques ont aussi été rejouées : 17 tests réussis. Les contrôles frontend concernés passent : 53 tests, dont isolation entre dossiers, relecture serveur retardée, annulation, erreur de création, classe archivée, niveau différent, année changée et parcours Classes standard.

Navigateur avec vraie API et PostgreSQL, sans interception HTTP : les 3 tests C9 passent, comprenant mobile Chromium tactile 393 × 851, bureau 1280 × 900, création, retour, caisse, persistance du statut confirmé, absence de retour dans le menu académique, abandon et actualisation sans mutation. Les 3 parcours critiques existants `workflows.spec.ts` passent également : inscription/caisse, notes/bulletins et notifications parent.

Les builds, typechecks, lints des deux dépôts et `git diff --check` réussissent. Le build PWA génère la règle `NetworkOnly` contextuelle. L’avertissement existant de taille de certains chunks reste présent.

Les tests utilisent uniquement PostgreSQL/Redis jetables locaux, les migrations existantes et des données fictives. Les services de développement et les fournisseurs réels n’ont pas été sollicités.

Limite : l’émulation Chromium mobile ne constitue pas une recette sur un Tecno/Itel physique. Aucun appareil physique n’est disponible dans cet environnement. Cette vérification matérielle reste à effectuer ; le parcours et les tests automatisés C9 sont livrés.

## Auto-revue des consignes standard

- Lecture intégrale du bloc standard et des références `archives/AGENTS.md`, `DESIGN.md`, `PRODUCT.md`, `PROJECT.md` effectuée. Le chemin demandé `/archives/...` a été résolu dans le dossier `archives/` du workspace.
- Périmètre limité à `edutrack-web` et `edutrack-api`. Aucun changement aux archives, menus latéraux, dépendances, secrets ou autres dépôts.
- Code réel, contrats, schémas, permissions, brouillons et cache offline inspectés avant implémentation. Les écarts du prompt ont été signalés : filtre de niveau absent et création existante dans une fenêtre.
- Parsing Zod, logique API dans les services, SQL dans les repositories. Aucun nouvel import backend entre modules, aucun accès DB ajouté au contrôleur, aucune modification du mécanisme d’authentification ou de tenant.
- Aucune migration ni modification du schéma DB. Aucune queue, notification, émission SMS/PDF/email/push ou nouvelle donnée personnelle dans les logs introduite.
- TypeScript strict, aucune utilisation de `any`, aucun token persisté. Contexte de retour validé et brouillon limité à la mémoire de la session courante.
- Composants shadcn, tokens existants, messages en français, zones tactiles ajoutées de 48 px, états de chargement/erreur/vide et toasts de mutation conservés. L’erreur de création propose « Réessayer » ; le formulaire reste ouvert. Aucun style inline, couleur hex JSX, bouton natif, `useEffect` + fetch ou animation par timer ajouté. Le timer du brouillon sert uniquement à l’expiration des données.
- Découvrabilité vérifiée dans les menus et les parcours navigateur. Réutilisation des écrans existants : aucune nouvelle route ou entrée de menu nécessaire.
- Baselines, tests unitaires, composants, intégration du parcours nominal jusqu’à la confirmation en caisse et tests navigateur réalisés. Aucun échec restant ni régression détectée dans les contrôles exécutés.
- Implémentation et validation automatisée C9 accomplies intégralement. La limite de recette matérielle est déclarée ci-dessus, sans la présenter comme réalisée.

## Message de commit proposé

`fix(enrollments): create classes explicitly and restore the enrollment draft`
