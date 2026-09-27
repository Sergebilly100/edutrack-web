# C7 — complément : références historiques, parents et phase d’import

Réalisé le 27 septembre 2026 dans `edutrack-api` et `edutrack-web`. Ce complément remplace les règles de la première livraison C7 concernant les champs, le modèle et l’accès à l’import.

Le [correctif de la liste élèves et des fiches](./c7-liste-eleves-confirmes.md) précise désormais que seuls les élèves dont l’inscription est confirmée figurent dans la liste scolaire. Les profils historiques sont retrouvés depuis **Vie scolaire → Inscriptions → Nouvelle inscription**.

## Décisions confirmées

Le directeur renseigne l’année scolaire de chaque fichier, au format `2024-2025`. Cette année est enregistrée pour chaque élève du lot, avec son ancienne classe, sans inscription. L’ancienne classe est une référence textuelle provenant de la colonne Classe, ou du nom de feuille comme dans l’ancien modèle. Elle reste facultative : aucun rattachement à une classe ouverte n’est imposé.

Les imports élèves et professeurs sont réservés à la configuration initiale, avec plusieurs lots autorisés jusqu’à sa finalisation. Ils sont refusés après finalisation côté API, y compris par URL directe. Les ajouts manuels, inscriptions et imports EDT restent disponibles selon les permissions existantes. La reprise super administrateur conserve ses routes, permissions et validations propres.

## Expérience et accès

L’écran **Profils élèves historiques** est accessible depuis **Configuration initiale → étape 4 « Profils à préparer » → Importer les profils élèves historiques**. Les profils/contrats professeurs ont leur propre lien dans cette même étape. Sur la page ordinaire **Administration → Import de données**, seul l’import EDT est proposé, avec l’historique des opérations. Pendant l’initialisation, cette page offre un lien vers l’étape 4 ; après finalisation, elle indique où ajouter les élèves et professeurs manuellement et rappelle le recours au super administrateur pour une reprise.

Le formulaire utilise la zone de glisser-déposer commune et trois étapes : fichier, vérification, résultat. L’année est explicitement saisie ; elle n’est pas préremplie avec l’année active. Le bouton « Importer un autre lot » conserve l’année mais demande un nouveau fichier. Le retour du sélecteur de fichier natif ne doit pas déclencher une relecture du contexte qui effacerait le formulaire.

Le téléchargement retourne **exactement `templates/students.xlsx`**, vérifié octet par octet. Le modèle contient l’identité, la classe ancienne, la naissance et tous les contacts effectivement supportés : nom/téléphone/email du parent principal, nom/téléphone du second parent. Les lignes d’exemple doivent être retirées. La mention obligatoire Classe du modèle ancien ne constitue pas une exigence du moteur historique ; le formulaire le précise.

Nom et prénom sont obligatoires. Le matricule est recommandé, mais facultatif comme dans le modèle habituel. Le moteur accepte les dates Excel et `YYYY-MM-DD` ou `JJ/MM/AAAA`, contrôle les téléphones au format existant et l’email. Les feuilles de documentation sont ignorées ; toutes les feuilles élèves sont lues. L’aperçu montre l’ancienne classe et les deux contacts parents. Les erreurs indiquent la feuille, la ligne Excel et le champ ; le rapport CSV reste téléchargeable.

Les correspondances enregistrées sont conservées en priorité, avec leurs traductions, puis complétées par les alias du modèle. L’autodétection ne prend pas une colonne déjà affectée à un autre champ. Les identifiants internes des champs ne sont pas transmis dans une demande de sauvegarde stricte.

## Données et atomicité

La migration **0076_historical_student_sources.sql**, générée via Drizzle Kit et rendue idempotente, ajoute `student_historical_sources` et l’année historique à `import_history`. Journal, snapshot ciblé et empreinte du manifeste démo sont fournis. Elle n’altère ni `students.class_id`, ni les classes/années ouvertes, ni les inscriptions existantes. La séparation de l’inscription livrée par 0074 demeure en place.

Chaque référence associe un élève à un libellé d’année, à une ancienne classe facultative, à une clé de réexécution et à son lot d’import. Elle n’a aucune FK vers une classe ou une année réelle. La fiche **Élèves → fiche élève** affiche ces références sous « Historique importé », sans les présenter comme des inscriptions.

Les contacts sont stockés sur le profil élève. Aucun compte parent, lien parent, SMS, inscription, paiement, dossier financier ou document n’est créé par cet import. Les accès parents sont préparés plus tard par les parcours existants d’inscription/gestion des parents.

La confirmation conserve une transaction de lot et un savepoint par ligne. Si l’écriture de la référence échoue après l’insertion du profil, le profil est lui aussi annulé. Une clé normalisée et hachée permet la réexécution sans doublon. Avec matricule, les profils existants compatibles sont réutilisés sans changer leurs contacts, statuts, classes ou finance. Sans matricule, une référence identique du même historique retrouve le profil ; une identité susceptible de correspondre à un autre élève exige un matricule plutôt qu’une fusion automatique.

La ligne `public.tenants` est verrouillée pendant la confirmation élèves et professeurs. La finalisation et la confirmation d’un lot ne peuvent ainsi se dépasser mutuellement. Les erreurs SQL restent remplacées par un message générique de ligne ; aucun nouveau log de données personnelles n’est ajouté.

## Vérifications

Baseline avant modifications : 635 tests unitaires API et 486 tests frontend réussis.

| Vérification | Résultat |
| --- | --- |
| API unitaires | 55 suites, 647 tests réussis |
| API intégration complète | 53 suites, 432 tests réussis |
| Frontend Vitest | 89 suites, 491 tests réussis |
| Recette Chromium mobile C6/C7 | 10 scénarios réussis |
| ESLint API/web | Réussi |
| Builds TypeScript API/PWA web | Réussis |
| Diffs et métadonnées migration | Vérifiés |

La suite complète d’intégration utilise PostgreSQL et Redis locaux temporaires. Elle couvre élèves, inscriptions, finance, assiduité, conduite, portail parent et reprise C8/C10. Les anciennes attentes de l’import élèves avec classe, désormais fermé, ont été remplacées par les refus explicites et les tests complets de profils historiques. Les tests C10 démarrent leurs imports de profils dans la phase initiale.

Les nouveaux tests vérifient le modèle Excel complet multi-feuille, les deux parents et la naissance, la conservation année/classe par élève, l’absence d’année réelle et de tout effet d’inscription, la réexécution avec/sans matricule, plusieurs lots, les années invalides, l’inscription ultérieure et le paiement normal. Deux applications de 0076 laissent identiques profils, inscriptions, paiements, finance, documents, références et historique. Une erreur synthétique sur la référence vérifie l’annulation intégrale de la ligne.

Une première exécution simultanée des builds, navigateurs et suites a dépassé le délai de deux tests de provisioning et d’un test PDF ; les suites API ont été réexécutées seules avec succès, sans assouplir leurs délais ni changer ces tests.

La recette Chromium mobile à **360×640** vérifie le glisser-déposer, le mapping de dix champs, l’aperçu, les erreurs, la confirmation, un lot supplémentaire et le retour à l’étape 4. Elle vérifie aussi la page ordinaire après finalisation. Les API sont simulées pour cette recette et couvertes séparément par l’intégration réelle. Captures locales : `.tmp/c7-historical-file-mobile.png` et `.tmp/c7-historical-mobile.png`. Aucun téléphone physique Tecno/Itel n’est disponible : la recette matérielle n’est pas réalisée.

La migration a été exécutée uniquement sur les bases temporaires de test. À la livraison, appliquer le runner tenant existant avant de démarrer cette API. Aucun déploiement, aucune migration de données de développement/production et aucun commit n’ont été réalisés.

## Question super administrateur soulevée pendant la tâche

> Le regroupement a ensuite été demandé et réalisé : voir [la recette de l’onglet unique](admin-regroupement-imports-ecole.md). La reprise des profils/contrats professeurs reste distincte de cette réorganisation.

Le code actuel affiche deux fois `MidyearImportPanel` : « Données professeurs » expose les affectations et reste disponible en permanence ; « Reprise de données » contient déjà ces affectations, mais dépend de l’activation de la reprise. Cette séparation est technique et crée un doublon de navigation.

Recommandation : un seul onglet « Imports de l’école », avec opérations autorisées selon le contexte et séparation claire profils/contrats versus affectations. **L’import super administrateur actuel traite les affectations professeurs, pas leurs profils/contrats.** Réunir les deux entrées ne suffirait donc pas à fournir une reprise complète des professeurs. Ces opérations et cette nouvelle organisation admin n’ont pas été modifiées dans le correctif historique directeur ; la question et cet écart ont été signalés explicitement.

## Auto-revue

- Consignes standard et références AGENTS/PRODUCT/PROJECT/DESIGN lues ; code existant exploré avant modification. Les décisions complémentaires de l’utilisateur remplacent les attentes initiales de quatre champs sans année et d’accès permanent.
- Périmètre API/web respecté ; aucun travail C8/C9 concurrent, aucun changement de leurs règles de reprise. Aucun agent délégué.
- Contrats profil/inscription préservés ; références historiques distinctes des inscriptions, migration Drizzle idempotente et métadonnées vérifiées.
- HTTP dans le controller, règles dans le service, SQL/transactions dans les repositories ; parsing commun dans `shared`, sans nouvel import croisé backend.
- Permissions et schéma tenant, erreurs standard `/api/v1`, `request.user.userId`, absence de `any`, secrets ou nouveaux logs personnels respectés.
- Aucun nouvel envoi SMS/PDF ni nouvelle queue : l’import prépare seulement les données.
- API frontend centralisée, TanStack Query, shadcn et tokens existants ; glisser-déposer commun, chargements/erreurs/états vides/toasts et nouvelles zones tactiles de 48 px. Le style du menu latéral est inchangé.
- Découvrabilité vérifiée : import historique et import professeur depuis l’étape 4 ; EDT et historique depuis Administration → Import de données ; références depuis la fiche élève.
- Baselines, tests métier, parcours d’intégration et non-régression réalisés. Aucune régression détectée dans les vérifications finales ; limite du test sur téléphone physique explicitée.
- Implémentation du complément historique directeur accomplie ; proposition de réunion des imports admin documentée séparément, sans la présenter comme réalisée.

Message de commit proposé : `fix(import): conserver l’historique élèves et limiter les imports à l’initialisation`.
