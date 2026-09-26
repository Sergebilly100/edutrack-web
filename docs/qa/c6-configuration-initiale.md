# C6 : configuration initiale guidée par l’état réel

Correctif implémenté le 26 septembre 2026 dans `edutrack-web` et `edutrack-api`.

## Comportement livré

L’assistant conserve cinq étapes : informations école, référentiel, salles et frais, profils professeurs, finalisation. Les boutons d’étapes indiquent la navigation ; la liste « Prérequis de configuration » indique exclusivement l’état relu depuis l’API. Une étape consultée ne constitue jamais une validation.

Minimum requis : nom école (2 caractères), adresse (3), téléphone du directeur utilisé par l’API école (6), année de statut `active`, un niveau, une matière, une salle active et un plan de frais rattaché à cette année. Ces longueurs reprennent la validation existante de `/school/info`. Un plan de frais suffit ; le correctif n’exige pas de plan pour chaque niveau. Les profils professeurs sont facultatifs.

Sans année active, le message nomme le super administrateur et la finalisation est bloquée. Aucune commande de création ou d’ouverture d’année n’est ajoutée. La règle d’ouverture déjà livrée reste inchangée.

Les liens vers Niveaux, Matières, Salles, Frais et Import professeurs portent `returnTo=/onboarding?step=…&school=…`. Chaque destination affiche « Retour à la configuration initiale ». Le retour vérifie le chemin interne, l’étape et l’identité réelle de l’école ; il relit les données à l’ouverture de l’assistant. L’onglet Finance et le type d’import sont conservés. Depuis ce parcours, l’import est limité aux profils et contrats professeurs.

Le formulaire existant d’informations école est conservé. Aucun ajout rapide de professeur, élève ou créneau n’est proposé. Après la configuration, la suite annoncée est : premières inscriptions avec création des classes, affectations individuelles professeur–matière–classes, désignation du professeur principal, puis import EDT.

## Données, isolation et droits

Aucune synthèse existante ne couvrait ces prérequis. `GET /api/v1/school/onboarding-status` fournit des booléens d’existence, sans stocker de compteurs. La lecture est dans `OnboardingRepository`, la règle de finalisation dans `OnboardingService`, le transport HTTP dans `school.controller.ts`. La lecture utilise `request.db`, résolu depuis les claims du tenant. La finalisation relit les mêmes prérequis dans une transaction avant de marquer l’école terminée. Une demande prématurée renvoie `409 ONBOARDING_PREREQUISITES_MISSING`, le message et la liste `missing`.

Les écritures `/school/info`, `/school/onboarding-complete` et la lecture de synthèse exigent `settings.school`. Les liens exigent les permissions de lecture et de création/modification de leur destination. Les permissions API existantes des écrans de configuration restent appliquées.

Le stockage devient `onboarding_progress:v2:<UUID école>`. Il contient seulement `{ step }`, aucun brouillon de coordonnées ni état « terminé ». L’ancien `onboarding_progress`, sans identité fiable, est supprimé et jamais migré. Le JSON invalide et un stockage indisponible sont tolérés. Les requêtes école sont séparées par contexte de session, celles des prérequis par UUID école. La finalisation nettoie la clé et met à jour le cache de l’école concernée.

## Fichiers concernés

- Web : `modules/onboarding/OnboardingWizard.tsx`, `onboarding.api.ts`, nouveaux `onboarding.progress.ts` et `OnboardingReturn.tsx`.
- Retours sur les écrans existants : `academic/LevelsPage.tsx`, `academic/SubjectsPage.tsx`, `rooms/RoomsPage.tsx`, `settings/SettingsPage.tsx`, `import-export/ImportPage.tsx`. Texte profils/contrats dans `ImportWizard.tsx`.
- API : `school/school.controller.ts`, nouveaux `onboarding.repository.ts` et `onboarding.service.ts`.
- Tests : trois suites frontend onboarding, recette `e2e/director/onboarding.spec.ts`, nouvelles suites API `onboarding.service.test.ts` et `onboarding.routes.test.ts`, données de préparation ajustées dans `qa.school-workflows.routes.test.ts` et `import.test.ts`.

Aucun nouvel écran : l’assistant reste accessible à la connexion du directeur tant que l’école n’a pas terminé sa configuration. Ses liens ouvrent les écrans existants Structure scolaire → Niveaux/Matières, Salles, Paramètres → Finance et Import. Aucun changement de style du menu latéral.

## Vérification

Baseline avant modifications : 76 tests frontend des modules concernés et 49 tests unitaires API réussis. Les anciens tests navigateur attendaient encore le titre V1, l’ajout rapide professeur et les étapes EDT ; ils ont été remplacés par la recette C6. La baseline d’intégration n’a pas pu démarrer sans `DATABASE_URL_TEST` et schéma public. Les migrations existantes ont ensuite initialisé une base PostgreSQL temporaire dédiée ; aucune donnée de travail n’a été utilisée.

Les trois anciens scénarios d’import EDT omettaient l’année active et/ou les affectations explicites exigées par la règle existante. Seules leurs données de préparation ont été corrigées. F35 a été adapté à la finalisation désormais conditionnée aux prérequis réels.

Résultats finaux :

- 123 tests frontend, dont 47 nouveaux tests de progression, prérequis, erreurs, droits et retours.
- 98 tests API : règles C6, parcours réel après ouverture par le super administrateur, refus directeur/staff de cette ouverture, fermeture d’année, configuration, académique et imports.
- 8 tests navigateur Chrome mobile émulé : absence d’année, parcours avec création de niveau et finalisation sans professeur, quatre autres destinations, deux sessions d’écoles sur le même navigateur, import réussi avec retour à l’étape 4.
- TypeScript et ESLint ciblés API/web, build frontend et vérification des diffs.

Les tests navigateur utilisent des réponses API simulées ; les tests d’intégration utilisent Fastify, PostgreSQL et Redis réels sur une base temporaire. La petite largeur 360×640 est vérifiée sans débordement horizontal. Les captures sont dans `edutrack-web/.tmp/c6-sans-annee-mobile.png` et `.tmp/c6-finalisation-mobile.png`. Aucun appareil physique Tecno/Itel n’a été utilisé.

## Auto-revue

Les consignes standard applicables sont respectées : périmètre API/web, exploration du code existant, séparation controller/service/repository pour la nouvelle logique, isolation tenant, permissions, TypeScript strict sans nouveau `any`, API centralisée et TanStack Query, composants shadcn et tokens existants, états de chargement/erreur/succès, commandes tactiles de l’assistant à 48px, tests de règle et parcours critique. Aucun changement de schéma, de règle d’ouverture d’année, de queue, de SMS/PDF, de journalisation personnelle ou de secret. Les suppressions d’archives préexistantes n’ont pas été touchées.

Aucune régression détectée dans les suites ciblées. Le correctif C6 et sa recette automatisée sont accomplis. La vérification sur téléphone physique reste une limite explicite de la recette.

Message de commit proposé : `fix(onboarding): vérifier les prérequis et isoler la progression par école`.
