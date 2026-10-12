# Paramètres — chargement des permissions et modèle SMS

## Diagnostic et correction

Au moment de ce diagnostic, le contrat du catalogue backend marquait `report_cards.published_correction` indisponible avec une raison métier et sans dépendance d’activation. La validation frontend exigeait que toute permission sans dépendance soit disponible ; elle rejetait donc une réponse API valide et affichait « Impossible de charger le catalogue des permissions ». Elle accepte désormais les indisponibilités métier explicites, tout en refusant les doublons, les dépendances manquantes et une permission affichée disponible lorsque son service est désactivé. Depuis la délégation des corrections publiées, cette permission est disponible dans le catalogue et peut être attribuée à un poste.

L’onglet Communication restait visible pour la direction quand l’édition des modèles SMS était désactivée. Il appelait alors l’API, qui refuse correctement la lecture faute de `settings.sms_templates`, puis affichait une alerte d’erreur générique. L’écran tient compte du droit effectif reçu de l’API : aucun appel de modèle n’est émis lorsqu’il manque, et l’activation nécessaire est expliquée. Un refus réel ou une panne de lecture conserve un état d’erreur distinct avec « Réessayer ».

L’API renvoie `source: "default"` avec le message système lorsqu’aucun modèle école ou global n’est enregistré. L’interface présente maintenant cet état comme « Aucun modèle SMS personnalisé », explique le message utilisé en attendant et propose « Ajouter un message » puis « Créer le modèle SMS ». La réinitialisation n’apparaît que pour un modèle propre à l’école. Aucun changement backend, autorisation effective ou migration n’est introduit.

## Fichiers

`settings.api.ts`, `SettingsPage.tsx` et `SmsTemplatePanel.tsx` sont modifiés. Les tests concernés sont `settings.school.api.test.ts`, `SmsTemplatePanel.test.tsx` et `e2e/review/permission-catalogue.spec.ts`.

## Vérification et auto-revue

Avant correction, 6 des 10 tests `RoleMatrix` échouaient sur l’erreur de chargement du catalogue. Après correction, les 36 tests du module Paramètres passent, ainsi que les 7 parcours Chromium (dont mobile 393 px, absence de modèle, création et absence d’appel SMS quand le droit est désactivé). Typage, lint des fichiers concernés et build frontend passent.

La première exécution globale avait deux assertions académiques périmées dans `ConductPage.test.tsx` et `SchoolYearsPage.test.tsx` ; elles ont été mises en accord avec les composants actuels. La validation finale passe **695 tests frontend sur 695**, **33 parcours Chromium de revue sur 33** et **201 parcours Playwright QA sur 201**, dont le chargement du catalogue et la création d’un message SMS sans modèle enregistré.

Les changements restent dans `edutrack-web`, réutilisent les composants et tokens existants, respectent les gardes backend, montrent des états distincts de chargement, d’erreur et d’absence de modèle, gardent des actions tactiles de 48 px et affichent une confirmation de mutation. Aucun écran ou item de menu nouveau n’est créé : le catalogue reste sous **Paramètres → Personnel → Nouveau poste / Modifier le poste** ; les SMS restent sous **Paramètres → Communication**.

Message de commit proposé : `fix(settings): charger le catalogue valide et clarifier les modèles SMS absents`
