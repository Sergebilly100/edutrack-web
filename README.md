# IvoirEdu (EduTrack CI)

> **IvoirEdu** - SaaS de gestion scolaire **offline-first** pour les écoles privées de
> Côte d'Ivoire.
> *« Le seul outil qui prouve que les cours ont été donnés. »*
>
> Le nom *EduTrack* étant déjà utilisé par d'autres plateformes, le produit est
> commercialisé sous la marque **IvoirEdu**. Le code et les dépôts conservent encore le
> préfixe `edutrack-` ; les deux noms désignent le même projet.

Version : **1.0.0**

---

## Ce que fait l'application

- **Onboarding par import Excel** : une nouvelle école importe ses élèves, professeurs et
  emploi du temps via des modèles `.xlsx` générés par l'app, avec prévisualisation
  (dry-run) avant validation et historique des imports.
- **Présence professeurs & élèves offline-first** : pointage par scan de QR code de salle,
  fonctionnant sans réseau (PWA) puis synchronisé automatiquement.
- **Validations horaires** : contrôle des heures réelles, géolocalisation, scans de fin
  manquants, sanctions et recalcul de salaire.
- **Facturation & salaires** : fiches de salaire professeur, suivi des paiements et
  génération de **PDF réels** (relevé de présences, historique de paiements, revenus,
  fiche de salaire).
- **Abonnements parents & revenus** : souscriptions SMS/email, commission plateforme.
- **Portail parent** : consultation des présences, absences et emploi du temps des enfants.
- **Notifications multi-canal** : SMS (AfricasTalking), e-mail (Brevo), in-app, et
  **notifications push PWA** (prof + parent) via Web Push/VAPID - en complément, jamais
  en remplacement des SMS/email. L'app guide l'utilisateur pour s'installer sur son
  téléphone et activer les notifications.
- **Documents administratifs** : upload de pièces (diplôme, CNI, contrat, photo, relevé)
  sur Cloudflare R2 (repli local en dev).
- **Console super-admin multi-tenant**, rôles & permissions granulaires.

> ℹ️ L'application **ne gère pas encore** les notes ni les bulletins scolaires.

---

## Architecture (2 dépôts)

Le projet est composé de deux applications, chacune avec son propre dépôt git, versionnées
ensemble en `1.0.0` :

| Dossier | Rôle | Stack |
|---|---|---|
| `edutrack-api/` | API backend | Fastify 5, TypeScript strict, Drizzle ORM, BullMQ, PostgreSQL, Redis |
| `edutrack-web/` | Frontend PWA | React 18, Vite 5, vite-plugin-pwa (Workbox), shadcn/ui, TanStack Query v5 |

- **Multi-tenancy** : un schéma PostgreSQL dédié par école, isolation totale des données.
- **Jobs asynchrones** : SMS, e-mails et exports PDF passent par des files **BullMQ** sur
  Redis (jamais synchrones).
- **Offline-first** : la PWA met les pointages en file locale et les synchronise au retour
  du réseau.

---

## Prérequis

- **Node.js 20 LTS**
- **PostgreSQL 16** (ou 17)
- **Redis 7**
- *(optionnel)* **Cloudflare R2** pour le stockage des documents - sinon repli sur le
  disque local en développement.
- *(optionnel)* Comptes **Africa's Talking** / **smsmode** (SMS) et **Brevo** (e-mail) -
  un mode mock est disponible (`SMS_MOCK`, `EMAIL_MOCK`).

Le plus simple en local : lancer Postgres et Redis via le `docker-compose.yml` fourni dans
`edutrack-api/`.

---

# Config FRONTEND

## Variables d'environnement

Chaque dépôt fournit un fichier d'exemple à copier :

```bash
cp edutrack-api/.env.example edutrack-api/.env
```

### Frontend (`edutrack-web/.env`)

| Variable | Rôle |
|---|---|
| `VITE_API_URL` | URL de base de l'API (avec `/api/v1`) |
| `VITE_DEFAULT_TENANT_SCHEMA` | Schéma tenant par défaut au login (ex. démo) |
| `VITE_E2E_SCHEMA_NAME` | Schéma réservé aux tests Playwright (laisser vide en dev) |
| `VITE_VAPID_PUBLIC_KEY` | Clé publique VAPID pour le Web Push (identique à celle du backend) |

---

## Démarrage local

IvoirEdu expose un **site web/PWA** en plus de l'API. En local, le site est servi
par Vite depuis `edutrack-web/` et consomme l'API Fastify depuis `edutrack-api/`.

```bash
# Frontend (dans un autre terminal, depuis edutrack-web/)
cd ../edutrack-web
cp .env.example .env
npm install
npm run dev                     # web sur http://localhost:5173
```

- Site web / PWA IvoirEdu : <http://localhost:5173>

### Accès au site local

1. Démarrer l'API sur `http://localhost:3000`.
2. Démarrer le frontend sur `http://localhost:5173`.
3. Ouvrir <http://localhost:5173> dans le navigateur.

Le site détecte `localhost` et peut envoyer `VITE_DEFAULT_TENANT_SCHEMA` au login pour
travailler sur une école de démonstration, par défaut `school_sainte_marie`. Hors
localhost, le tenant est résolu par le domaine/sous-domaine. Pour rattacher un host
précis à un tenant qui ne porte pas le même nom, utiliser `VITE_TENANT_HOST_MAPPINGS`.
Exemple : `dev.ivoiredu.novatrixsys.com:school_sainte_marie` force ce domaine vers le
schéma tenant `school_sainte_marie`.

La page vitrine est affichée sur `ivoiredu.ci`, `www.ivoiredu.ci`, ou les hosts listés
dans `VITE_PUBLIC_SITE_HOSTS`. Elle reste aussi disponible explicitement sur `/site`.
Sur un domaine public configuré, l'accès application se fait via `/login`.

### Configuration serveur locale

Frontend (`edutrack-web/.env`) :

```env
VITE_API_URL=http://localhost:3000/api/v1
VITE_DEFAULT_TENANT_SCHEMA=school_sainte_marie
VITE_PUBLIC_SITE_HOSTS=
VITE_FORCE_TENANT_SCHEMA=false
VITE_TENANT_BASE_DOMAINS=
VITE_TENANT_ENV_PREFIXES=dev,staging,preprod
VITE_TENANT_HOST_MAPPINGS=
VITE_TENANT_SUBDOMAIN=
VITE_VAPID_PUBLIC_KEY=
```

Pour tester les notifications push en local, renseigner une paire VAPID côté API
(`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`) et recopier la clé publique
dans `edutrack-web/.env` via `VITE_VAPID_PUBLIC_KEY`.

### Build du site

Le frontend est une PWA. En production, `VITE_API_URL` est inliné dans le bundle : il
doit pointer vers une URL publique d'API incluant `/api/v1`, pas vers `localhost`.

```bash
cd edutrack-web
VITE_API_URL=https://api.ivoiredu.ci/api/v1 npm run build
```

Pour prévisualiser le build localement :

```bash
npm run preview
# ouvre http://localhost:4173
```

## Commandes de build & vérification

### Frontend (`edutrack-web/`)

```bash
npm run typecheck && npm run lint && npm run build   # build PWA (service worker + manifest)
npm run size                                         # vérifie les budgets de bundle
```
