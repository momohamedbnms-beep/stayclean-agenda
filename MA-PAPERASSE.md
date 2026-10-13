# Ma Paperasse dans StayClean Agenda

L'espace **« Ma Vie »** de l'accueil est remplacé par **« Ma Paperasse »** : tes papiers perso (factures, amendes, rappels, contrôle technique, preuves de paiement), avec une seule action claire à la fois.

Rien de nouveau à connecter : Ma Paperasse utilise **ton compte**, **ton serveur Supabase** et **ta clé d'IA (Claude ou Gemini)** déjà réglés dans l'agenda.

## Ce qui change dans l'appli

- Accueil : la carte violette **MA PAPERASSE** (avec son logo) remplace MA VIE. Elle affiche un résumé : « 1 en retard · 2 cette semaine ».
- `paperasse.html` : l'espace complet (À faire · Dossiers · Scanner · Preuves). La flèche **‹** en haut à gauche revient à l'accueil.
- **Dossiers rangés par catégorie** (v2) : une chemise colorée par catégorie (Téléphone et internet, Énergie, Eau, Voiture, Assurances, Amendes, Impôts, Logement, Banque, Santé, Achats, Administration, Autres), avec le nombre de papiers, le plus urgent et ce qu'il reste à payer. On touche une chemise → ses papiers : À régler, À vérifier, À garder, et les réglés repliés. Chaque catégorie garde sa couleur partout (lignes, en-tête de la fiche, preuves).
- **Moins de choses à la fois** : sur « À faire », les infos à vérifier tiennent en une ligne ; sur la fiche d'un papier, une action principale, 3 raccourcis, le reste dans « Plus d'options », et « Une question ? » / « Suivi » en onglets.
- L'ancien espace **Ma Vie** n'est pas supprimé : Ma Paperasse → Réglages → « Ouvrir l'ancien espace Ma Vie » (adresse `./#mavie`). Ses documents peuvent être **importés** dans Ma Paperasse en un geste ; rien n'est effacé dans l'agenda.
- Rappels : une notification par jour au maximum, à l'heure choisie (9 h par défaut, heure de Bruxelles), **même appli fermée**. Texte discret par défaut : « 2 choses à faire », sans montant ni nom.

## Installation (une seule fois, ~5 minutes)

### 1. Base de données (Supabase → SQL Editor)

Ouvre le projet `rgfanwbyzsfjlhwwhudg` → **SQL Editor** → colle tout le fichier [`supabase/ma-paperasse.sql`](supabase/ma-paperasse.sql) → **Run**.

Il crée uniquement des éléments préfixés `mp_` / `mp-` (tables, bucket privé `mp-files`, tâche horaire `ma-paperasse-push`). Rien d'existant n'est modifié. On peut le relancer sans risque.

### 2. Fonction des rappels `mp-push`

Avec la CLI Supabase (sur le Mac) :

```bash
supabase functions deploy mp-push --no-verify-jwt --project-ref rgfanwbyzsfjlhwwhudg
```

Sans CLI : Supabase → **Edge Functions** → *Deploy a new function* → *Via Editor* → nom `mp-push` → colle `supabase/functions/mp-push/index.ts` → *Deploy*, puis dans les réglages de la fonction **désactive « Enforce JWT verification »** (la fonction vérifie elle-même l'utilisateur ou le secret du cron).

Aucun secret à saisir : les clés VAPID et le secret du cron sont créés automatiquement côté serveur (table `mp_config`, inaccessible depuis l'appli).
Facultatif : `supabase secrets set MP_VAPID_SUBJECT=mailto:ton@email` (contact affiché aux services de notification ; sinon l'adresse du projet est utilisée).

### 3. Mise en ligne

Publier sur `main` → GitHub Pages met en ligne. Le service worker passe en v36 : l'appli se met à jour au prochain lancement.

### 4. Sur l'iPhone

Ouvre StayClean Agenda **depuis l'icône de l'écran d'accueil** → MA PAPERASSE → ⚙️ Réglages → **Activer les rappels sur cet appareil** → *Autoriser*. Puis « Envoyer un test ».
(iOS 16.4 minimum ; les notifications web ne marchent pas depuis Safari, seulement depuis l'appli installée.)

## Prompt pour Claude Code (sur le Mac)

> Dans le repo stayclean-agenda, branche `ma-paperasse` : lance `supabase/ma-paperasse.sql` sur le projet rgfanwbyzsfjlhwwhudg (via le MCP Supabase si disponible, sinon dis-moi de le coller dans le SQL Editor), déploie `supabase/functions/mp-push` avec `--no-verify-jwt`, vérifie que la tâche cron `ma-paperasse-push` existe (`select jobname, schedule from cron.job`), puis fusionne la branche dans `main` et pousse. Ne touche à aucune autre table.

## Comment c'est construit

| Élément | Rôle |
|---|---|
| `paperasse.html` | La page (même portée que l'agenda : même appli installée, même session). |
| `paperasse/app.js` | Le code, lisible, sans étape de compilation (modules mis bout à bout, sections « ===== »). |
| `paperasse/app.css` | Styles (police Rubik via Google Fonts, comme Poppins dans l'agenda). |
| Bibliothèques | Chargées depuis jsDelivr en version figée avec empreinte SRI : supabase-js 2.117.1 (le même fichier que l'agenda), et à la demande pdf.js 3.11.174, jsQR 1.4.0, JSZip 3.10.1, heic2any 0.0.4. |
| `supabase/ma-paperasse.sql` | Tables, RLS, bucket, tâche horaire. |
| `supabase/functions/mp-push/index.ts` | Envoi des notifications (Web Push chiffré + VAPID), sans dépendance externe. |
| `sw.js` (v36) | + réception des notifications et ouverture de Ma Paperasse au toucher. |

**Données** (toutes privées au compte connecté, RLS `user_id = auth.uid()`) :

- `mp_items` : une ligne par dossier / document / preuve / réglages / plan des rappels (`kind`, `id`, `data` JSON). Synchro incrémentale par `updated_at`, suppression = `deleted = true`.
- Bucket `mp-files` : photos et PDF, chemin `<id du compte>/<AAAA-MM>/<fichier>`. Les fichiers ne sont jamais mis dans un cache hors ligne ; seule la liste des dossiers est gardée sur l'appareil (affichage immédiat, mode hors ligne).
- `mp_push_subs` (téléphones abonnés), `mp_push_log` (1 rappel/jour max), `mp_config` (secrets serveur).

**IA** : la lecture des courriers et les questions passent par le moteur réglé dans l'agenda (Réglages → IA). Claude : `claude-sonnet-5-5` (repli automatique sur `claude-sonnet-4-6` si indisponible), réponse forcée en JSON ; Gemini : `gemini-2.5-flash`. Le contenu des documents est traité comme une donnée, jamais comme une consigne. Sans clé, on remplit les infos soi-même.

**Rappels** : Ma Paperasse calcule le plan (dates, texte) et l'enregistre dans `mp_items` (`remind/plan`). Toutes les heures à :07, `pg_cron` appelle `mp-push`, qui envoie la notification du jour si l'heure choisie est passée (jamais après 21 h) et l'inscrit dans `mp_push_log` pour ne jamais l'envoyer deux fois. Les abonnements morts (404/410) sont retirés.

## Sécurité (à vérifier une fois)

- Supabase → Authentication → Sign In / Providers : **« Allow new users to sign up » doit être désactivé** (tu es le seul utilisateur). La clé publique de l'agenda est visible dans `dispo.html` ; avec les inscriptions ouvertes, un inconnu pourrait créer un compte et remplir le stockage (ses données resteraient séparées des tiennes grâce au RLS, mais le quota est partagé avec l'agenda).
- Les fichiers de Ma Paperasse ne sont lisibles qu'avec ta session (bucket privé + RLS) et ne sont jamais gardés hors ligne sur le téléphone. La copie locale (liste des dossiers, sans fichiers) est dans IndexedDB, pas dans le localStorage de l'agenda, pour ne jamais lui prendre de place.

## Dépannage

- **Bandeau « pas encore installée sur ton serveur »** : l'étape 1 n'a pas été faite (ou pas sur le bon projet).
- **« Les rappels ne sont pas encore installés »** : l'étape 2 n'a pas été faite.
- **« Tu n'es pas connecté »** : connecte-toi dans l'agenda (Réglages → Synchronisation) ; Ma Paperasse réutilise cette connexion.
- **Pas de notification le matin** : vérifier `select * from cron.job_run_details order by start_time desc limit 5;` et `select * from mp_push_log order by sent_at desc limit 5;`.
