# Super administrateur : regroupement des imports de l’école

Réalisé le 27 septembre 2026, uniquement dans `edutrack-web`.

## Résultat et accès

Les onglets « Données professeurs » et « Reprise de données » sont réunis sous **« Imports de l’école »**, accessible depuis **Super administrateur → Écoles → Voir détail → Imports de l’école**.

L’activation de la reprise en cours d’année est déplacée de Configuration vers ce même onglet. Un seul panneau d’import est monté : sans reprise activée, les affectations professeurs restent disponibles ; avec reprise activée, les niveaux, matières, salles, classes, élèves/inscriptions, affectations professeurs et paiements sont accessibles dans le même parcours. Les règles API, permissions et contrôles d’année/aperçu/confirmation restent ceux déjà livrés.

Désactiver la reprise laisse cet onglet ouvert et revient aux affectations professeurs. Le panneau repart sans année choisie, fichier ou aperçu antérieur afin qu’un brouillon ne puisse pas être soumis pour un autre type d’import. Une erreur d’activation conserve les imports autorisés précédemment et affiche le toast d’erreur.

Les liens `?tab=imports`, ainsi que les anciens noms `?tab=teacher-data` et `?tab=import-midyear`, ouvrent l’entrée commune. Les autres onglets conservent leur comportement.

Le regroupement porte sur les opérations existantes. La reprise des profils/contrats professeurs, déjà signalée comme manquante dans le complément C7, ne découle pas d’une fusion de navigation.

## Fichiers

- `src/modules/admin/AdminSchoolDetailPage.tsx` : onglet unique, activation centralisée, retour conservé dans l’onglet, compatibilité des liens et chargement visible.
- `src/modules/admin/components/MidyearImportPanel.tsx` : titres et libellés adaptés à l’entrée commune.
- `src/modules/admin/__tests__/AdminSchoolDetailPage.imports.test.tsx` : accès, activation/désactivation, erreur et liens ; le panneau réel est utilisé.
- Recettes navigateur `midyear-recovery.spec.ts` et `teacher-assignments.spec.ts` : nouvelle entrée et activation/désactivation sur mobile.

## Vérification

Baseline : **89 suites / 491 tests frontend réussis**.

Résultat final : **90 suites / 498 tests frontend réussis**, dont les cinq tests existants du panneau de reprise et sept nouveaux scénarios de navigation/accès. ESLint, build TypeScript/PWA et vérification des diffs réussis.

**Cinq scénarios Chromium avec API réelle** passent sur PostgreSQL/Redis temporaires : reprise élèves avec erreurs, aperçu et confirmation sur mobile et bureau ; refus d’accès au directeur ; onglet unique et activation/désactivation à 360×640 ; import d’affectations professeurs avec contrôle d’erreurs et rappel non bloquant. Le dernier scénario teste explicitement l’absence des anciens onglets et la disparition du fichier lorsque la reprise est désactivée.

La capture `imports-ecole-mobile.png` figure dans les artefacts Playwright du scénario de regroupement. Aucun appareil Tecno/Itel physique n’était disponible : seule l’émulation Chromium mobile est validée. Aucun déploiement ni commit n’a été réalisé.

## Auto-revue

Consignes standard et références du projet respectées : exploration du code réel, périmètre web, composants shadcn/tokens existants, navigation latérale inchangée, nouveaux contrôles à 48 px, chargement et toasts visibles, accès super administrateur et schéma tenant conservés. Aucun changement API/schéma/migration, import croisé backend, log personnel, secret, `any`, queue ou envoi SMS/PDF ajouté.

Baseline vérifiée, tests concernés adaptés et non-régression frontend complète exécutée. Le parcours d’import réel est vérifié depuis la fiche école sur mobile et bureau. Aucune régression détectée ; regroupement demandé accompli, avec la limite matérielle Android explicitée.

Message de commit proposé : `refactor(admin): regrouper les imports de l’école dans un seul onglet`.
