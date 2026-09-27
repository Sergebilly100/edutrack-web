# C7 — profils élèves historiques sans classe ni inscription

Correctif réalisé le 26 septembre 2026 dans `edutrack-api` et `edutrack-web`.

> Ce document décrit la première livraison C7. Les décisions suivantes sur l’année historique, les anciennes classes, le modèle complet et la fermeture des imports remplacent les paragraphes correspondants : voir [le complément du 27 septembre](c7-historique-annee-et-phase-import.md).

## Comportement livré et accès

Le directeur importe des profils historiques : matricule, nom et prénom requis ; téléphone parent facultatif, au format existant `225` suivi de dix chiffres. Ces quatre champs sont ceux du mapping élèves déjà disponible. Aucun nouveau champ de contact n’a été inventé. Les colonnes supplémentaires sont ignorées, y compris classe, année et données de paiement ; elles ne figurent jamais dans l’aperçu des profils.

L’écran est accessible depuis **Administration → Import de données** (`/import`), et depuis **Configuration initiale → étape 4 « Profils à préparer » → Importer les profils élèves historiques**. Le retour contextualisé C6 conserve l’école et l’étape. L’import professeur demeure accessible par son lien propre. Le parcours initial élèves n’affiche aucun autre type d’import, mode de remplacement ou contrôle de reprise.

Le modèle Excel ne contient que les quatre en-têtes, sans exemples suggérant une inscription. L’écran et son guide contextualisé annoncent l’inscription ultérieure lors de l’ouverture des classes et l’absence d’inscription, de paiement, de dossier financier et de document. Il conserve l’analyse, les correspondances, l’aperçu, les erreurs par ligne/champ et leur téléchargement CSV. Les profils sans classe restent visibles dans la liste et la fiche sous « Non inscrit ».

Un profil importé peut être inscrit depuis **Élèves → fiche élève → Inscrire cet élève**, avec les permissions `enrollments.create` et `students.edit`. Le formulaire existant recharge ce profil, laisse choisir l’année et la classe de l’inscription et conserve l’UUID élève. Il ne crée pas un deuxième élève et n’écrit plus la classe dans le profil.

## Exploration et séparation des données

L’audit a couvert `students.class_id`, les FK/index, les inscriptions, les vues tenant, les effectifs, les caches financiers, l’import partagé, les lectures élèves, académique, assiduité, conduite, bulletins, documents, risques, abonnements et portail parent. Aucun index CodeGraph n’était présent. Les écritures de profils et les lectures d’identité ne nécessitant pas une appartenance scolaire peuvent continuer à utiliser `students`.

Le code réel comprend encore des élèves V1 avec classe et **sans inscription**. Supprimer ou ignorer immédiatement cette classe ferait disparaître leur appartenance scolaire. La colonne est donc conservée comme compatibilité V1 et devient nullable. Pour V2, `enrollments.class_id` et `enrollments.school_year_id` restent obligatoires et portent l’appartenance scolaire.

La migration **0074_historical_student_profiles.sql** comprend l’ALTER généré par Drizzle Kit et une vue tenant personnalisée, `students_with_class`, déclarée dans le contrat Drizzle. Elle est rejouable ; le runner existant applique les fichiers aux tenants existants et nouveaux. Journal, snapshot et empreinte du manifeste démo sont fournis. Le snapshot capture uniquement le changement C7, sans masquer les divergences anciennes du schéma.

La vue privilégie l’inscription confirmée de l’année active, puis la dernière année confirmée. Une inscription en attente ne donne pas de classe. Le repli V1 conserve la classe directe lorsqu’aucune inscription ne la remplace dans l’année de cette ancienne classe ; une réinscription future en attente ne supprime ainsi pas la classe antérieure. Aucun backfill ni changement de classe, de statut ou de résultat financier n’est effectué par la migration.

Les lectures d’appartenance scolaire passent par cette vue. Les requêtes financières par année conservent leur jointure avec **l’inscription de l’année consultée**, puis le repli V1, afin qu’une inscription plus récente ne déplace pas les anciens résultats. Les profils historiques sans classe ne comptent pas dans les effectifs de l’année active.

La confirmation en caisse change uniquement l’inscription. Elle verrouille les classes concernées dans un ordre stable et recalcule leurs effectifs depuis la vue, dans la transaction de paiement existante. Elle ne recopie plus la classe dans `students`. Les modifications de profil protègent la classe d’un élève inscrit (`409 ENROLLMENT_CLASS_MANAGED`) ; les changements de statut et la désactivation ajustent l’effectif de sa classe issue de l’inscription.

## API, atomicité et droits

Les routes dédiées `/api/v1/import/historical-students` proposent `GET/PUT /profile`, `GET /template` et `POST /analyze`, `/confirm`. Elles exigent `import.students` et le rôle directeur. L’ancien import élèves avec classe est refusé au directeur pendant l’onboarding (`403 HISTORICAL_IMPORT_REQUIRED`), y compris pour le modèle et l’analyse. La reprise existante reste réservée au super administrateur ; aucun choix historique/reprise n’est présenté au directeur.

Le moteur commun de parsing, de normalisation des en-têtes, de correspondances et de traduction est réutilisé. Le stockage des mappings a été déplacé du repository finance vers `shared/import-mapping/mapping.repository.ts`, sans nouvelle dépendance entre modules. Le profil utilise le type distinct `historical_students` et ne remplace pas les mappings paiements ou reprise.

La validation est refaite côté serveur à la confirmation. Les champs requis ne peuvent pas être désactivés par le client ; les champs cibles et colonnes en double sont rejetés. Les lignes invalides portent leur numéro Excel et le champ concerné.

La confirmation utilise une transaction globale et un savepoint par ligne. Un verrou par matricule normalisé sérialise les réexécutions concurrentes. Un profil existant avec même identité est réutilisé sans modifier sa classe, ses contacts ou ses inscriptions ; une identité différente donne un conflit de matricule. Une ligne échouée est annulée intégralement et ses voisines valides peuvent être confirmées. L’historique de l’import fait partie de la transaction globale.

Ce chemin écrit exclusivement les profils et l’historique technique. Il ne crée ni inscription, paiement, cache financier, document, compte parent, lien parent ou notification. Les erreurs SQL d’une ligne sont remplacées par un message générique ; les valeurs personnelles et les détails PostgreSQL ne sont ni renvoyés ni journalisés par ce chemin. L’aperçu d’identité est réservé à l’utilisateur autorisé. L’état du formulaire et les requêtes d’historique sont isolés par tenant.

## Fichiers concernés

- API : schéma tenant, migration 0074 et métadonnées ; nouveaux `historical-students.types.ts`, `.service.ts`, `.repository.ts` dans import-export ; routes dans `import.controller.ts` ; repository de mapping partagé.
- Compatibilité : repositories élèves/dossier, inscriptions, finance/caches/import paiements, académique, assiduité, conduite, décisions, bulletins, dashboard, documents, risques, abonnements et portail parent.
- Web : nouveaux `HistoricalStudentsImport.tsx`, `historical-students.api.ts` et tests ; adaptation d’`ImportPage`, `ImportWizard`, `OnboardingWizard`, du composant de mapping, des contrats élèves, de la liste/fiche et de `NewEnrollmentPage`.
- Tests : suites API historiques et règles élèves ; attentes de réinscription adaptées à la classe portée par l’inscription ; préparation des données de deux suites anciennes corrigée ; test frontend de réutilisation d’un profil ; recette navigateur onboarding étendue.

## Vérifications et écarts constatés

Baseline : **563 tests unitaires API et 439 tests frontend réussis**. La comparaison des sources de départ sur une base temporaire a reproduit six échecs anciens d’intégration : cinq scénarios EDT omettaient les affectations explicites exigées, un scénario de création d’école omettait son adresse obligatoire. Leurs données de préparation ont été corrigées, sans changer les règles de production EDT/école.

Résultats finaux :

| Vérification | Résultat |
| --- | --- |
| API Vitest unitaires | 52 suites, 576 tests réussis |
| API Vitest intégration | 50 suites, 408 tests réussis |
| Frontend Vitest | 86 suites, 443 tests réussis |
| Chromium mobile C6/C7 | 9 scénarios réussis |
| ESLint API et web | Réussi |
| Builds TypeScript API et PWA web | Réussis |
| Vérification des diffs | Réussie |

Le chemin C7 est testé avec PostgreSQL et Redis réels **temporaires et isolés** : import nominal sans classe, erreurs de ligne, absence de tout effet d’inscription/finance/document/parent, réexécution, conflit d’identité, inscription puis paiement normaux, priorité de la classe d’inscription malgré une ancienne classe différente, refus de déplacer la classe depuis le profil, effectifs à la désactivation, échec SQL d’une ligne avec voisins valides.

La migration est testée depuis un schéma avec `class_id NOT NULL`, des élèves inscrits et V1, puis insertion d’un profil sans classe et deuxième application. Les classes directes et les inscriptions existantes sont conservées. Un autre test compare les inscriptions et paiements avant/après deux applications. La suite complète couvre la non-régression des modules demandés et de la reprise super administrateur existante.

Le frontend teste la correspondance sans classe, l’aperçu, les erreurs, les droits/contextes d’onboarding et la réutilisation du profil à l’inscription. La recette navigateur vérifie une largeur de **360×640**, les quatre sélecteurs d’identité/contact, l’absence de classe et de contrôles de reprise, la confirmation et le retour C6, sans débordement horizontal. Capture : `.tmp/c7-historical-mobile.png`. Les API de cette recette sont simulées ; elles sont couvertes séparément par les tests d’intégration réels. **Aucun téléphone physique Tecno/Itel n’était disponible** : cette vérification matérielle n’a pas été réalisée.

La migration n’a été appliquée qu’aux bases temporaires de test. Pour une livraison, utiliser le runner tenant existant avant de démarrer la nouvelle API, qui dépend de la vue. Aucune donnée de développement ou de production n’a été migrée pendant cette tâche. Le build web signale le volume déjà important du bundle React ; il réussit.

## Auto-revue

- Consignes standard et références AGENTS/PRODUCT/PROJECT/DESIGN lues intégralement ; exploration du code réel avant modifications et écarts V1/mapping/baseline explicités.
- Périmètre strict API/web respecté ; fichiers étrangers et modifications préexistantes laissés intacts. Aucun travail C8/C9 concurrent.
- Contrats profil/inscription séparés, migration Drizzle idempotente, préservation des anciennes classes et inscription comme source de vérité vérifiées.
- HTTP dans le controller, validation dans le service, SQL et atomicité dans les repositories ; mécanisme partagé dans `shared/`, sans nouvel import croisé de modules backend.
- Permissions, isolation tenant, préfixe `/api/v1`, format d’erreur standard et `request.user.userId` respectés. Aucun nouveau `any`, secret ou log de données personnelles.
- Aucun envoi SMS/PDF synchrone, aucune nouvelle queue ou alerte : ces fonctions ne sont pas requises pour un import de profils. Les opérations existantes de notification n’ont pas été modifiées.
- API frontend centralisée, TanStack Query, composants shadcn et tokens existants ; chargement, erreurs, état vide, blocage hors ligne et toasts présents. Nouvelles commandes tactiles à 48 px ; menu latéral conservé et accès utilisateur vérifié.
- Baselines, tests unitaires sensibles, intégration du parcours complet et non-régression exécutés ; tests réussis, aucune régression détectée dans les suites exécutées. Limite matérielle Android explicitée.
- Implémentation C7 et recette automatisée accomplies. Aucun déploiement ni commit réalisé ; migration prête pour la procédure de livraison existante.

Message de commit proposé : `fix(students): séparer les profils historiques des inscriptions (C7)`.
