# Recette C16 — portail parent et offre SMS

Exécutée le 28 septembre 2026 sur Chromium mobile (viewport 393 × 851), l'API Fastify réelle et PostgreSQL dédié. Les tests n'utilisent aucune interception HTTP pour valider le contrat ou les cartes. Les interceptions du dernier scénario servent uniquement à provoquer lenteur et panne réseau.

## Données et isolation

- Base jetable `ivoiredu_c16` sur PostgreSQL local, créée avec les migrations du dépôt ; Redis local dédié. Aucun accès à une base de développement ou de production.
- Un schéma `school_test_*` par suite API et par serveur navigateur. Trois parents C16 distincts, chacun lié à un seul enfant : abonnement actif (45 jours), proche expiration (5 jours), absent. Les numéros C16 sont fictifs et commencent par `22500` ; aucun email C16 n'est créé.
- `SMS_MOCK=true` et queues SMS/PDF simulées dans le harness. Aucun fournisseur SMS ou email n'est appelé.
- Le harness supprime ses schémas et tenants après les tests. La première tentative navigateur, interrompue pendant la création de la fixture, a laissé `school_test_browser_64027` dans la **base jetable uniquement** ; le cluster PostgreSQL complet est supprimé en fin de recette.

## Résultats

| Contrôle | Résultat |
|---|---|
| API : actif, proche expiration, absent avec offre | `200` ; forme exacte du statut, `subscription: null` si absent ; `offer.billing = per_child_per_month` et 1 250 FCFA |
| API : SMS désactivé, non monétisé, tarif `null` ou zéro | `200` ; `offer.available = false`, `unit_price_fcfa = null` |
| API : EDT enfant et séparation des familles | réponse `{ week_label, days }` indépendante ; accès à un autre enfant refusé en `403 STUDENT_ACCESS_DENIED` |
| Portail : parent sans abonnement | carte persistante sur tableau de bord et compte, 1 000 FCFA par enfant et par mois, indication de l'administration de l'école |
| Portail : actif et proche expiration | cartes d'offre absentes ; alerte de renouvellement conservée pour le parent proche expiration ; accès aux absences conservé |
| Portail : offre non monétisée | configuration désactivée via la vraie route admin ; aucune carte ni promesse de prix sur les deux écrans |
| Portail : chargement et panne réseau | état de chargement visible ; erreur explicite et aucune promesse de prix après échec du statut |

Vérifications exécutées :

- `npm run test:integration --` avec C16, parent-auth, parent-overview, schedule, payment-import, report-cards, financial-alerts, qa.financial-alert-delivery et auth : **73 tests, 10 fichiers, tous réussis**.
- `npm test -- --run src/modules/parent-portal src/modules/auth` : **14 tests, 6 fichiers, tous réussis**.
- `npm run e2e:qa -- --project=parent-tests e2e/parent-portal --reporter=line` : **7 tests réussis**, comprenant le parcours parent existant et les cinq scénarios C16.
- `npm run typecheck` dans les deux dépôts et ESLint ciblé sur les fichiers C16 : **réussis**.

Le seul écart produit observé concernait l'absence de retour visible pendant le chargement et après une erreur réseau du statut sur les deux écrans. Une correction limitée à ces états a été appliquée ; les cartes et alertes existantes sont masquées si le statut échoue pour éviter de présenter un prix périmé.

## Auto-revue et limites

Les conventions du bloc standard ont été respectées : lecture du code et des documents avant modification, changements limités à `edutrack-api` et `edutrack-web`, architecture API inchangée, composants shadcn et tokens existants utilisés, aucun secret ni envoi externe, baseline parent passée avant édition, suites intégrées et non-régression passées après édition. Aucun nouvel écran ou menu n'a été créé. Aucune régression détectée sur les suites exécutées ; la recette C16 locale est accomplie.

Cette exécution ne certifie pas un déploiement distant, un appareil Tecno/Itel physique, ni la livraison par un opérateur SMS. Elle vérifie le parcours local réel API → base → portail parent avec fournisseurs sortants neutralisés.

Message de commit proposé : `test(parent): couvrir la recette intégrée C16 et les états réseau`
