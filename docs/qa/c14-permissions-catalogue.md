# C14 — Catalogue backend et matrice de permissions

## Résultat et contrats

`PERMISSION_KEYS` reste le seul catalogue de référence. `permissions.catalogue.ts` décrit les domaines et les libellés des 66 clés dans un `Record` exhaustif : une nouvelle clé sans définition fait échouer TypeScript. Un contrôle de type vérifie aussi que chaque `PermissionKey` accepté par les gardes API figure dans `PERMISSION_KEYS`.

`GET /api/v1/permissions/catalogue`, protégé par `settings.positions`, expose le contrat version 1. Chaque entrée contient `key`, `domain`, `domainLabel`, `label`, `requiredPermissions`, `activationDependencies`, `available` et `unavailableReason`. Le contrat est validé côté frontend : version inconnue, doublons et dépendances incohérentes bloquent la matrice et la soumission. Les nouvelles entrées du contrat sont affichées automatiquement, sans liste frontend de clés, catégories ou actions.

La matrice présente les domaines dans des accordéons indépendants, initialement repliés, à partir des groupes du catalogue. Chaque en-tête indique les droits disponibles sélectionnés et le nombre de droits indisponibles. Ouvrir ou replier un groupe ne modifie aucune attribution ; la sélection collective fonctionne séparément, même quand le groupe est replié. Les cases mesurent 16 × 16 px, avec des libellés cliquables et des zones de 48 px minimum. Les explications des dépendances restent affichées dans chaque groupe ouvert. Les composants shadcn `Collapsible`, `Button` et `Checkbox` existants sont réutilisés.

`settings.sms_templates` dépend de l’autorisation plateforme `can_edit_sms_template`, conformément aux contrôles existants de l’édition des modèles. Les sept droits `subscriptions.*` nécessitent simultanément `school_sms_features.is_enabled` et `monetize_parent_alerts`. Les plans financiers `subscription_plans.*` conservent leurs contrôles existants : leurs routes ne sont pas conditionnées au service SMS Parents. Les règles et leurs états d’activation sont visibles dans la matrice, y compris quand le service est indisponible.

La sauvegarde valide chaque clé côté service. Une permission indisponible provoque un `403 PERMISSION_FEATURE_UNAVAILABLE`, sans écriture partielle ni retrait silencieux. Une clé inventée provoque un `400`. L’interface guide la sélection et conserve les dépendances de lecture déjà utilisées ; le serveur reste l’autorité de sauvegarde et d’autorisation. Aucune dépendance de lecture n’est ajoutée implicitement aux rôles par le backend.

Les lectures des postes renvoient leurs attributions réellement enregistrées. Un droit devenu inactif reste visible avec un texte explicite, une case désactivée non cochée et une action de retrait volontaire. La sélection collective ignore les droits indisponibles. Le renommage seul omet `permissions` dans la requête, ce qui préserve les attributions historiques. Modifier les droits nécessite de retirer explicitement une attribution devenue indisponible. Aucune migration, réécriture des rôles ou modification des règles existantes de résolution des droits effectifs n’est introduite.

`conduct.finalize` reste exclusif à un seul poste selon la règle existante. Création et mise à jour vérifient le détenteur sous un verrou transactionnel PostgreSQL par école. Deux attributions simultanées donnent un succès et un conflit. Le poste courant est exclu du conflit lorsqu’il conserve le droit. Le texte métier `CONDUCT_FINALIZE_ALREADY_HELD` est inchangé et affiché intégralement par le formulaire.

## Séparation école / administration

`GET /api/v1/permissions/config/school`, protégé par `settings.school`, renvoie uniquement `{ school }`. Cette lecture et les réponses des mutations école ne consultent ni les postes, ni la liste des utilisateurs, ni les compteurs des utilisateurs administratifs.

`GET /api/v1/permissions/config` et les lectures/mutations des postes et utilisateurs restent protégés par `settings.positions`. Les consommateurs frontend sélectionnent explicitement la lecture école ou administrative selon leur section et leurs droits. Les clés TanStack Query distinguent ces contrats. Aucun `403`, `404` ou autre échec ne déclenche une lecture administrative de repli. L’écriture école utilise son endpoint dédié, sans repli.

Le sélecteur de mois utilise la lecture école dédiée lorsqu’il a `settings.school`, sinon sa lecture d’informations école existante. Il ne tente plus de charger des postes. Les états de chargement, d’erreur avec nouvelle tentative, les listes vides et les confirmations de mutation utilisent les composants existants. La modale bloque sa soumission sans catalogue valide et conserve son défilement sur mobile jusqu’à la dernière permission.

Écart confirmé avec le contexte initial : le code retirait silencieusement les droits SMS/abonnements à la sauvegarde et à la lecture. Ces comportements sont remplacés par un refus explicite à la sauvegarde et la conservation des attributions à la lecture. Autre point découvert : le client Axios transforme les erreurs en `ApiError`. La matrice reconnaît son statut `403`, et le formulaire reprend son message métier via `Error.message`.

## Fichiers créés et modifiés

- API : `permissions.catalogue.ts` créé ; `permissions.types.ts`, `permissions.repository.ts`, `permissions.service.ts` et `permissions.controller.ts` modifiés.
- Tests API : `tests/unit/permissions.catalogue.test.ts` et `tests/integration/permissions.catalogue.routes.test.ts` créés ; `tests/unit/permissions.service.test.ts` adapté au refus explicite et étendu à chaque clé sauvegardable.
- Frontend : `permission-catalogue.ts` créé ; `RoleMatrix.tsx`, `PositionFormModal.tsx`, `SchoolConfigPanel.tsx`, `SettingsPage.tsx`, `settings.api.ts` et `useSchoolYearMonths.ts` modifiés.
- Tests frontend : `RoleMatrix.test.tsx`, `PositionFormModal.test.tsx`, `permission-catalogue.test.ts` et `e2e/review/permission-catalogue.spec.ts` créés ; `settings.school.api.test.ts` étendu.
- Ce compte rendu.

## Vérification

Baseline avant modification : 78 tests unitaires ciblés backend et 43 tests frontend réussis. Les intégrations ont d’abord été bloquées par l’absence de `DATABASE_URL_TEST`. PostgreSQL et Redis ont ensuite été lancés sur des ports locaux dédiés, avec une base entièrement jetable et le schéma public initialisé par Drizzle Kit ; aucune base existante n’a été utilisée.

Validation C14 et non-régression :

La dernière exécution a obtenu **582 tests frontend**, **216 tests API ciblés** (115 unités et 101 intégrations) et **5 parcours Chromium**, tous réussis. L’affinement en accordéons est vérifié par 30 tests des paramètres, la suite frontend complète et les cinq parcours navigateur ; il ne modifie aucun contrat ni contrôle backend.

- Exhaustivité et unicité des clés, huit combinaisons d’activation, sauvegarde de chacune des 66 clés, refus à la création et à la mise à jour, conservation des lignes refusées et des rôles historiques.
- Parcours API réel de création, modification, relecture, attribution au staff et vérification de ses permissions.
- Lecture/mutation école avec `settings.school` seul, refus des accès administratifs, séparation inverse des mutations école, conflits de conduite séquentiels et concurrents, retrait puis réattribution du droit exclusif.
- Suite frontend complète et suites API ciblées présence, conduite, finance, paramètres, rôles et abonnements.
- Cinq parcours Chromium : 360, 393 et 1280 px, accordéons initialement repliés, ouverture complète des 66 lignes sans doublon, maintien des sélections après repli, navigation par Entrée/Espace, dernière ligne atteignable, cases de 16 × 16 px avec zones cliquables de 48 px minimum, absence de débordement global ; modification école avec `settings.school` seul sans requête administrative ; refus du catalogue sans sauvegarde.
- Lint des fichiers concernés, typage et builds API/web réussis.

La suite unitaire backend globale a obtenu **752 succès et un échec hors C14** dans `tests/unit/demo.config.test.ts` : `DEMO_MIGRATION_REVIEW_REQUIRED`. Les migrations existantes `0077_risk_schema_declarations.sql` et `0078_teacher_lateness.sql` sont absentes du manifeste `src/shared/database/demo/migrations.manifest.json`. C14 ne modifie ni les migrations ni ce manifeste ; cet échec est indépendant des permissions. La réussite globale de cette suite n’est pas revendiquée.

Les contrôles Chromium mobiles ne remplacent pas une recette sur un Tecno/Itel physique, non disponible dans cette session.

## Auto-revue

Les consignes standard ont été lues intégralement depuis `archives/ivoiredu-v2/codex-00-consignes-standard.md`, ainsi que AGENTS, PRODUCT, PROJECT et DESIGN. Le correctif applicatif est intégralement réalisé dans `edutrack-api` et `edutrack-web`.

Le découpage controller/service/repository, les routes `/api/v1`, les erreurs `{ error, code, statusCode }`, les gardes backend et les identifiants utilisateur existants sont conservés. Aucun nouvel import croisé entre modules backend, SQL hors repository, schéma modifié manuellement, migration de droits, dépendance, secret, log personnel, notification synchrone ou changement des queues n’est introduit. Les nouveaux handlers utilisent `request.user` avec `schemaName`, sans utilisation de `.id`.

L’interface réutilise shadcn et les tokens existants, avec états visibles, accessibilité clavier, explications textuelles, toasts et cibles de 48 px. Aucun bouton natif, style inline, hex dans le JSX, fetch via effet React ou stockage de token n’est ajouté. Le skill impeccable a été appliqué aux états de l’interface existante, sans refonte ni asset visuel. La logique de sélection et les règles backend sensibles ont leurs tests unitaires et des parcours d’intégration. Aucune régression n’est détectée dans les modules concernés ; les limites de validation globale et matérielle sont explicites ci-dessus.

Aucun nouvel écran n’est créé. La matrice est accessible depuis **Administration → Paramètres → Personnel → Nouveau poste / Modifier le poste**. Les informations école restent accessibles depuis **Administration → Paramètres → Général**, notamment pour le staff ayant seulement `settings.school`. Le style du menu latéral n’est pas modifié.

## Message de commit proposé

`fix(permissions): générer la matrice depuis le catalogue backend et séparer les paramètres école`

Pour l’affinement visuel : `ui(settings): regrouper les permissions en accordéons compacts`
