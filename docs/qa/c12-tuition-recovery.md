# C12 : configurer les frais requis puis reprendre le paiement

Le parcours caisse affiche l’année et le niveau manquants transmis par le serveur. Un utilisateur avec `tuition.edit` ouvre directement leur configuration dans Paramètres → Finance. Après une sauvegarde applicable et une relecture serveur réussie, il retrouve le même paiement, prêt à être saisi. Sans ce droit, il reçoit l’instruction de contacter le responsable habilité, sans lien de configuration.

## Contrat et décisions

L’erreur conserve `{ error, code: "TUITION_PLAN_REQUIRED", statusCode: 409 }` et ajoute `context: { schoolYearId, schoolYearLabel, levelId, levelName }` lorsque le contexte existe. La requête du repository utilise la classe de l’inscription pour l’année demandée, avec la même résolution que le calcul des frais. Aucun montant ni renseignement personnel n’est ajouté à l’erreur.

Le lien transporte ce contexte et une URL relative canonique `/enrollments/<enrollmentId>/payment`. Toute origine externe, autre dossier, query string, fragment, chemin encodé ou incomplet est rejeté comme destination de retour. Aucun contexte de reprise n’est stocké globalement : le lien reste sur l’origine du tenant courant.

La sauvegarde utilise l’endpoint existant protégé par `tuition.edit`. Les lectures de niveaux, années et plans restent soumises à leurs permissions distinctes. Dans le parcours contextuel, un caissier avec le seul droit d’édition utilise les libellés du contexte serveur sans appeler des lectures auxquelles il n’a pas droit. Aucun refus backend ne déclenche d’endpoint de repli. Aucun montant par défaut n’est inventé.

Après succès, les requêtes `finance` et les résumés de paiement des inscriptions sont invalidés. Le plan renvoyé doit correspondre exactement à l’année et au niveau requis et avoir un montant positif. Le résumé du paiement est ensuite relu sans retry automatique. Un refus, une sauvegarde pour un autre contexte ou une sortie de Finance pendant la sauvegarde ou la vérification empêche le retour automatique. Aucun paiement n’est confirmé automatiquement.

Écart découvert dans le code : le client HTTP transforme Axios en `ApiError`. L’ancien contrôle limité à `axios.isAxiosError` ne reconnaissait donc pas l’erreur réelle. Le correctif lit aussi sa cause conservée.

## Fichiers livrés

Dans `edutrack-api` : `finance.repository.ts`, `finance.service.ts`, `finance.controller.ts`, `enrollments.controller.ts`, `tests/unit/finance.tuition-context.test.ts` et `tests/integration/enrollments.routes.test.ts`.

Dans `edutrack-web` : `EnrollmentPaymentPage.tsx` et son test, `TuitionConfiguration.tsx`, `SettingsPage.tsx`, `nav-items.ts`, `tuition-recovery.ts` et son test, les deux specs navigateur `critical/tuition-recovery.spec.ts` et `review/tuition-recovery.spec.ts`, et cette recette.

## Validation

Baseline avant modification : 62 tests frontend, 18 unités backend et 14 intégrations Finance/Inscriptions réussis sur des services PostgreSQL/Redis jetables.

Validation du correctif :

- 143 tests frontend Finance/Inscriptions/Paramètres/Onboarding/navigation réussis.
- 660 tests unitaires backend réussis.
- 34 intégrations Finance/Inscriptions/caches/relances réussies : contrat, autorisation réelle, année/niveau, sauvegarde invalide et paiement partiel après configuration.
- 2 parcours Chromium mobile avec API réelle réussis : `tuition.edit` seul, persistance après rechargement, et cas sans droit, y compris accès direct au lien contextuel.
- 7 parcours Chromium avec HTTP simulé réussis : mauvaise année, mauvais niveau, refus sans repli, paiement encore refusé, abandon pendant chacune des deux requêtes, accès normal aux paramètres.
- Lint, typage et builds API/web vérifiés.

La suite frontend complète a obtenu 544 succès et 1 échec dans `SchedulePeriods.test.tsx`. Le texte de `SchedulePage.tsx` a été modifié hors C12 pendant la session et ne correspond plus à l’assertion existante. Ce changement a été conservé. Un contrôle navigateur annexe de l’import échoue aussi sur un sélecteur d’onglet « Professeurs » absent. Ces échecs hors C12 sont signalés ; aucune réussite globale de toutes les suites n’est revendiquée.

L’émulation Chromium mobile et le contrôle d’absence de débordement ne remplacent pas une recette sur Tecno/Itel physique, non réalisée ici.

## Auto-revue

Les consignes standard et les références AGENTS/DESIGN/PRODUCT/PROJECT ont été lues. Les modifications applicatives sont limitées à `edutrack-api` et `edutrack-web`. Le correctif conserve le découpage controller/service/repository, les routes et les gardes backend, sans nouvel import croisé backend, migration, dépendance, log personnel, secret ou notification synchrone. L’interface réutilise shadcn et les tokens existants, avec aide explicite, chargement visible, toasts et actions de 48px. Les requêtes restent gérées par TanStack Query. Les règles sensibles de retour et de correspondance sont testées séparément.

Les critères fonctionnels C12 sont accomplis et aucune régression n’est détectée dans les modules concernés. Les limites de validation globale et matérielle ci-dessus restent explicites.

Le paiement reste accessible depuis Vie scolaire → Inscriptions → Caisse. La configuration reste accessible depuis Administration → Paramètres → Finance ; le menu Paramètres accepte désormais aussi `tuition.edit`. Aucun nouvel écran n’a été créé et le style du menu latéral n’a pas été modifié.

## Message de commit proposé

`fix(enrollments): configurer les frais requis et reprendre le paiement`
