# C17 — recette intégrée et recalcul financier contrôlé

Date : 28 septembre 2026. **Statut : partiellement vérifié, C17 reste bloquant.**

## Périmètre exécuté

La recette a utilisé Chromium piloté par Playwright, les deux applications réelles, PostgreSQL 17 et Redis dans un cluster temporaire dédié (`127.0.0.1:55433` et `127.0.0.1:56380`). Les suites `critical-real` et `address-real` démarrent chacune une API Fastify, une interface Vite et un schéma école jetable. Les assertions métier critiques ne remplacent pas les réponses HTTP de l’API. Les fournisseurs externes SMS/PDF sont substitués dans le serveur de recette. Les données et comptes visibles dans les captures sont ceux de l’école QA fictive.

Le nouveau `c17-continuous-school.spec.ts` poursuit **la même école neuve** dans une seule session de recette : création avec adresse, ouverture explicite de l’année par le super administrateur, configuration et import professeur par le directeur, inscription avec création de classe, affectation individuelle et professeur principal, import EDT lundi–dimanche, puis paiement après configuration contextualisée d’un plan manquant pour un second niveau de cette école. Le scénario a passé seul en 49,6 secondes sur l’API et PostgreSQL réels. Les autres scénarios intégrés gardent leurs schémas QA jetables.

La recette a révélé que le champ « Année scolaire active » du formulaire de création ne crée pas à lui seul une ligne dans `school_years` : l’ouverture effective se fait dans **Fiche école → Cycle scolaire**. Le scénario continu vérifie cette étape avant de laisser le directeur terminer l’assistant.

## Résultats des parcours réels

| Étape | Preuve exécutée | Résultat |
| --- | --- | --- |
| Création école et adresse, puis ouverture de sa première année par super administrateur ; relecture directeur | `c17-continuous-school.spec.ts` ouvre l’année dans la fiche école et relit l’adresse dans le navigateur directeur ; `school-address.spec.ts` C15 relit aussi l’adresse modifiée par API directeur | Réussi |
| Assistant complet et persistance adresse | `c17-continuous-school.spec.ts` crée niveau, matière, salle et plan par leurs écrans, vérifie les prérequis et finalise ; C15 couvre le rechargement et les paramètres historiques | Réussi |
| Profils professeurs sans affectation implicite ; profils élèves historiques | Le scénario continu importe un profil puis constate zéro affectation ; `teacher-assignments.spec.ts` et les tests d’intégration couvrent aussi les imports et l’historique | Réussi ; l’import élève historique reste facultatif et n’est pas rejoué dans le scénario continu |
| Première inscription, création de classe, retour au dossier et caisse | Scénario continu sur la même école, plus `enrollment-class-creation.spec.ts`, `student-roster.spec.ts` et `workflows.spec.ts` | Réussi ; aucune classe créée sur abandon/actualisation |
| Affectations individuelles, professeur principal et rappels | Scénario continu sur la même école, plus `teacher-assignments.spec.ts` sur Android émulé et bureau | Réussi ; le rappel ne bloque pas |
| Premier EDT, période lundi–dimanche, puis ajout manuel | Scénario continu sur la même école ; `schedule-import-weeks.spec.ts` couvre le créneau manuel après import et le refus des dates partielles | Réussi |
| Paiement sans plan, configuration contextualisée et retour caisse | Scénario continu : second niveau sans plan dans la même école, retour au même paiement et confirmation de 25 000 FCFA ; `tuition-recovery.spec.ts` couvre les droits | Réussi |
| Reprise en cours d’année réservée à la fiche école super administrateur | `midyear-recovery.spec.ts`, Android émulé et bureau : aperçu, erreurs, confirmation, refus d’accès directeur ; tests d’intégration associés | Réussi sur école QA |
| Format `Matricule | Matière | Classes` | `teacher-assignments.spec.ts` depuis la fiche école : correspondance, aperçu, professeur absent, confirmation désactivée | Réussi pour l’erreur contrôlée ; validations positives et négatives couvertes par intégration |
| Portail parent C16 et matrice de permissions C14 | `subscription-c16.spec.ts` et `c17-permission-matrix.spec.ts` : catalogue API réel, dépendance de permission persistée | Réussi |
| B04/B05 | Vrai guide Joyride et dialogue de navigation ; tableau de bord à 320, 360 et 393 px, sans débordement du document ni du contenu principal | Réussi sur Chromium émulé |

Pour B04, Joyride recouvre normalement le bouton de menu : le scénario déclenche le `click()` du bouton DOM réel pendant le tour afin de vérifier la transition lorsqu’un dialogue s’ouvre. Il constate la fermeture du guide sans enregistrer le tour comme terminé. Il ne prouve pas qu’un utilisateur peut toucher le bouton à travers le calque du guide.

Captures non sensibles : [guide avec dialogue](evidence/c17/b04-dialogue-guide.png), [320 px](evidence/c17/b05-dashboard-320.png), [360 px](evidence/c17/b05-dashboard-360.png), [393 px](evidence/c17/b05-dashboard-393.png), [Chrome sur émulateur Android](evidence/c17/android-emulator-dashboard.png).

L’extension VS Code « Android iOS Emulator » donne accès à l’AVD local `Medium_Phone_API_36.1`. Les commandes exécutées sont `emulator -avd Medium_Phone_API_36.1 -no-window -no-audio -no-boot-anim -no-snapshot-load`, `adb reverse tcp:5174 tcp:5174`, `adb reverse tcp:3101 tcp:3101`, `adb forward tcp:9222 localabstract:chrome_devtools_remote`, puis `node .tmp/c17-android-check.mjs` avec l’interface et l’API QA en cours d’exécution. Chrome 153 sur cet Android émulé a ouvert la vraie interface/API QA ; mesure directe : `innerWidth=411`, `documentWidth=411`, débordement du `<main>` `0`. Les projets Playwright couvrent aussi 320, 360 et 393 px. `adb devices -l` n’a montré **aucun téléphone Android physique** ; aucun contrôle Tecno/Itel réel n’a donc été réalisé. Un iPhone physique éventuel apporterait une preuve iOS complémentaire, pas la preuve Android demandée.

## Non-régression B06/B07 et automatisation

Les tests API d’intégration `financial-cache.routes.test.ts`, `finance.routes.test.ts`, `qa.financial-alert-delivery.routes.test.ts` et `enrollments.routes.test.ts` couvrent remise, montant et échéancier personnalisés, couverture par tolérance, séparation du recouvrement et des tolérances, et absence de relance indue. `risk.routes.test.ts` et `dashboard-actions.teachers.test.ts` couvrent séparément absences et retards enseignants, leurs motifs et la non-contamination des élèves à risque. Les 58 fichiers d’intégration ont été relancés après les scénarios navigateur.

| Commande exécutée dans le dépôt indiqué | Résultat final |
| --- | --- |
| Web : `DATABASE_URL_TEST=postgresql://ivoiredu_c17@127.0.0.1:55433/ivoiredu_c17 REDIS_URL=redis://127.0.0.1:56380 npm run e2e:qa -- --project=critical-real --project=parent-tests --reporter=line` | 37/37 passés après ajout du parcours continu et correction d’une attente de rendu C14 |
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

## Recalcul financier : simulation et application contrôlée

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

L’utilisateur a limité l’opération à la **base de recette isolée** et a explicitement répondu « Oui, appliquer sur ce schéma » pour `school_demo_c17_seeded_verify`. Après un dernier contrôle en lecture seule du tenant actif, de l’empreinte source et des agrégats, cette commande a été exécutée une seule fois :

```sh
DATABASE_URL=postgresql://ivoiredu_c17@127.0.0.1:55433/ivoiredu_c17 npm run finance:recalculate-caches -- --schema=school_demo_c17_seeded_verify --apply
```

Le journal donne uniquement `Recalculated: school_demo_c17_seeded_verify (72 students)` ; il ne contient aucune donnée personnelle. Les 72 lignes de cache élève ont un `last_computed_at` passé de `2026-09-28 11:03:50.54493+00` à `2026-09-28 17:31:49.088048+00`. La requête de contrôle `psql -X -v ON_ERROR_STOP=1 -Atf .tmp/c17-finance-check.sql` redonne **exactement tous les agrégats du tableau ci-dessus** après application : 153 paiements confirmés pour 13 140 000 FCFA, 9 tolérances pour 450 000 FCFA, 18 retards, aucun dû négatif et aucun faux retard sous couverture. L’empreinte des tables source calculée par `sh .tmp/c17-finance-fingerprint.sh` est identique avant et après : `cd3ef3dfa9fd14438c78fa7634e2c980c91b74ba8def8fcaa8216d2d9fd3297e`. Aucun autre schéma et aucun `--all-active --apply` n’ont été ciblés.

Les seules instances PostgreSQL et Redis temporaires de C17 ont été arrêtées après les vérifications ; leurs ports dédiés ne servent plus de cible d’exécution.

## Correctifs de recette et auto-revue

- Le manifeste `migrations.manifest.json` autorise les migrations 0077 et 0078 après vérification de leurs empreintes et de leur portée tenant ; `demo:create` repasse ses tests.
- Le serveur navigateur QA crée les inscriptions confirmées requises pour les profils académiques et place les cas C16 dans une classe distincte. Le test C10 crée sa seconde matière sur un niveau distinct pour ne pas altérer les prérequis des bulletins de `Classe QA`.
- Le tableau de bord contraint le tooltip de présence aux petites largeurs ; les tests B04/B05 et C14 ont été ajoutés. Le formulaire d’adresse relit la configuration à l’ouverture pour éviter l’affichage d’un cache périmé. Les scénarios C15, C10 et F25 ont été ajustés à ces comportements réels.
- Le nouveau test `c17-continuous-school.spec.ts` exerce toute la chaîne métier sur une école créée dans le navigateur. Il ne substitue aucune réponse HTTP ; `route.continue()` transmet seulement l’en-tête du schéma propre à cette école. Le test C14 attend désormais que tous les domaines du catalogue réel soient rendus avant de développer la matrice.
- Aucune nouvelle route, migration, queue, donnée personnelle de production ou secret n’a été ajouté. Les changements restent dans `edutrack-api` et `edutrack-web`. Les tests, l’isolation des tenants, le lint, le typage et les builds finaux ne montrent pas de régression détectée. Les deux images de design modifiées par effet de bord des tests ont été restaurées.

Le parcours continu et le recalcul contrôlé sont prouvés. L’utilisateur a confirmé qu’**aucun téléphone Android physique n’est disponible** ; cette vérification matérielle reste la limite ouverte et empêche de présenter la recette comme intégralement accomplie selon sa dernière demande. L’émulateur et les viewports navigateur restent des preuves complémentaires explicites. Message de commit proposé pour le scénario et les preuves de cette passe : `test(qa): valider le parcours continu C17 sur une école neuve`.
