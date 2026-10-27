# Mon Coran dans StayClean Agenda

Cinquième carte de l'accueil : **MON CORAN**. On ouvre, on sait quoi apprendre, on écoute, on répète, on récite sans regarder, et on voit ses progrès. Tout est en français ; le texte du Coran reste en arabe, avec la phonétique et la traduction du sens en option.

Section **privée** : rien n'est mélangé aux données professionnelles (`agenda_state`, compta, clients).

## L'appli (`coran.html`)

| Onglet | Ce qu'on y fait |
|---|---|
| **Apprendre** (par défaut) | « Un peu chaque jour » : la sourate et le passage du moment, **Commencer ma séance** ou **Reprendre ma séance**, « Environ 10 min », les révisions prévues. Au premier lancement : 5, 10 ou 15 minutes (10 présélectionné, modifiable, on peut passer). |
| **Lire** | Les 114 sourates : recherche par nom français, nom translittéré, nom arabe, numéro, verset (`2:255`), page (`page 42`) ou juz (`juz 30`). Reprise automatique de la dernière lecture, favoris avec étiquette libre, sourates / juz / pages. |
| **Mes progrès** | Sourates travaillées, récitées sans aide, révisions prévues, jours de pratique. Une ligne par sourate : état écrit + « x étapes sur 6 ». |

Réglages (icône en haut à droite) : ambiance (**Vert doux**, **Papier**, **Nuit**), durée, nombre de répétitions, silence pour répéter, parcours, récitateur, rappel, texte hors ligne, audio téléchargé, enregistrements, sauvegarde, sources.

### Lecteur

- 5 affichages : Arabe · Français · Arabe + français · Arabe + phonétique · Arabe + phonétique + français. L'affichage choisi est gardé (en séance, « Arabe + phonétique » par défaut avec **Voir le sens**).
- **Verset par verset** ou **Pages du Coran** : 604 pages du Mushaf de Médine. Le découpage page ↔ versets est exact (métadonnées Tanzil) ; les lignes sont recomposées pour l'écran, c'est écrit sous la page.
- Changer d'ambiance, d'affichage ou de taille garde le verset à l'écran (l'appli retient le verset sous la barre du haut, pas une position en pixels).
- Texte arabe de droite à gauche, numéros de verset dans l'étoile à huit branches, jamais seuls en début de ligne. Le français est marqué « Traduction du sens — Rachid Maach (QuranEnc, version 1.0.3) ». Les notes du traducteur sont derrière **Comprendre**.
- Lecteur audio discret : lecture continue, répéter un verset (3, 5, 10 fois, en boucle), répéter un groupe de versets, silence entre les répétitions, précédent / suivant, arrêt immédiat. Jamais de lecture automatique, jamais deux sons à la fois. Plein écran.

### Une séance (méthode en 4 étapes)

1. **Écouter** la récitation en suivant le texte (le récitateur est nommé).
2. **Répéter** : écoute, puis silence pour répéter à voix haute ; 3 fois par défaut (réglable), « Encore une fois », « Masquer le texte ». C'est un réglage pédagogique, pas une règle religieuse.
3. **Réciter** : le texte est masqué et l'audio coupé. « À toi, sans regarder. » **Un indice** révèle un mot, **Réafficher le texte** montre tout : dans les deux cas la tentative compte « avec aide » (le bouton « Sans aide » est désactivé). Puis : **Sans aide**, **Avec une hésitation** ou **À retravailler**. Ensuite on réécoute la référence pour corriger.
4. **Relier** : on récite l'enchaînement avec les versets précédents. Quand tous les versets sont travaillés, l'appli propose la sourate entière, de mémoire.

Les révisions prévues passent **avant** le nouveau. Plusieurs versets qui se suivent sont révisés d'une seule récitation (6 versets au plus ; chacun garde son calendrier). Après une absence de 4 jours ou plus : « On reprend tranquillement. », 3 révisions au plus et pas de dette.

Enregistrement facultatif de sa voix pour se réécouter : il reste sur le téléphone (IndexedDB), supprimable, jamais envoyé. Aucune note automatique de tajwid, aucune voix synthétique, aucune « certification ».

### Révisions espacées (choix de conception, réglable dans le code)

- Départ à la **première récitation sans aide** : J+1, J+3, J+7, J+14, J+30 (repères comptés depuis cette première réussite), puis entretien (écart doublé, de 30 à 120 jours).
- **Avec une hésitation** : la prochaine révision est rapprochée (écart divisé par deux).
- **À retravailler** : revue le lendemain, l'espacement repart deux crans plus bas. Une reprise réussie le jour même aide à apprendre mais ne remplace pas la révision du lendemain.
- Une sourate entière réussie sans aide « couvre » les révisions de ses passages.
- Référence : Cepeda et al. (2006), *Distributed practice in verbal recall tasks* ; pour la récitation de mémoire : Roediger & Karpicke (2006), *Test-enhanced learning*.

### Les 6 étapes d'une sourate

1. J'ai écouté la sourate. 2. J'ai travaillé tous ses versets. 3. J'ai récité chaque verset sans aide. 4. J'ai récité la sourate entière sans aide. 5. Je l'ai récitée à nouveau sans aide le lendemain ou plus tard. 6. … au moins une semaine après la première réussite complète.

Les étapes 5 et 6 demandent une **nouvelle récitation** à la bonne date : elles ne se cochent jamais toutes seules. « Parcours validé à 100 % » décrit le parcours dans l'appli, pas la mémoire. États : *À découvrir*, *En apprentissage*, *Mémorisée — auto-évaluation*, *À revoir* (une difficulté n'efface jamais le travail fait). **Vérifiée avec un enseignant** est une mention que tu renseignes toi-même ; l'appli l'affiche comme telle.

### Parcours proposé (modifiable)

Al-Fatiha (avec « Je la connais déjà » : essai de récitation complète), puis Al-Ikhlas, Al-Falaq, An-Nas, Al-Kawthar, Al-Asr, Al-Kafirun, puis le reste de Juz Amma des sourates les plus courtes aux plus longues. Le parcours ne change jamais l'ordre du lecteur. Al-Fatiha n'appartient pas à Juz Amma (référence : https://quran.com/fr/juz/30).

## Sources et droits

Fichiers d'origine copiés tels quels dans `coran/sources/raw/` ; empreintes SHA-256, adresses et licences dans `coran/sources/SOURCES.json`. `coran/sources/build.py` vérifie les empreintes, contrôle tout et produit `coran/data/`.

| Contenu | Source | Conditions |
|---|---|---|
| Texte arabe | **Tanzil Quran Text, Uthmani 1.1**, lecture Hafs, numérotation koufique (6 236 versets), avec marques de pause et de prosternation | CC BY 3.0, copie verbatim uniquement, lien vers tanzil.net, bloc de copyright conservé (affiché dans Sources) |
| Sourates, juz, pages, prosternations | **Tanzil Quran Metadata 1.0** (Mushaf de Médine, 604 pages) | CC BY 3.0 |
| Traduction du sens | **Rachid Maach, QuranEnc** (`french_rashid`, version 1.0.3), notes du traducteur incluses | Ne rien modifier, citer QuranEnc, le traducteur et la version ; vérifier de temps en temps s'il existe une version plus récente |
| Phonétique | **Tanzil `en.transliteration`** (2010) : translittération aux conventions anglaises (`ee`, `oo`, `AA` pour ʿayn…) | Usage non commercial (usage privé ici) |
| Noms français des sourates | Wikipédia FR, *Modèle:Palette Sourate/liste* (révision 225651281) | CC BY-SA 4.0 |
| Audio | **EveryAyah.com**, verset par verset : Mahmoud Khalil Al-Husary (par défaut), Mohamed Siddiq Al-Minshawi, Mishary Rashid Alafasy — murattal, Hafs | Pas de licence de redistribution publiée : rien n'est copié dans ce dépôt ; lecture en ligne, et téléchargement **sourate par sourate, sur demande**, pour un usage personnel |
| Police arabe | **Amiri Quran** (sous-ensemble arabe, 45 Ko) | SIL OFL 1.1 (`coran/fonts/OFL-Amiri.txt`) |
| Police latine | **Rubik** | SIL OFL 1.1 (`coran/fonts/OFL-Rubik.txt`) |
| Illustration | Livre vert fermé sur un pupitre en bois, générée une seule fois pour l'appli, sans texte | — |

Contrôles faits à la construction : 114 sourates, 6 236 versets, numérotation continue, nombre de versets par sourate, 604 pages et 30 juz cohérents, basmala en tête des sourates 2 à 114 (sauf 9) retirée du verset 1 et affichée à part, équilibre des balises de la phonétique, renvois aux notes de la traduction. Recoupement avec les données de Quran.com : 0 écart (pages, nombre de versets, lieu de révélation).

**Rien n'est généré** : aucun verset, aucune traduction, aucune phonétique, aucune récitation ne vient d'une IA ou d'une conversion automatique. Une ressource absente est signalée, jamais remplacée. La traduction automatique du navigateur est désactivée sur ces textes.

## Installation (une seule fois)

1. **Base de données** : Supabase → SQL Editor → colle [`supabase/mon-coran.sql`](supabase/mon-coran.sql) → **Run**. Il crée seulement la table `qr_items` (RLS : chaque compte ne voit que ses lignes). On peut le relancer sans risque. Sans cette étape, Mon Coran fonctionne quand même, mais **sur ce téléphone seulement** (c'est écrit dans Mes progrès et les réglages) ; l'export / import JSON reste possible.
2. **Mise en ligne** : publier sur `main` → GitHub Pages. Le service worker passe en v38.
3. Sur l'iPhone : ouvre StayClean Agenda **depuis l'icône** → MON CORAN.

## Comment c'est construit

| Élément | Rôle |
|---|---|
| `coran.html` | La page (même portée que l'agenda : même appli installée, même session). |
| `coran/app.js` | Le code, lisible, sans étape de compilation (sections « ===== »). |
| `coran/app.css` | Styles et les 3 ambiances (contrastes vérifiés). |
| `coran/data/index.json`, `coran/data/s/001…114.json` | Contenu préparé par `build.py` (texte, phonétique, traduction, notes, pages, juz). |
| `coran/fonts/`, `coran/livre-sur-pupitre.webp` | Polices et illustration. |
| `supabase/mon-coran.sql` | Table `qr_items`, RLS, droits. |

**Données** (privées au compte connecté) : table `qr_items`, une ligne par élément, `kind` = `prefs` (réglages), `pos` (dernière lecture), `fav` (favoris), `attempt` (une ligne par tentative, jamais modifiée), `progress` (étapes par sourate), `review` (calendrier de révision). Ouvrir un verset n'est jamais compté comme une réussite. Synchro incrémentale par `updated_at` (posé par le serveur), le plus récent gagne, suppression = `deleted = true`. Copie locale dans IndexedDB (`mon-coran`) pour un affichage immédiat et hors ligne ; la séance en cours, l'audio téléchargé et les enregistrements restent sur l'appareil. Résumé de la carte d'accueil : `qr.summary.v1`. Aucun texte du Coran n'est stocké dans la base.

## Limites connues (dites dans l'appli)

- **Phonétique** : aucune source francophone vérifiable n'a été trouvée ; c'est la translittération Tanzil (conventions anglaises), avec une aide de lecture et le rappel d'écouter la récitation.
- **Versets longs** : le texte est découpé seulement aux marques de pause du texte source (jamais au milieu d'un mot) ; l'audio lit le verset entier, faute de minutage par mot disponible sans accès Quran Foundation (identifiants serveur requis ; son environnement de test ne contient pas tout le Coran).
- **Rappel** : par événement de calendrier (fichier `.ics` ou Google Agenda), activé explicitement ; pas de notification poussée.
- **Hors ligne** : le texte d'une sourate déjà ouverte reste lisible ; « Garder le texte hors ligne » prépare les 114. L'audio hors ligne se télécharge sourate par sourate.

## Dépannage

- **« Sauvegarde sur ce téléphone uniquement »** : l'agenda n'est pas connecté à un compte, ou l'étape 1 n'a pas été faite.
- **« La récitation n'a pas pu être chargée »** : réseau ou serveur audio indisponible ; réessayer, ou continuer sans l'audio.
- **« Ce navigateur n'enregistre pas ta progression »** : navigation privée ou stockage plein ; ouvrir depuis l'icône, exporter une sauvegarde.

## Tests

```
python3 -m http.server 8765 --bind 127.0.0.1   # depuis la racine du dépôt
cd tests/coran && python3 session.py && python3 reviews.py && python3 reader.py && python3 content.py && python3 agenda.py
npm install @supabase/supabase-js@2.117.1 && python3 sync.py   # sauvegarde sur le compte, avec un faux serveur
```

Audio remplacé par un bip local, faux serveur Supabase en mémoire, données fictives, dates simulées : aucun service réel n'est appelé.
