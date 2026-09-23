# Auto-revue QA

Périmètre : les 37 fonctionnalités disponibles ou disponibles avec limite connue de l’[inventaire figé](inventaire-reference.md), dans `edutrack-api` et `edutrack-web`. Les quatre fonctionnalités parent annoncées inaccessibles restent exclues. La demande complémentaire de corriger les incohérences constatées est intégrée.

## Revue des consignes standard

| Consigne | Vérification et résultat |
|---|---|
| Lecture préalable et code réel | Consignes standard, AGENTS/PRODUCT/PROJECT/DESIGN et modules/tests concernés examinés avant les compléments. Inventaire copié intégralement, comparaison exacte vérifiée. |
| Cartographie avant ajout | Baseline et manques consignés par F01–F37 ; distinction unitaire/composant/contrat HTTP/API persistée/navigateur. Résultats finaux ajoutés séparément. |
| Périmètre | Modifications livrées uniquement dans les deux dépôts autorisés. Aucun fichier d’archives modifié. Aucun commit ni déploiement effectué. |
| Architecture API | Règles dans les services, SQL ajouté dans les repositories. La route de configuration parent délègue désormais au service puis au repository tenant. Aucun import de production direct entre modules ajouté. |
| Pédagogie et conduite | Le verrouillage des notes et le routage vers la période suivante sont imposés dans le service API. La consultation de conduite part des affectations actives et inclut les absences de saisie ; la décision finale est refusée côté serveur tant que la collecte est incomplète. |
| Isolation et identité | Accès tenant via `withTenantSchema`, contexte utilisateur existant préservé ; tests de refus parent étranger, direction, staff sans droit et révocation réelle. |
| Erreurs et notifications | Contrat d’erreur existant conservé. SMS mis en file, exceptions non bloquantes et suivi distinct de chaque canal. Aucun nouvel envoi synchrone ni nouvelle queue. |
| Canaux existants | SMS et in-app financiers corrigés. Web Push considéré : aucune nouvelle fonctionnalité/canal introduit, aucune promesse de réception Push ajoutée ; réception externe réservée à la recette. |
| Schéma | Aucune migration ni modification du modèle de données. Fixtures créées via les migrations existantes. Correction de l’upsert parent sur une colonne réellement présente. |
| Confidentialité | Journaux de relance ajoutés : UUID et canal seulement ; pas de numéro/nom/message fournisseur dans les logs applicatifs. Les messages destinés aux familles restent dans leur stockage métier. Clés JWT générées à chaque harness ; préfixe de clé retiré du diagnostic. |
| Tests et secrets versionnés | `.gitignore` corrige l’exclusion des tests, conserve l’exclusion des sessions `.auth`, rapports, fichiers locaux et secrets. Les tests déjà présents mais ignorés ne sont pas présentés comme nouvellement écrits. |
| UI | Composants existants conservés ; noms accessibles des icônes et sélecteurs, onglets de paramètres adaptés au mobile, action d’inscription rétablie. Aucun nouveau token/style de barre latérale ni nouvel écran. |
| Chargement/erreur | Finance parent : attente explicite, absence d’année signalée, absence de fausse annonce « aucun paiement » avant réponse. Réutilisation de TanStack Query et des composants d’état existants. |
| Accessibilité des parcours | Inscription depuis **Vie scolaire → Inscriptions → Nouvelle inscription** ou l’état vide des élèves ; bulletin depuis **Académique → Bulletins**, puis lien d’accueil du parent après publication ; relance depuis la cloche **Voir les notifications** du portail parent vers **Paiements**. Aucun nouvel écran à rattacher au menu. |
| Non-régression | Suites complètes exécutées, puis contrôles ciblés des derniers ajustements. Échecs initiaux réparés par mise à jour des attentes obsolètes ou correction du comportement, sans masquer les assertions. Chiffres et commandes dans la cartographie. |
| Unitaire métier | Règles documentaires, transitions d’inscription, bornes financières/conduite, contenu des rappels et indépendance des canaux. Aucun test ajouté pour une simple délégation sans règle. |
| Intégration | Parcours réels avec PostgreSQL : appel/justification, salles/QR, postes/droits, économies de paie, reprise, destinataires/lecture/reprises des rappels et année financière parent. |
| Navigateur | Playwright était déjà disponible ; aucun framework installé. Parcours critiques avec API réelle et base jetable, complétés par les tests d’interface historiques. |
| Recette manuelle | 37 fiches avec prérequis, étapes numérotées, attentes et signes de bug ; formulaire de résultat et prérequis externes. Document utilisable sans lire le code. |
| Chrome Android réel | **Non exécuté sur appareil physique** : aucun Tecno/Itel n’est accessible dans cet environnement. Émulation mobile Chromium exécutée ; caméra/GPS/réseau et téléchargement à vérifier avec les fiches indiquées. |

## Points examinés lors de la revue

- L’inventaire affirmait que les relances in-app arrivaient à la direction. Le dépôt courant ciblait déjà les parents ; la documentation a été corrigée et l’isolement testé. Les défauts réellement reproduits ont été corrigés : faux retard préventif, rappel d’échéance couverte, échec bloquant le rejeu d’un canal, mauvais identifiant d’année financière et cache de bulletin obsolète.
- Le test historique d’économie était hors sélection et recalculait lui-même ses attentes. Il est remplacé par quatre cas qui passent par la vraie route et les requêtes SQL.
- Les anciens tests ignorés d’un écran enseignant supprimé et les squelettes hors connexion ont été retirés/remplacés par des tests exécutables du flux actuel. La duplication d’EDT reste testée en API, car aucun bouton correspondant n’existe dans l’interface.
- Le déplacement de `tests/integration/setup.ts` vers `tests/support/school-harness.ts` conserve les hooks Vitest dans une façade et permet de partager le vrai serveur avec Playwright. Le port est conservé pendant la durée du test et le nettoyage ne vise que son tenant.
- Un lancement ciblé a révélé que l’ordre des imports pouvait ouvrir la base locale de développement. L’initialisation anticipée de `DATABASE_URL_TEST` a supprimé ce défaut. Le schéma temporaire précis créé lors de cette reproduction a été supprimé ; aucun nettoyage global de la base de développement n’a été effectué.
- Un test web de chargement différé du tableau de bord a dépassé son attente pendant l’exécution simultanée des builds et suites. Il est passé seul puis dans la suite complète relancée ; aucune assertion n’a été assouplie pour contourner cet échec.
- La première relance finale de l’intégration a ciblé par erreur la base système `postgres`, sans tables publiques applicatives : les tests dépendants ont été ignorés à l’initialisation. La commande a été rejouée sur la base jetable migrée `ivoiredu_qa` ; **46 fichiers et 383 tests ont réussi**.

## Complément — conduite et lancement du calcul

- Après lancement du calcul d’une matière, ses notes d’évaluation sont verrouillées dans l’interface et dans l’API, y compris pendant l’état `in_progress`.
- La confirmation annonce explicitement ce verrouillage et indique la période de destination. Les nouvelles évaluations sont routées par le serveur vers la période suivante configurée ; sans période suivante, elles sont refusées avec un code métier dédié.
- La conduite est ouverte à chaque professeur affecté dès qu’il a lancé son calcul. Le professeur principal consulte la liste complète des enseignants, leurs matières et leurs saisies manquantes ou renseignées, comme il consulte les résultats académiques.
- La note finale de conduite reste impossible tant que tous les professeurs attendus n’ont pas saisi leur avis. L’API applique la même règle pour empêcher un contournement de l’interface.
- Validation finale : API unitaire **530/530**, API intégration **383/383**, web Vitest **384/384**, parcours Playwright `critical-real` **3/3**, builds et lints API/web réussis. Le dernier alignement affectation/emploi du temps a ensuite été contrôlé par les **13/13** cas d’intégration conduite et un nouveau build/lint API. La visibilité conditionnelle du calcul a été ajoutée avec un test dédié, puis la suite web complète a été relancée.

## Limites et validation honnête

Les livrables demandés de cartographie, tests automatisés et documentation manuelle sont fournis. Aucune régression détectée dans les suites validées. Il ne s’agit pas d’une certification de 100 % des branches ni d’une validation physique/externe : Chrome Android réel, fournisseur SMS/Web Push, stockage et téléchargement PDF de production restent à recetter. Le build web garde l’avertissement de taille du chunk React existant ; les builds réussissent et le lint n’a pas d’avertissement.

La déduplication des rappels reste de sept jours par élève/règle/canal. « Sent » pour le canal SMS signifie mise en file, pas accusé de livraison opérateur. Les journaux historiques combinés sont reconnus. Les échecs d’envoi SMS ne bloquent pas le dépôt in-app.

## Résumé des fichiers

| Ensemble | Fichiers principaux |
|---|---|
| API métier | `src/modules/finance/{financial-alerts.service,financial-alerts.repository,midyear-import.service}.ts`, `src/modules/parent-portal/parent-portal.{controller,service,repository}.ts`, `src/modules/academic/{academic.controller,academic-grading.service,academic-grading.repository}.ts`, `src/modules/conduct/` |
| API tests et banc | `tests/unit/qa.workflow-rules.test.ts`, `tests/unit/financial-alerts.service.test.ts`, `tests/integration/qa.*.routes.test.ts`, `tests/integration/midyear-flag.routes.test.ts`, `tests/support/`, `tests/browser/server.ts`, `vitest.config.ts` |
| Web comportement | `useOfflineMutation.ts`, `auth.api.ts`, `NotesPage.tsx`, `ConductPage.tsx`, `CalculationPage.tsx`, `AcademicDialogs.tsx`, `SettingsPage.tsx`, `StudentsPage.tsx`, `ParentReportCardsPage.tsx`, `ParentPaymentsPage.tsx` |
| Web tests | Tests de composants et hooks concernés, aides de navigation/auth E2E, `e2e/critical/workflows.spec.ts`, onboarding, abonnements et parcours existants réalignés ; `playwright.qa.config.ts`, sélection des abonnements, script `e2e:qa` |
| Documentation | `docs/qa/{inventaire-reference,cartographie,tests-manuels,execution,auto-revue}.md` |

## Messages de commit proposés

Les dépôts sont séparés ; aucun commit n’a été créé.

API :

```text
test(qa): compléter la couverture et fiabiliser les règles métier

Couvrir les parcours école, reprise, paie, notifications et pédagogie avec PostgreSQL.
Corriger les relances parents, verrouiller les notes et exiger tous les avis de conduite.
Partager le harness réel entre l’intégration API et les parcours Playwright.
```

Web :

```text
test(qa): couvrir les parcours critiques et documenter la recette

Réparer les attentes obsolètes et les écarts de droits, finance, conduite et portail parent.
Afficher le verrouillage des notes et la collecte complète des avis enseignants.
Ajouter la cartographie, les parcours Playwright réels et les 37 fiches de recette.
```
