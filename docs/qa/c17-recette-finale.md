# C17 — recette intégrée et recalcul financier contrôlé

Date : 28 septembre 2026. **Statut : partiellement vérifié, C17 reste bloquant.**

## Périmètre exécuté

La recette a utilisé Chromium piloté par Playwright, les deux applications réelles, PostgreSQL 17 et Redis dans un cluster temporaire dédié (`127.0.0.1:55433` et `127.0.0.1:56380`). Les suites `critical-real` et `address-real` démarrent chacune une API Fastify, une interface Vite et un schéma école jetable. Les assertions métier critiques ne remplacent pas les réponses HTTP de l’API. Les fournisseurs externes SMS/PDF sont substitués dans le serveur de recette. Les données et comptes visibles dans les captures sont ceux de l’école QA fictive.

Le parcours a été vérifié par scénarios intégrés successifs, pas par une session unique poursuivie sur la nouvelle école créée par le super administrateur. La création avec adresse, puis la relecture par le directeur, ont été exercées dans C15 ; la configuration initiale complète, les inscriptions, les affectations, l’EDT et la caisse ont été exercés dans l’école QA jetable. **La continuité de bout en bout sur une seule école neuve reste à démontrer avant clôture de C17.**

## Résultats des parcours réels

| Étape | Preuve exécutée | Résultat |
| --- | --- | --- |
| Création école, adresse et année par super administrateur ; relecture directeur | `school-address.spec.ts` C15, école créée avec année active, adresse modifiée et relue par API directeur | Réussi |
| Assistant et persistance adresse | C15, parcours onboarding et paramètres d’école historique ; API `/school/info` et `/permissions/config` relues après rechargement | Réussi pour l’adresse ; configuration complète sur la nouvelle école non rejouée |
| Profils professeurs sans affectation implicite ; profils élèves historiques | `teacher-assignments.spec.ts` vérifie l’import de profil sans affectation, puis la création explicite de blocs ; tests d’intégration d’import et d’historique | Réussi sur les scénarios ciblés |
| Première inscription, création de classe, retour au dossier et caisse | `enrollment-class-creation.spec.ts`, `teacher-assignments.spec.ts`, `student-roster.spec.ts`, `workflows.spec.ts` | Réussi ; aucune classe créée sur abandon/actualisation |
| Affectations individuelles, professeur principal et rappels | `teacher-assignments.spec.ts`, sur Android émulé et bureau ; import d’affectations via fiche école | Réussi ; le rappel ne bloque pas |
| Premier EDT, période lundi–dimanche, puis ajout manuel | `schedule-import-weeks.spec.ts` sur Android émulé et bureau, et import réel dans `teacher-assignments.spec.ts` | Réussi ; dates partielles refusées |
| Paiement sans plan, configuration contextualisée et retour caisse | `tuition-recovery.spec.ts`, avec et sans `tuition.edit` ; `workflows.spec.ts` relit un paiement confirmé | Réussi |
| Reprise en cours d’année réservée à la fiche école super administrateur | `midyear-recovery.spec.ts`, Android émulé et bureau : aperçu, erreurs, confirmation, refus d’accès directeur ; tests d’intégration associés | Réussi sur école QA |
| Format `Matricule | Matière | Classes` | `teacher-assignments.spec.ts` depuis la fiche école : correspondance, aperçu, professeur absent, confirmation désactivée | Réussi pour l’erreur contrôlée ; validations positives et négatives couvertes par intégration |
| Portail parent C16 et matrice de permissions C14 | `subscription-c16.spec.ts` et `c17-permission-matrix.spec.ts` : catalogue API réel, dépendance de permission persistée | Réussi |
| B04/B05 | Vrai guide Joyride et dialogue de navigation ; tableau de bord à 320, 360 et 393 px, sans débordement du document ni du contenu principal | Réussi sur Chromium émulé |

Pour B04, Joyride recouvre normalement le bouton de menu : le scénario déclenche le `click()` du bouton DOM réel pendant le tour afin de vérifier la transition lorsqu’un dialogue s’ouvre. Il constate la fermeture du guide sans enregistrer le tour comme terminé. Il ne prouve pas qu’un utilisateur peut toucher le bouton à travers le calque du guide.

Captures non sensibles : [guide avec dialogue](evidence/c17/b04-dialogue-guide.png), [320 px](evidence/c17/b05-dashboard-320.png), [360 px](evidence/c17/b05-dashboard-360.png), [393 px](evidence/c17/b05-dashboard-393.png).

L’appareil Android physique n’était pas disponible (`adb` absent). Les projets Playwright utilisent le viewport, le toucher et le mode mobile de Chromium ; **aucun contrôle Tecno/Itel réel n’a été réalisé**.

## Non-régression B06/B07 et automatisation

Les tests API d’intégration `financial-cache.routes.test.ts`, `finance.routes.test.ts`, `qa.financial-alert-delivery.routes.test.ts` et `enrollments.routes.test.ts` couvrent remise, montant et échéancier personnalisés, couverture par tolérance, séparation du recouvrement et des tolérances, et absence de relance indue. `risk.routes.test.ts` et `dashboard-actions.teachers.test.ts` couvrent séparément absences et retards enseignants, leurs motifs et la non-contamination des élèves à risque. Les 58 fichiers d’intégration ont été relancés après les scénarios navigateur.

| Commande exécutée dans le dépôt indiqué | Résultat final |
| --- | --- |
| Web : `DATABASE_URL_TEST=postgresql://ivoiredu_c17@127.0.0.1:55433/ivoiredu_c17 REDIS_URL=redis://127.0.0.1:56380 npm run e2e:qa -- --project=critical-real --project=parent-tests --reporter=line` | 36/36 passés |
| Web : mêmes variables, `npx playwright test --config=playwright.c15.config.ts --reporter=line` | 3/3 passés |
| API : `npm run test:unit -- --run` | 753/753 passés, 58 fichiers |
| API : mêmes variables isolées, `npm run test:integration` | 472/472 passés, 58 fichiers |
| Web : `npm test` | 607/607 passés, 99 fichiers |
| API et web : `npm run typecheck`, `npm run lint`, `npm run build` dans chaque dépôt | 6 commandes réussies |
| API et web : `git diff --check` dans chaque dépôt | Aucune erreur |

Le build web signale des chunks de plus de 500 kB ; il se termine avec succès. Les journaux bruts de ces commandes sont conservés seulement dans les `.tmp` ignorés des deux dépôts, car ils peuvent contenir des détails de session. Les décomptes et constats ci-dessus constituent la trace partageable.

## Provisionnement de démonstration et isolation

`demo:create` a été exécuté sur la **base PostgreSQL temporaire dédiée**, avec quatre nouveaux noms : `demo_c17_empty_20260928`, `demo_c17_seeded_20260928`, `demo_c17_empty_verify` et `demo_c17_seeded_verify`. La forme des commandes exécutées est `DATABASE_URL=postgresql://ivoiredu_c17@127.0.0.1:55433/ivoiredu_c17 npm run demo:create -- --name=<nom ci-dessus> --type=empty|seeded`. Chaque profil a été provisionné deux fois sous des noms distincts ; les créations ont réussi. Une nouvelle tentative avec le premier nom `empty` a été refusée avec `DEMO_ALREADY_EXISTS`. Les quatre tests d’intégration de la commande couvrent aussi collision, échec tardif et rollback, concurrence et contenu initial.

Le profil `seeded` observé contient 72 élèves, 3 classes, 1 année, 3 salles, 6 créneaux, 144 bulletins, 6 professeurs, 72 parents, 6 élèves à risque et 1 professeur à risque. L’empreinte déterministe des données du tenant témoin `school_test_c17_bootstrap`, avant et après les deux derniers provisionnements, est identique : `7e51bd7675a3dacbabbfc658fe5bcfa77cd2fac67805af30d489ef164a4a497e`. Le calcul retire les lignes aléatoires `\\restrict` et `\\unrestrict` de `pg_dump` avant SHA-256. Aucun schéma d’une base locale utilisateur n’a été ouvert pour cette opération.

## Recalcul financier : simulation uniquement

Schéma explicitement sélectionné sur la base temporaire : `school_demo_c17_seeded_verify`. Commande exécutée :

```sh
DATABASE_URL=postgresql://ivoiredu_c17@127.0.0.1:55433/ivoiredu_c17 npm run finance:recalculate-caches -- --schema=school_demo_c17_seeded_verify
```

Le journal de la commande se limite à `Dry run: school_demo_c17_seeded_verify` : le mode simulation actuel annonce le périmètre mais **ne calcule pas lui-même un aperçu chiffré**. Les montants attendus ont donc été vérifiés par requêtes SQL en lecture seule sur ce seul schéma, sans données personnelles dans le compte rendu :

| Contrôle | Résultat |
| --- | ---: |
| Paiements confirmés | 153 ; 13 140 000 FCFA |
| Paiements couverts par tolérance école | 9 ; 450 000 FCFA |
| Remises individuelles | 9 ; 270 000 FCFA |
| Cache de 72 élèves : dû annuel / attendu à date / encaissé / toléré | 21 330 000 / 14 220 000 / 13 140 000 / 450 000 FCFA |
| Élèves signalés en retard / dus négatifs / faux retards sous couverture | 18 / 0 / 0 |
| Synthèse école : attendu / encaissé / retards | 14 220 000 / 13 140 000 FCFA / 18 |

Les données source des paiements et ajustements ont la même empreinte avant et après simulation : `cb8fb8bf0c91d1086e05c073f5b5d9a1f094bedd9ad7df9549957454df3df545`. La commande `--apply` **n’a pas été exécutée** : aucun déploiement, base cible ni liste de schémas de déploiement n’ont été autorisés. Aucun `--all-active --apply` n’a été lancé. Les contrôles *après application* restent donc à faire sur le périmètre qui sera approuvé ; les agrégats ci-dessus sont ceux de la simulation et de l’état initial du schéma démo.

Les seules instances PostgreSQL et Redis temporaires de C17 ont été arrêtées après les vérifications ; leurs ports dédiés ne servent plus de cible d’exécution.

## Correctifs de recette et auto-revue

- Le manifeste `migrations.manifest.json` autorise les migrations 0077 et 0078 après vérification de leurs empreintes et de leur portée tenant ; `demo:create` repasse ses tests.
- Le serveur navigateur QA crée les inscriptions confirmées requises pour les profils académiques et place les cas C16 dans une classe distincte. Le test C10 crée sa seconde matière sur un niveau distinct pour ne pas altérer les prérequis des bulletins de `Classe QA`.
- Le tableau de bord contraint le tooltip de présence aux petites largeurs ; les tests B04/B05 et C14 ont été ajoutés. Le formulaire d’adresse relit la configuration à l’ouverture pour éviter l’affichage d’un cache périmé. Les scénarios C15, C10 et F25 ont été ajustés à ces comportements réels.
- Aucune nouvelle route, migration, queue, donnée personnelle de production ou secret n’a été ajouté. Les changements restent dans `edutrack-api` et `edutrack-web`. Les tests, l’isolation des tenants, le lint, le typage et les builds finaux ne montrent pas de régression détectée. Les deux images de design modifiées par effet de bord des tests ont été restaurées.

La recette **n’est pas intégralement accomplie** : il manque le parcours continu sur une école neuve unique, le contrôle sur Android physique et l’autorisation puis l’exécution et la vérification du recalcul sur le périmètre de déploiement décidé. Ces trois points empêchent de déclarer C17 terminé. Message de commit proposé pour les correctifs et preuves déjà obtenus : `test(qa): consolider la recette réelle C17 et isoler ses données`.
