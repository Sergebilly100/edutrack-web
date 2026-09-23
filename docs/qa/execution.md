# Exécuter la QA

La [cartographie](cartographie.md) distingue les tests métier, composants, contrats HTTP, API persistées et navigateur. La [recette manuelle](tests-manuels.md) reste nécessaire pour les appareils physiques et services externes.

## Outillage constaté

Dépendances déjà présentes : Vitest 3, Testing Library, Supertest/Fastify, Playwright 1.59, PostgreSQL, Redis. Aucun framework ni paquet ajouté. Les deux dépôts doivent être voisins : `edutrack-api/` et `edutrack-web/`. Utiliser les dépendances des lockfiles ; les commandes ci-dessous supposent Node, npm, les binaires PostgreSQL/Redis et Chromium Playwright disponibles.

Le run de référence utilise PostgreSQL 17 sur `127.0.0.1:55432`, Redis sur `127.0.0.1:56379`, Chromium installé par Playwright, API de test sur `3101` et Vite sur `5174`. Les comptes et documents de test sont fictifs.

## Base exclusivement réservée aux tests

Les migrations existantes peuvent parcourir les schémas présents. Utiliser **une base jetable entière**, jamais une copie de production partagée. L’intégration exige désormais `DATABASE_URL_TEST` dès le chargement de Vitest ; aucun repli sur `DATABASE_URL`. Cela protège aussi les fichiers qui importent statiquement le module de base avant le harness.

Exemple de préparation depuis `edutrack-api`, avec `initdb`, `pg_ctl`, `createdb`, `psql` et `redis-server` dans le PATH. Sous Homebrew, PostgreSQL 17 était disponible dans `/opt/homebrew/opt/postgresql@17/bin`. Choisir des ports libres si ceux-ci sont occupés.

```sh
export QA_PG_DIR="$(mktemp -d /tmp/ivoiredu-qa-pg.XXXXXX)"
export QA_REDIS_DIR="$(mktemp -d /tmp/ivoiredu-qa-redis.XXXXXX)"
initdb -D "$QA_PG_DIR" -U ivoiredu_qa --auth=trust
pg_ctl -D "$QA_PG_DIR" -l "$QA_PG_DIR/server.log" -o '-h 127.0.0.1 -p 55432 -k /tmp' start
createdb -h 127.0.0.1 -p 55432 -U ivoiredu_qa ivoiredu_qa
redis-server --bind 127.0.0.1 --port 56379 --save '' --appendonly no --daemonize yes --pidfile "$QA_REDIS_DIR/server.pid" --logfile "$QA_REDIS_DIR/server.log"
export DATABASE_URL_TEST='postgresql://ivoiredu_qa@127.0.0.1:55432/ivoiredu_qa'
export DATABASE_URL="$DATABASE_URL_TEST"
export REDIS_URL='redis://127.0.0.1:56379'
export SMS_MOCK=true
```

Initialiser **une seule fois sur cette base vide**, en utilisant les migrations du projet, sans modifier le schéma manuellement :

```sh
psql "$DATABASE_URL_TEST" -v ON_ERROR_STOP=1 -f src/shared/database/migrations/0000_wakeful_stark_industries.sql
DATABASE_URL="$DATABASE_URL_TEST" node --import tsx --input-type=module <<'NODE'
import { createTenantSchema } from './src/shared/database/tenant-init.ts';
await createTenantSchema('school_test_qa_bootstrap');
process.exit(0);
NODE
```

Conserver ces variables dans le terminal des suites suivantes. Ne pas lancer simultanément l’intégration et Playwright sur cette même base. Le serveur navigateur crée son propre tenant ; les tests admin créent aussi des écoles fictives. La suppression de la base/du cluster jetable en fin de recette nettoie ces dernières.

## Suites complètes

Depuis `edutrack-api` :

```sh
npm run test:unit -- --run
npm run test:integration
npm run build
npm run lint
```

Puis depuis `edutrack-web`, dans le même environnement :

```sh
npm test
npm run build
npm run lint
npm run e2e:qa
```

`e2e:qa` démarre et arrête automatiquement l’API de recette et Vite. Le serveur réutilise les vrais contrôleurs, services, migrations et PostgreSQL du harness d’intégration. SMS et certaines queues PDF sont substitués : aucun envoi fournisseur réel. La configuration impose un worker, car les tests admin effectuent des migrations et partagent la fixture. Les quatre anciens setup d’authentification facultatifs sans dépendant ne sont pas sélectionnés ; le setup parent requis l’est. Le dossier abonnements est maintenant sélectionné explicitement.

Les fichiers d’authentification `e2e/.auth/`, vidéos, captures, rapports, bases temporaires et variables locales ne sont pas à versionner. `npm run e2e:report` ouvre le rapport HTML du dernier run exécuté sans surcharge du reporter. Le run consigné dans la cartographie utilisait `--reporter=list`.

## Rejouer les cas critiques

Depuis le web :

```sh
npm run e2e:qa -- --project=critical-real
```

Trois parcours sans interception HTTP :

1. Inscription → pièces → caisse : rejet du dépassement, paiement de 25 000 FCFA, statut confirmé conservé après rechargement.
2. Conduite finale 18/20 → moyenne matière 16/20 coefficient 4 → validation → génération/publication → consultation parent de la moyenne pondérée 16,40/20 ; absence des brouillons vérifiée.
3. Lot réel de relances → cloche du parent → lecture → paiement du bon enfant → état lu persistant et lecture de toutes les notifications.

La fixture prépare deux élèves, deux parents séparés pour les parcours, une année active, un niveau et un plan de 120 000 FCFA. Elle appelle le vrai worker financier pour recalculer les soldes et déposer les rappels. Les mutations évaluées par les tests sont faites depuis l’interface, avec lectures API complémentaires pour identifier les données de fixture et vérifier les réponses.

Depuis l’API, contrôle ciblé des destinataires et reprises :

```sh
npm run test:integration -- tests/integration/financial-alerts.routes.test.ts tests/integration/qa.financial-alert-delivery.routes.test.ts
```

Ce contrôle inclut parent autorisé/autre famille/direction, lecture individuelle et globale, parent inactif, reprise SMS sans doublon in-app, paiement anticipé, remise, courbe individuelle et identifiant d’année utilisable par la finance parent.

## Limites à respecter dans les conclusions

- Les parcours directeur/professeur/staff historiques utilisent largement des réponses HTTP simulées. Ils valident le comportement de l’interface ; seuls les parcours désignés « API réelle » prouvent la persistance à travers toutes les couches.
- L’émulation mobile Chromium ne vaut pas exécution sur un Tecno/Itel physique. Caméra QR, précision GPS, service worker après ouverture à froid et réseau mobile doivent être vérifiés selon la recette manuelle.
- Un job PDF accepté n’est pas une validation du téléchargement via le stockage de production. Les unités testent les modèles PDF ; le bout en bout externe reste manuel.
- Un SMS journalisé « sent » par les relances signifie accepté par la queue. La livraison opérateur, le tarif, Web Push et les services email externes ne sont pas certifiés par cette recette locale.
- La cartographie mesure une couverture fonctionnelle documentée, pas un taux de couverture instrumentée de 100 % des lignes ou branches.

## Arrêt des services de cet exemple

Après les suites et depuis le terminal qui a conservé les variables :

```sh
redis-cli -h 127.0.0.1 -p 56379 shutdown nosave
pg_ctl -D "$QA_PG_DIR" stop -m fast
```

Les dossiers temporaires peuvent ensuite être supprimés après vérification de leur chemin. Ne pas employer ces commandes d’arrêt sur les services de développement de l’équipe.
