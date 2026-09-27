# C7 — liste des élèves confirmés et ouverture des fiches

Correctif du 27 septembre 2026, dans `edutrack-api` et `edutrack-web`.

## Comportement livré

La liste scolaire `/students` et son total exigent désormais une inscription `confirmed`. Quand une année active existe, cette confirmation doit concerner cette année. Sans année active, la dernière classe confirmée reste consultable. Le filtre ne déduit plus l’inscription de la classe conservée sur le profil : une classe vide, une classe historique ou une réinscription `pending_cashier`, `pending_dossier` ou `blocked_unpaid` ne suffisent pas.

Les profils et les dossiers restent conservés. Aucun élève, contact parent, paiement, inscription ou document n’a été supprimé ou créé pour corriger l’affichage. Une classe héritée de V1 sans inscription confirmée ne suffit plus à figurer dans la liste scolaire.

Les profils historiques sont accessibles depuis **Vie scolaire → Inscriptions → Nouvelle inscription → Retrouver un profil existant**. La recherche par nom, prénom ou matricule ouvre le formulaire existant avec l’identité et les contacts parents. `/api/v1/students/profiles` est réservé aux permissions `enrollments.create` et `students.view`. Les profils ayant déjà une inscription sont exclus de cette recherche : leurs dossiers restent dans le parcours inscriptions/réinscriptions, notamment pour préserver les contrôles d’impayés et éviter les doublons.

La caisse et la personnalisation des frais utilisent `/api/v1/students/financial-profiles`, qui retrouve les dossiers ayant une inscription, un cache financier ou des paiements, y compris pour solder une dette avant réinscription. Cette recherche exige `students.view` et une permission financière (`payments.view`, `payments.record` ou `tuition.edit`). Elle ne change aucun statut et ne confère pas la qualité d’élève inscrit. Les listes scolaires, notes et conduite continuent d’utiliser le contrat scolaire par défaut.

Après la confirmation du premier versement, les caches des élèves et des classes sont invalidés. Un paiement partiel suffit dans le parcours existant : aucun règlement intégral supplémentaire n’est imposé. La reprise super administrateur conserve ses confirmations et ses règles existantes.

## Fiche signalée comme introuvable

L’UUID fourni existait, avec une inscription confirmée. La lecture de sa fiche échouait avec PostgreSQL `42P01` parce que `student_historical_sources` manquait dans le schéma de son école. La migration Drizzle existante `0076_historical_student_sources.sql` a été appliquée en transaction au seul tenant local concerné. La fiche a ensuite été relue avec succès, et l’élève reste visible dans la liste confirmée. Aucune nouvelle migration ni modification manuelle du schéma n’a été introduite.

La demande initiale d’application à l’ensemble des schémas locaux a été rejetée par l’approbation automatique pour portée excessive sur des bases partagées. L’alternative limitée à l’école de l’UUID signalé a été autorisée et exécutée. Les autres déploiements doivent appliquer la migration 0076 par leur procédure habituelle ; ils n’ont pas été modifiés par cette réparation locale.

Le frontend réserve maintenant « Élève introuvable » à une véritable réponse 404. Une erreur serveur ou réseau affiche un état de chargement impossible avec nouvelle tentative ; une requête suspendue hors connexion indique la connexion indisponible. Les logs du module élèves conservent uniquement un code technique, sans requête SQL, paramètres, identité ou contacts.

## Vérifications

Baseline ciblée avant modification : 56 tests unitaires API, 13 tests d’intégration historique et 5 tests des pages inscriptions réussis.

| Vérification finale | Résultat |
| --- | --- |
| API unitaires complètes | 57 suites, 664 tests réussis |
| API intégration complète | 55 suites, 450 tests réussis |
| Frontend complet | 95 suites, 551 tests réussis |
| Chromium avec API réelle : profil, dossier, paiement, liste et fiche | 2 scénarios réussis, Android émulé 360×800 et bureau 1280×900 |
| Chromium, non-régression C9 : création de classe et retour au dossier, abandon/actualisation | 3 scénarios réussis |
| TypeScript, builds API/PWA et ESLint | Réussis |
| Diffs | Vérifiés |

Les tests d’intégration couvrent chaque statut non confirmé, les profils historiques sans classe, la pagination, les filtres de classe/activité, une réinscription en attente après une année confirmée, la caisse des dossiers à impayés, les permissions, l’import sans effets administratifs ou financiers, puis l’inscription et le paiement. Deux applications de 0076 conservent les élèves, inscriptions, classes et paiements. Les suites complètes couvrent également assiduité, conduite, finance et portail parent.

Les tests frontend vérifient la découverte des profils et le préremplissage sans doublon, l’invalidation des caches après paiement, la recherche financière distincte et les états 404/serveur/réseau/hors connexion. La recette navigateur ouvre réellement la fiche depuis la vue mobile et le tableau bureau, sans rechargement après paiement. Aucun téléphone physique Tecno/Itel n’était disponible.

Les modifications présentes avant ce correctif ont été préservées. Les attentes de libellé des tests de période EDT et de création de classe ont été alignées sur les textes modifiés dans ces travaux parallèles. La première suite frontend exécutée sous forte charge a dépassé un délai de rendu du dashboard ; les suites finales utilisent deux workers sans changer les délais des tests. Les erreurs de sélection de la recette navigateur ont été corrigées avec les libellés accessibles et la distinction des vues mobile/bureau, sans assouplir les assertions métier.

## Auto-revue

- Périmètre limité à API/web ; conventions repository/service/controller et permissions respectées ; aucun nouvel import croisé entre modules backend.
- Profils, inscriptions et recherches financières distingués explicitement ; tenant issu de la session ; aucun contournement via un paramètre de liste.
- Migration Drizzle existante et idempotente utilisée pour la réparation ciblée ; données et statuts existants préservés.
- Composants, tokens et navigation existants conservés ; recherche accessible, états visibles et zones tactiles de 48 px pour les nouveaux contrôles.
- Pas de données personnelles ajoutées aux logs ; aucun envoi synchrone ni nouvelle queue.
- Correction de la liste et de la fiche signalée accomplie ; non-régression validée dans les suites finales et accès aux profils vérifié depuis le menu inscriptions.

Message de commit proposé : `fix(students): réserver la liste aux inscriptions confirmées et réparer les fiches`.
