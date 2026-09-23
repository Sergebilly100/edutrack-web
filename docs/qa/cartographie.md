# Cartographie QA — inventaire IvoirEdu

Référence figée : [inventaire fourni, reproduit intégralement](inventaire-reference.md).
Audit commencé le 22 septembre 2026, avant l’ajout de tests. Les identifiants F01–F37 suivent strictement l’ordre des fonctionnalités de cet inventaire. Les quatre promesses explicitement indisponibles en fin d’inventaire sont exclues des parcours nominaux ; leur absence reste vérifiée lorsqu’elle protège un parcours parent.

## Méthode et baseline

Lecture des consignes standard et des références `archives/{AGENTS,PRODUCT,PROJECT,DESIGN}.md`, examen des configurations, des assertions, des contrôleurs/services et des écrans concernés. La présence d’un fichier nommé « integration » ou « e2e » ne suffit pas à prouver un parcours complet.

- API : Vitest 3, projet `unit`, 48 fichiers / **500 tests réussis** à la baseline (`npm run test:unit -- --run`). Le fichier `src/modules/dashboard/__tests__/economy-calculation.test.ts` est hors du glob actuel et n’est donc pas compris dans ce chiffre.
- Web : Vitest + Testing Library, **380 tests découverts, 359 réussis, 11 échecs, 10 ignorés** à la baseline. L’inventaire mentionnait 378 tests / 9 échecs : cette mesure est antérieure au présent audit.
- API HTTP : Vitest + Fastify + Supertest/inject. Une partie des fichiers substitue le service : ce sont des tests de contrat HTTP, pas de persistance. Les tests utilisant `tests/integration/setup.ts` exercent les vrais services et PostgreSQL ; SMS et certaines queues PDF sont substitués.
- Navigateur : **Playwright existe déjà**, dépendance `@playwright/test`, scripts `e2e`, `e2e:ui`, `e2e:debug`, `e2e:report`, configuration `playwright.config.ts`. Projets directeur/professeur/staff/parent sur Pixel 5 émulé, admin sur Chromium desktop. La majorité des parcours intercepte les API ; certains utilisent une vraie API de démonstration. Le dossier `e2e/subscriptions` n’est sélectionné par aucun projet actuel.
- Reproductibilité : `.gitignore` API ignore une grande partie des tests et le setup ; `.gitignore` web ignore tout `e2e/`. Les tests concernés doivent être versionnables sans inclure les sessions `.auth`, vidéos ou rapports.

**Légende :** U = unitaire métier ; C = composant ou client web ; H = HTTP avec services substitués ; I = API avec base réelle ; B = navigateur (API souvent simulée). Les chemins U/I/H sont relatifs à `edutrack-api/tests/{unit,integration}` ; C à `edutrack-web/src` ; B à `edutrack-web/e2e`. « Pas de B dédié » n’est pas automatiquement un manque : les micro-actions CRUD restent aux niveaux U/I et en recette manuelle.

## Couverture existante et manques constatés avant ajout

### Suivi de l’assiduité

| ID / fonctionnalité | Preuves existantes | Manque / action QA |
|---|---|---|
| F01 Pointage QR | U `attendance.service`, `attendance.repository` ; H `qr-scan.routes` ; I `check-in` ; B `teacher/{checkin,qr-scan}` | Relier QR, appel et consultation persistée dans un même scénario I. |
| F02 Appel par cours | U `attendance.service` ; H `attendance.routes` ; C `TeacherFlow.{confirmation,resubmit}` ; B `teacher/attendance` | Même chaîne I : absent puis correction, lecture et justification. |
| F03 Historique/justification des absences | U `students.{service,repository}` ; H `students.routes` ; C `StudentAbsence{Panel,Detail}`, `AttendanceSheet` | Justification persistée via vraie API, refus d’un rôle sans droit, filtres. |
| F04 Validation des heures | U `validations.service`, `attendance.geo-auto-approve` ; I `validations.routes` ; B `director/{validations,geo-review}` | Parcours déjà présent ; contrôler les attentes navigateur et conserver les assertions de paie. |
| F05 Appel hors connexion (limité à l’assiduité) | C `TeacherFlow.offline`, `useOfflineMutation`, `offline-hooks`, `offline-owner-filter` ; B `teacher/{offline-sync,offline-workflow}` | Vérifier les assertions effectives de synchronisation, les tests ignorés et leur sélection. Un test navigateur avec API simulée ne prouve pas le service worker en production. |

### Organisation quotidienne

| ID / fonctionnalité | Preuves existantes | Manque / action QA |
|---|---|---|
| F06 EDT, créneaux, salles, professeurs | U `schedule.{service,repository,schemas}`, `teachers.service` ; H `schedule.routes` ; I `schedule.{history,blocked-teacher}.routes`, `teachers.routes` ; B `director/schedule-periods` | Ajouter duplication/lecture avec persistance à la chaîne d’organisation ; réviser les attentes de navigation. |
| F07 Salles et QR | U `rooms.service` ; H `rooms.routes` ; I `multi-tenant.isolation` (lecture) ; C `RoomsPage` ; B `director/rooms` | CRUD + régénération QR avec base réelle, protection d’une salle affectée. |

### Paie enseignante

| ID / fonctionnalité | Preuves existantes | Manque / action QA |
|---|---|---|
| F08 Calcul de paie | U `billing.{service,actual-minutes}` ; I `billing.routes`, H concurrence `billing.race-conditions` ; B `director/salary` | Nominal, recalcul, déjà payé, partiel et fixe existent ; vérifier leur exécution complète. |
| F09 Versements, historique et PDF | U `pdf.{templates,format}`, `export-pdf` ; I `billing.routes` (individuel/lot/queue) ; B `director/salary` | Distinguer demande de PDF et contenu réellement généré ; fournisseur de stockage hors recette automatisée locale. |

### Inscriptions et dossiers

| ID / fonctionnalité | Preuves existantes | Manque / action QA |
|---|---|---|
| F10 Inscription jusqu’à la caisse | U `enrollments.service` ; I `enrollments.routes`, `critical-path-e2e.routes` ; C `NewEnrollmentPage`, `EnrollmentPaymentPage` | Pas de parcours navigateur inscription → confirmation. Ajouter un parcours critique. |
| F11 Documents exigés | U `enrollments.service` ; I `enrollments.routes` ; H `documents.routes` (fichier) ; C `DocumentChecklist`, `RequiredDocumentsSettings` | Renforcer les règles isolées de pièces obligatoires/archivées, doublons, références de fichier ; ne pas assimiler le double R2 au stockage réel. |
| F12 Réinscription par l’école | U `enrollments.service`, `class-decisions.service` ; I `enrollments.routes` (dette, remise, transition d’année) | Les scénarios métier existent ; documenter conditions exactes et absence d’autonomie parent. |
| F13 Dossier chronologique | I `student-dossier.routes` ; C `StudentDossierTimeline` | Orchestration sans calcul métier séparé : I pertinent, pas d’unitaire artificiel ; vérifier événements et restrictions. |
| F14 Comptes parents issus du dossier | U `parent-portal.lifecycle` ; I `parent-auth`, `import` | Création/réutilisation/multi-enfants/envoi différé déjà testés ; livraison réelle SMS à vérifier manuellement. |

### Finance et recouvrement

| ID / fonctionnalité | Preuves existantes | Manque / action QA |
|---|---|---|
| F15 Frais, échéancier, remise | U `finance.calculations` ; I `finance.routes` | Frontières de dates/montants et séparation remise/encaissement à compléter si absentes. |
| F16 Encaissement rapide | I `finance.routes`, `financial-cache.routes` ; C `QuickPaymentEntry` ; B `director/finance` | Relier paiement, solde et annulation persistés ; scénario navigateur existant à conserver. |
| F17 Import paiements/mapping | U `import-mapping.engine` ; I `payment-import.routes` | Analyse, réassociation et ligne inconnue existent ; vérifier mémoire du mapping et absence d’écriture au simple aperçu. |
| F18 Historique, reçus, annulations | U `finance.reports`, `finance.calculations` ; I `finance.routes` | Couvrir refus de répétition d’une confirmation/annulation et solde final sans doublon. |
| F19 Journal et exports | U `finance.reports` ; I `finance.routes` | Vérifier contenu/format de l’export, pas uniquement HTTP 200. |
| F20 Tableau de recouvrement | U `financial-cache.service` ; I `financial-cache.routes`, `critical-path-e2e.routes` | Actualisation sur paiement/annulation/remise ; ne pas confondre montant couvert et encaissement. |
| F21 Relances automatiques | U `financial-alerts.service` ; I `financial-alerts.routes` | Règles, pagination, courbe individuelle présentes ; consommation effective par worker et fournisseur SMS à distinguer. |
| F22 Finance parent | I `finance.routes`, `parent-overview.routes`, `multi-tenant.isolation` ; C `ParentPaymentsPage` | Isolation déjà couverte ; vérifier reçus et bouton de paiement toujours désactivé. |

### Pédagogie, conduite et décisions

| ID / fonctionnalité | Preuves existantes | Manque / action QA |
|---|---|---|
| F23 Évaluations/notes | U `academic-grading.{calculations,service,types}` ; I `academic-grading.routes` ; C `NotesPage` ; B `teacher/academic` | Corriger les attentes devenues obsolètes ; conserver saisie sans créneau et verrouillage après validation. |
| F24 Notes spontanées | U `academic-grading.spontaneous-window` ; C `CourseCard.rollcall-windows` ; I `academic-grading.routes` | Vérifier les bornes exactes (fenêtre actuelle : cours puis 24 h), signe/justification et absence de recalcul illégal. |
| F25 Calcul/validation moyennes | U `academic-grading.calculations`, `academic-grading.service` ; I `academic-grading.routes`, `critical-path-e2e.routes` ; C `CalculationPage` ; B `teacher/academic` | Réparer les sélecteurs de détail devenus icônes et tester validation/refus de données incomplètes. |
| F26 Bulletins/publication/PDF | U `report-cards.service` ; I `report-cards.routes`, `critical-path-e2e.routes` ; C `ReportCardsPage` | Aucun B publication → consultation parent. Ajouter un parcours critique ; prouver que les brouillons ne sont pas visibles au parent. |
| F27 Décisions de fin d’année | U `class-decisions.service`, `academic.service` ; I `class-decisions.routes`, `admin.school-year.routes` ; C `ClassDecisionsPage`, navigation | Seuil/permissions déjà présents ; adapter le test de réglage de date à l’onglet actuel. |
| F28 Conduite finale | U `conduct.service` ; I `conduct.routes` ; C `ConductPage`, `CalculationPage` | Pas de B décision finale. Écart inventaire : le service autorise le professeur principal **sans** `conduct.finalize`, ou l’éducateur assigné qui détient ce droit. Ne pas réintroduire l’ancienne restriction par un test de menu. |

### Communication et parents

| ID / fonctionnalité | Preuves existantes | Manque / action QA |
|---|---|---|
| F29 Portail multi-enfants | U `parent-portal.lifecycle` ; I `parent-auth`, `parent-overview.routes`, `multi-tenant.isolation` ; B `parent-portal/parent-flow` | Vérifier changement d’enfant et publication dans le parcours critique parent. |
| F30 Alerte d’absence | U `notifications.{events,queue,service,sender,sms}` | Événement après appel à relier à F02 en I ; envoi fournisseur non prouvé par les doubles. |
| F31 Abonnements Alertes Parents | U `subscriptions.service` ; I `subscriptions{,.constraints,.isolation}` ; C `CreateSubscriptionModal` ; B `subscriptions/create-subscription` **non sélectionné** | Rendre la sélection Playwright explicite ; préserver garde feature, droits et cycle création/annulation/renouvellement. |

### Direction et accès

| ID / fonctionnalité | Preuves existantes | Manque / action QA |
|---|---|---|
| F32 Tableau de bord | U `dashboard-actions.service` ; I `dashboard-actions.routes` ; C `DashboardPage`, `DashboardStatsCards` ; B `director/dashboard` | Calcul d’économie hors glob ; attentes de navigation et accueil professeur à réaligner. |
| F33 Règles de vigilance | U `risk.service` ; I `risk.routes` ; C `RiskAlertRules` ; B `director/settings` | Ne pas promettre une liste nominative depuis les compteurs ; recette réglage → relecture. |
| F34 Personnel et permissions | U `permissions.service` ; H `permissions.routes` ; I quotas/permissions dans autres modules ; B `staff/{navigation,settings}` | Ajouter un cycle réel poste → utilisateur → attribution → accès → révocation. |

### Mise en route

| ID / fonctionnalité | Preuves existantes | Manque / action QA |
|---|---|---|
| F35 Assistant de configuration | B `director/onboarding` (première étape seulement) ; I imports/config séparés | Ajouter progression des cinq étapes et persistance de la fin de configuration ; pas de logique pure distincte à dupliquer artificiellement. |
| F36 Imports élèves/profs/EDT | U `import.service`, `import.templates-packaging` ; I `import` ; C `ImportWizard` | Parcours dry-run/confirm/idempotence existants ; vérifier historique et fichiers d’exemple disponibles. |
| F37 Reprise en cours d’année | U `import-mapping.engine` ; I `midyear-flag.routes` (niveaux seulement) ; C `MidyearImportPanel` | Compléter la chaîne niveaux → matières → salles → classes → élèves → parents → soldes, garde feature et refus directeur ; anciennes notes exclues. |

## Résultats après compléments

Validation du 23 septembre 2026, Node 24.11.1 / npm 11.6.2, services locaux jetables. Extraits des sorties : [resultats.txt](resultats.txt). Commandes et préparation : [execution.md](execution.md). Auto-revue et commits proposés : [auto-revue.md](auto-revue.md).

| Suite | Baseline | Résultat final |
|---|---|---|
| API unitaires | 500 réussis / 48 fichiers | **527 réussis / 49 fichiers**, aucun échec ou test ignoré |
| API intégration/contrats HTTP | 357 réussis, 9 échecs, 1 ignoré / 367 | **382 réussis / 46 fichiers**, aucun échec ou test ignoré |
| Web Vitest | 359 réussis, 11 échecs, 10 ignorés / 380 | **380 réussis / 80 fichiers**, aucun échec ou test ignoré |
| Playwright | 45 réussis, 47 échecs, 12 ignorés / 104 | **112 réussis**, aucun échec ou test ignoré dans `e2e:qa` |
| Build API / web | Vérification finale | **Réussis** tous les deux |
| Lint API / web | Vérification finale | **Réussis** tous les deux, zéro avertissement de lint |

Le contrôle financier ciblé a été rejoué après le dernier ajustement de remise : **9/9 tests réussis**. Le build web signale encore la taille du chunk React existant, sans échec. Les nombres avant/après reflètent aussi la sélection effective, le remplacement de squelettes ignorés et les tests obsolètes supprimés ; ils ne représentent pas seulement des ajouts. Les 112 exécutions Playwright comprennent le setup parent obligatoire ; les trois scénarios `critical-real` ont tous réussi avec API et PostgreSQL réels.

### Fermeture des écarts, fonctionnalité par fonctionnalité

Les chemins ci-dessous complètent les preuves initiales. « Conservé » signifie que les tests existants ont été exécutés dans la suite complète ; les doublons artificiels n’ont pas été ajoutés pour augmenter le compteur. Chaque ID possède également sa fiche dans [tests-manuels.md](tests-manuels.md).

| ID | Complément ou vérification finale |
|---|---|
| F01 | I `qa.school-workflows.routes` relie check-in, QR valide, appel et lecture persistée ; B QR/pointage existants exécutés. Caméra physique réservée à la recette. |
| F02 | Même I : absence → correction présente → nouvelle absence, sans duplication de ligne ; événement d’absence vérifié. B appel existant exécuté. |
| F03 | Même I : lecture de l’historique, justification persistée, refus staff 403 et répétition 409. C des panneaux conservés. |
| F04 | I `validations.routes` et B validations/GPS exécutés ; filtres et sélecteurs remis en accord avec les onglets actuels. |
| F05 | C `useOfflineMutation` couvre l’erreur réseau encapsulée dans `ApiError` et le refus de rejouer les erreurs HTTP 400/403/409/500. B synchronisation/assertions actualisés. |
| F06 | I `qa.school-workflows.routes` vérifie les quatre affectations copiées, la lecture de la nouvelle période et la conservation de la source. B création/modification actuel ; ancien test UI de duplication ignoré supprimé, car ce bouton n’existe pas. |
| F07 | I `qa.school-workflows.routes` : création, GPS/rayon, rotation du token, relecture, suppression libre et refus 409 d’une salle affectée. U/B existants conservés. |
| F08 | U/I paie conservés ; I `qa.dashboard-calculation.routes` ajoute quatre calculs SQL de paie/économie selon présence et validation. |
| F09 | I paie individuelle/lot/queue et U modèles PDF conservés ; B salaire adapté à l’interface actuelle. Stockage/téléchargement externe manuel. |
| F10 | U `qa.workflow-rules` ajoute les transitions interdites ; B **API réelle** `critical/workflows` effectue inscription, dossier, dépassement refusé, versement et relecture. I `critical-path-e2e.routes` corrigé avec la date d’évaluation désormais requise. |
| F11 | U `qa.workflow-rules` : obligatoire/facultatif/archivé/fourni, doublon de pièce et référence de fichier absente ou conservée. I dossier/H stockage et C checklist exécutés. |
| F12 | U transitions `blocked_unpaid` renforcées ; I réinscription/dette/remise/décisions conservés. Pas de parcours autonome parent inventé. |
| F13 | I `student-dossier.routes` exécuté ; fiche manuelle corrigée sur l’onglet réel « Fil d’activité ». Pas d’unitaire de simple délégation ajouté. |
| F14 | U lifecycle et I `parent-auth` exécutés ; I reprise F37 vérifie aussi le lien créé. SMS d’accès réel reste à réceptionner manuellement. |
| F15 | U `qa.workflow-rules` ajoute seuils exacts, remise, gratuité individuelle, dates identiques/cumuls ; I plans/courbes/ajustements conservés. |
| F16 | B saisie rapide conservé ; B **API réelle** caisse vérifie le paiement de 25 000 et la confirmation persistée. I finance/cache conservés. |
| F17 | U mapping et I `payment-import.routes` exécutés : profil, aperçu, import et ligne inconnue. Tests préexistants rendus versionnables. |
| F18 | I finance confirmé/annulé et U relevés conservés ; B caisse contrôle le reçu de caisse et l’absence de seconde confirmation. PDF externe manuel. |
| F19 | U `finance.reports` vérifie la forme/contenu des relevés et exports ; I finance exécuté. |
| F20 | U frontières financières renforcées ; I `financial-cache.routes` et chaîne inscription/paiement existante exécutés. Le worker réel de la fixture navigateur recalcule les soldes avant relance. |
| F21 | U messages et orchestration des canaux ; I `qa.financial-alert-delivery.routes` : destinataires parents, isolation, lecture, parent inactif, reprises, paiements anticipés/remises/courbe. B **API réelle** cloche → paiements → lecture persistée. |
| F22 | I précédent vérifie année active UUID → API de solde ; C `ParentPaymentsPage` couvre absence d’année et chargement ; B **API réelle** choisit le bon enfant depuis sa relance. |
| F23 | C Notes/Calculation actualisés ; B `teacher/academic` remplace les réponses statiques par une saisie/relecture cohérente. I notes conservés ; date exigée dans la chaîne critique corrigée. |
| F24 | U fenêtre spontanée et I notes exécutés ; C disponibilité de l’action adapté au début de cours effectivement confirmé. |
| F25 | C boutons de détail identifiables ; B **API réelle** ouverture du calcul et validation des moyennes avant publication ; U/I pondérations conservés. |
| F26 | B **API réelle** génération/publication/parent, brouillons absents, moyenne 16,40 ; C `ParentReportCardsPage` reproduit le cache vide récent et valide sa réactualisation. PDF externe manuel. |
| F27 | U/I décisions et ouverture d’année conservés ; C réglage de date et menu adaptés aux écrans actuels. |
| F28 | U `qa.workflow-rules` refuse période close/non courante ; C classe paginée au-delà de 100 ; B **API réelle** décision 18/20 conservée et intégrée au bulletin. |
| F29 | B parent actuel répare les attentes de compte et changement de mot de passe ; B critique relit deux enfants ; I isolement multi-tenant/parent conservés. |
| F30 | I F02 vérifie l’émission de l’événement pour l’élève absent ; U notifications existants vérifient service, queue et adaptation SMS. Pas de réception opérateur prétendue. |
| F31 | Projet Playwright `subscription-tests` sélectionné : création avec tarification de deux mois, relecture, annulation motivée, renouvellement ; téléphone invalide et remise à zéro du formulaire. I droits/contraintes/isolement conservés. |
| F32 | I `qa.dashboard-calculation.routes` remplace le fichier non sélectionné qui recalculait lui-même les valeurs attendues ; quatre réponses API réelles vérifient économies et heures payables. C/B dashboard exécutés. |
| F33 | U/I règles et C/B paramètres exécutés ; accès aux onglets réparé sur mobile. Aucune liste nominative inexistante promise. |
| F34 | I `qa.school-workflows.routes` : compte, connexion, poste, attribution, consultation, écriture refusée, révocation et suppression. C authentification conserve les trois droits bulletins/conduite auparavant filtrés. |
| F35 | B `director/onboarding` parcourt les cinq étapes avec réponses d’API simulées persistantes, blocage sans professeur et reprise après rechargement ; I school info → fin de configuration réelle et refus professeur. |
| F36 | U modèles et I import existants exécutés ; B accès à l’import et navigation corrigés. |
| F37 | I `midyear-flag.routes` complète les six types d’import, mémorise/relit les mappings et vérifie coefficient, QR, élève/classe, parent lié et paiement initial de 30 000 ; zéro ancienne note. |

### Écarts métier et techniques corrigés

- **Relances :** contrairement au texte de l’inventaire, le dépôt courant ciblait déjà les comptes parents actifs. Ce comportement est désormais prouvé par la vraie API et le navigateur. Les défauts corrigés portent sur le rappel préventif qui annonçait un retard, les échéances déjà couvertes et le suivi/rejeu indépendant des canaux. Les anciens journaux combinés `both` réussis restent reconnus pour éviter un renvoi immédiat.
- **Finance parent :** la configuration renvoyait le libellé public de l’année ; les routes financières attendent un UUID. Elle renvoie maintenant l’identifiant de l’année active du tenant, avec état explicite si aucune année n’est ouverte. Le test de régression a échoué avant correction puis réussi après.
- **Bulletin parent :** un cache récent vide pouvait masquer une publication faite dans une autre session ; la liste est maintenant revalidée à l’ouverture/changement d’enfant. Régression reproduite avant correction.
- **Reprise :** l’import de parents tentait de mettre à jour une colonne `parents.updated_at` inexistante ; l’upsert utilise le téléphone réel sans inventer de migration.
- **Conduite :** `limit: 200` était rejeté par l’API, plafonnée à 100 ; toutes les pages sont maintenant lues. Les droits professeur principal/éducateur sont documentés selon le service actuel.
- **Accès et interface :** droits `report_cards.view`, `report_cards.publish`, `conduct.finalize` préservés à la connexion ; action d’inscription de l’état vide réparée ; libellés accessibles ajoutés aux icônes de calcul ; onglets de paramètres lisibles sur mobile.
- **Hors connexion :** l’erreur Axios était encapsulée et échappait à la mise en attente ; sa cause réseau est désormais reconnue sans rejouer une vraie erreur HTTP.
- **Banc de test :** connexion de test imposée avant les imports ; port HTTP maintenu pendant la vie du harness pour éviter les réponses d’une application précédente ; nettoyage limité au tenant du test ; tests auparavant ignorés par Git rendus versionnables sans sessions ni secrets.

### Portée des résultats

Les quatre promesses parent inaccessibles restent exclues. Aucun nouveau framework E2E n’était à décider : Playwright était installé et utilisé. Les limites QR/GPS physiques, SMS, Web Push, stockage PDF et service worker à froid sont explicitées dans [execution.md](execution.md). Un passage au vert ne constitue pas une couverture de 100 % des lignes, ni un procès-verbal de ces services externes.
