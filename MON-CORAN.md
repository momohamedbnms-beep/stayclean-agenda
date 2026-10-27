# Mon Coran dans StayClean Agenda

Cinquième carte de l'accueil : **MON CORAN**. On ouvre, on sait quoi apprendre, on écoute, on répète, on récite sans regarder, et on voit ses progrès. Tout est en français ; le texte du Coran reste en arabe, avec la phonétique et la traduction du sens en option.

Section **privée** : rien n'est mélangé aux données professionnelles (`agenda_state`, compta, clients).

## L'appli (`coran.html`)

| Onglet | Ce qu'on y fait |
|---|---|
| **Apprendre** (par défaut) | « Un peu chaque jour » : la sourate et le passage du moment, **Commencer ma séance** ou **Reprendre ma séance**, « Environ 10 min », les révisions prévues. Au premier lancement : 5, 10 ou 15 minutes (10 présélectionné, modifiable, on peut passer). |
| **Lire** | Les 114 sourates : recherche par nom français, nom translittéré, nom arabe, numéro, verset (`2:255`), page (`page 42`) ou juz (`juz 30`). Reprise automatique de la dernière lecture, favoris avec étiquette libre, sourates / juz / pages. |
| **Arabe** | « Lire et écrire l’arabe » en **10 chapitres**, quatre rubriques dans l’ordre : **Étudier** (où j’en suis, puis les chapitres et leurs étapes numérotées), **M’entraîner** (10 exercices par chapitre), **Examens blancs** (les 11 examens visibles d’un coup, notés par l’appli, clavier arabe, partie orale) et **Fiches PDF** (une fiche de révision par chapitre et ses fiches d’exercices). |
| **Mes progrès** | Sourates travaillées, récitées sans aide, **connues à 100 % (validées par toi)**, révisions prévues, jours de pratique. Une ligne par sourate : état écrit + « x étapes sur 6 », ou barre pleine « Auto-évaluation du … » pour une sourate validée seul. |

Réglages (icône en haut à droite) : ambiance (**Vert doux**, **Papier**, **Nuit**), durée, nombre de répétitions, silence pour répéter, parcours, récitateur, rappel, texte hors ligne, audio téléchargé, enregistrements, sauvegarde, sources.

### Lecteur

- 5 affichages : Arabe · Français · Arabe + français · Arabe + phonétique · Arabe + phonétique + français. L'affichage choisi est gardé (en séance, « Arabe + phonétique » par défaut avec **Voir le sens**).
- **Verset par verset** ou **Pages du Coran** : 604 pages du Mushaf de Médine. Le découpage page ↔ versets est exact (métadonnées Tanzil) ; les lignes sont recomposées pour l'écran, c'est écrit sous la page.
- Changer d'ambiance, d'affichage ou de taille garde le verset à l'écran (l'appli retient le verset sous la barre du haut, pas une position en pixels).
- Texte arabe de droite à gauche, numéros de verset dans l'étoile à huit branches, jamais seuls en début de ligne. Le français est marqué « Traduction du sens — Rachid Maach (QuranEnc, version 1.0.3) ». Les notes du traducteur sont derrière **Comprendre**.
- Lecteur audio discret : lecture continue, répéter un verset (3, 5, 10 fois, en boucle), répéter un groupe de versets, silence entre les répétitions, précédent / suivant, vitesse 1× / 0,75× / 1,25×, arrêt immédiat. Jamais de lecture automatique, jamais deux sons à la fois. Plein écran.
- **Suivi du texte** pendant la récitation : fond menthe discret sur le verset récité, fond arrondi plus marqué sur le mot récité quand des repères mot à mot existent (jamais de lettres qui grossissent ou sautent). Tout est calculé à chaque image depuis la **position réelle de l'audio** (pause, déplacement, vitesse compris). Le texte défile doucement seulement quand le passage approche du bord ; si tu fais défiler toi-même, le suivi se met en pause et **Revenir à la récitation** apparaît. Mouvement réduit respecté.
- **Étudier seul, à ta façon** : en bas de chaque sourate, la carte « Étudier à ta façon » et le bouton **Je la connais à 100 %**. C'est noté tout de suite dans Mes progrès comme une auto-évaluation (distincte des récitations faites dans l'appli), annulable ; l'appli propose d'ajouter des révisions espacées sans les imposer. Aucune séance obligatoire.

### Récitateurs

- **Mohamed Al-Luhaidan** : voix principale (un fichier par sourate, MP3Quran). **Yasser Al-Dossari** : voix secondaire. Le choix est global, gardé et synchronisé ; un choix fait avant cette version n'est pas repris (Al-Luhaidan par défaut).
- Al-Husary, Al-Minshawi, Alafasy (EveryAyah, un fichier par verset) restent disponibles.
- **Jamais de remplacement silencieux** : si un verset ne peut pas être isolé avec la voix choisie (sourate sans repères vérifiés, ou limite de verset non confirmée), il est lu par Al-Husary, c'est annoncé, et le nom affiché est toujours celui de la voix entendue. La sourate entière depuis le début reste possible avec la voix choisie.
- Les exercices de lettres et de syllabes (« Lire et écrire l'arabe ») utilisent la récitation pédagogique d'Al-Husary, jamais attribuée à Al-Luhaidan.

### Repères de la voix principale (Al-Luhaidan)

Aucun fournisseur ne publie de repères pour cet enregistrement. Ils sont calculés pour **chaque fichier exact** (taille en octets vérifiée avant usage) :

1. `coran/sources/timing/align_dtw.js`, exécuté dans un navigateur (le décodeur MP3 du navigateur est celui qui sert à la lecture) : chaque fichier est aligné, audio sur audio (MFCC + énergie, DTW multi-échelle), sur trois récitations découpées verset par verset (EveryAyah : Saoud Al-Shuraim, Abdurrahman As-Sudais, Maher Al-Muaiqly) ; les pauses réelles du fichier sont détectées sur son énergie.
2. Une limite de verset est placée dans une pause réelle et n'est **confirmée** que si les trois références y tombent, ou deux avec la troisième à moins de 3 s (début du verset 1 : deux références d'accord à 0,25 s près suffisent). Sinon elle est **incertaine** : les deux versets sont surlignés ensemble (« versets 3 et 4 »), jamais séparés au hasard. Une sourate n'est utilisée que si le début du verset 1 est confirmé, si au moins la moitié des limites le sont, et si les contrôles passent (versets dans l'ordre, sans chevauchement, basmala de 1,2 à 8 s juste avant le verset 1).
3. Résultats bruts archivés (`dtw-*.json.gz`) ; `node export_timing.mjs dtw-*.json.gz [--tune]` refait le choix, la validation et écrit `coran/data/timing/luhaidan.json`.

**Validation** sur Yasser Al-Dossari, dont MP3Quran publie les repères (utilisés uniquement pour mesurer) : 70 sourates, 1945 limites ; 1868 confirmées (96,0 %), dont 97 % à moins de 0,3 s, 98,2 % à moins de 0,5 s et 99,2 % à moins de 1 s de ses repères publiés (15 écarts de plus d'une seconde, dont plusieurs où les trois références s'accordent contre le repère publié). Début du verset 1 : 98,6 % à moins de 0,5 s.

**Couverture** : 111 sourates sur 114 avec suivi par verset (non utilisables pour l'instant : 2, 9, 40) ; 4934 versets sur 5736 repérables seuls, les autres surlignés par groupes (499 limites non confirmées sur 5625). **Mot à mot : 0 %** pour Al-Luhaidan (aucun repère publié, rien d'inventé). Mot à mot disponible avec Al-Husary, Al-Minshawi et Alafasy (repères quran-align, CC BY 4.0).

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

## Lire et écrire l’arabe (onglet « Arabe », `coran/arabe.js`)

- **Quatre rubriques, dans l’ordre** : **Étudier** → **M’entraîner** → **Examens blancs** → **Fiches PDF**.
- **10 chapitres en 3 parties** (une couleur par partie : bleu, safran, vert) : Partie 1 « Les lettres » (1 Les bases · 2 ا ب ت ث ن ي · 3 ج ح خ · د ذ ر ز و · 4 س ش ص ض · ط ظ ع غ · 5 ف ق ك ل م ه), Partie 2 « Lire des mots » (6 Les voyelles courtes · 7 Allonger, arrêter, doubler · 8 Les mots), Partie 3 « Lire le Coran » (9 Lire le mushaf · 10 Lire couramment). 31 étapes numérotées en tout ; rien n’est verrouillé.
- **Étudier** : « Où j’en suis » (chapitre, étape, **Commencer / Continuer**), puis les chapitres. Page d’un chapitre : étapes 1, 2, 3…, **S’entraîner**, **Examen du chapitre**, « À la fin du chapitre, tu sais ». Une étape : **Ce que tu vas apprendre**, **Comprendre**, exemples (mots du Coran avec l’audio pédagogique d’Al-Husary, jamais attribué à une autre voix), puis **Vérifie que tu as compris** : 3 questions corrigées par l’appli ; 2 sur 3 → étape faite et passage direct à l’étape suivante.
- **M’entraîner** : 10 exercices par chapitre (ce qui est raté revient plus souvent), **Tout réviser**, **Mes erreurs à reprendre**, journal des erreurs. Chaque exercice est étiqueté « Corrigé par l’appli » ou « Auto-évaluation » (écriture à la main, lecture à voix haute). Exercices : lettres (nom, son, formes produites par la police), première lettre, points, syllabes, lecture de mots, écoute, signes, article lunaire / solaire, formes particulières, signes du mushaf et de pause (exemples réels du texte), composer un mot entendu, écrire à l’écran (modèle statique : l’ordre des traits n’est pas montré), lire à voix haute, passages, **cycle de fluidité** (petits groupes → réécoute → lecture d’une traite chronométrée → bilan).
- **Examens blancs** : les **11 examens visibles d’un coup** (un par chapitre + l’examen final sur tout le programme). **20 questions notées par l’appli** (final : 30, ramenées sur 20), une question = 1 point, aucune auto-évaluation, pas de correction pendant l’examen, correction question par question à la fin. **Réussi à 16/20** ; sinon **Refaire un examen similaire** : même grille, autres questions (tirage propre à chaque essai). Chaque carte montre la meilleure note, le nombre d’essais et la courbe des notes.
- **Clavier arabe dans l’examen** (28 lettres dans l’ordre de l’alphabet, hamza et formes, voyelles et signes, effacer, espace), ou le **clavier du téléphone** au choix. Correction : lettres seules (juste ou faux), ou voyelles exigées (juste 1 ; lettres justes mais voyelles fausses ½) ; l’ordre des signes sur une lettre ne compte pas, ٱ = ا, tanwīn « an » avant ou après l’alif.
- **Partie orale** (chapitres 2 à 10 et final) : 5 lettres ou mots à prononcer. L’enregistrement (WAV 16 kHz) est envoyé à **Gemini** (modèle de l’agenda) avec la clé enregistrée dans les réglages de l’agenda, **seulement après ton accord**, demandé une fois et **retirable** dans Examens blancs. L’appli vérifie elle-même que les lettres entendues sont les bonnes ; l’IA donne son avis sur les voyelles (pas de note de tajwid). Note orale **à part, à titre indicatif** ; un mot passé ne compte pas. Sans clé : pas d’oral (c’est écrit) ; clé refusée : l’oral s’arrête et l’examen est noté sur l’écrit. Rien de la voix n’est gardé.
- **Fiches PDF** (`coran/fiches/`) : pour chaque chapitre, une **fiche de révision** (ce qu’il faut savoir, tableaux des lettres / signes, tableau des syllabes au chapitre 6, mots du Coran pour s’exercer, ce que vérifie l’examen) et ses fiches d’exercices (27 en tout), en **couleur** et en version **économique** ; tout le chapitre en un seul PDF. Boutons **Voir**, **Télécharger le PDF**, **Télécharger en image**, **Imprimer** (sur iPhone, Android et Safari, la fiche s’ouvre et s’imprime depuis le lecteur PDF). Construites par `coran/sources/arabe/build_fiches.py` (chaque fiche contrôlée : une seule page, rien de coupé, police arabe intégrée ; inspectées visuellement). Aucun QR code ni lien. Imprimer n’est jamais nécessaire : les examens se passent dans l’appli.
- **Sur l’appareil seulement** : écriture à l’écran, photos de feuilles, enregistrements de lecture à l’entraînement (micro demandé par le navigateur) ; rien n’est envoyé, tout est supprimable (Fiches PDF → Mes écrits, photos et enregistrements).
- **Contenu** : `coran/data/arabe/banque.json` (construit par `coran/sources/arabe/build_bank.py` depuis `lettres.py`, `programme.py` — parties, chapitres, grilles d’examen — et le texte Tanzil, avec tests de l’écriture usuelle et de la transcription). Aucune forme arabe ni aucun verset n’est inventé ; dans les chapitres 1 à 5, aucun exercice ne montre une lettre pas encore étudiée (test `arabe_contenu.py`). Aucun contenu n’a été relu par un enseignant et l’appli ne le prétend pas.
- **Données** (compte) : natures `ar_state` (étapes faites, notions vues), `ar_att` (réponses), `ar_exam` (une ligne par examen : note, parties, oral, questions manquées) dans `qr_items`.

## Sources et droits

Fichiers d'origine copiés tels quels dans `coran/sources/raw/` ; empreintes SHA-256, adresses et licences dans `coran/sources/SOURCES.json`. `coran/sources/build.py` vérifie les empreintes, contrôle tout et produit `coran/data/`.

| Contenu | Source | Conditions |
|---|---|---|
| Texte arabe | **Tanzil Quran Text, Uthmani 1.1**, lecture Hafs, numérotation koufique (6 236 versets), avec marques de pause et de prosternation | CC BY 3.0, copie verbatim uniquement, lien vers tanzil.net, bloc de copyright conservé (affiché dans Sources) |
| Sourates, juz, pages, prosternations | **Tanzil Quran Metadata 1.0** (Mushaf de Médine, 604 pages) | CC BY 3.0 |
| Traduction du sens | **Rachid Maach, QuranEnc** (`french_rashid`, version 1.0.3), notes du traducteur incluses | Ne rien modifier, citer QuranEnc, le traducteur et la version ; vérifier de temps en temps s'il existe une version plus récente |
| Phonétique | **Tanzil `en.transliteration`** (2010) : translittération aux conventions anglaises (`ee`, `oo`, `AA` pour ʿayn…) | Usage non commercial (usage privé ici) |
| Noms français des sourates | Wikipédia FR, *Modèle:Palette Sourate/liste* (révision 225651281) | CC BY-SA 4.0 |
| Audio | **MP3Quran.net**, un fichier par sourate : Mohamed Al-Luhaidan (voix principale), Yasser Al-Dossari. **EveryAyah.com**, verset par verset : Mahmoud Khalil Al-Husary (murattal et pédagogique), Mohamed Siddiq Al-Minshawi, Mishary Rashid Alafasy — Hafs | Pas de licence de redistribution publiée : rien n'est copié dans ce dépôt ; lecture en ligne, et téléchargement **sourate par sourate, sur demande**, pour un usage personnel |
| Repères | Mot à mot : **quran-align** (Collin Fair, CC BY 4.0) pour les fichiers EveryAyah. Par verset : publiés par MP3Quran (Al-Dossari) ; calculés et contrôlés ici (Al-Luhaidan, voir plus haut) | Attribution CC BY 4.0 dans Sources et droits |
| « Lire et écrire l’arabe » | Formes et liaisons : **Unicode** (chapitre 9.2 « Arabic », `ArabicShaping.txt`) ; alphabet : **Northwestern University** (MENA Languages) ; sons : **Handbook of the IPA** (1999, « Arabic ») ; signes et pauses : conventions du **Mushaf de Médine** ; mots et passages : texte **Tanzil** ; audio des mots : **Al-Husary « Al-Mu’allim »** (EveryAyah) découpé avec **quran-align** | Détail dans `coran/data/arabe/banque.json` (`sources`) et dans Sources et droits de l’appli |
| Police arabe | **Amiri Quran** (sous-ensemble arabe, 45 Ko) | SIL OFL 1.1 (`coran/fonts/OFL-Amiri.txt`) |
| Police latine | **Rubik** | SIL OFL 1.1 (`coran/fonts/OFL-Rubik.txt`) |
| Illustration | Livre vert fermé sur un pupitre en bois, générée une seule fois pour l'appli, sans texte | — |

Contrôles faits à la construction : 114 sourates, 6 236 versets, numérotation continue, nombre de versets par sourate, 604 pages et 30 juz cohérents, basmala en tête des sourates 2 à 114 (sauf 9) retirée du verset 1 et affichée à part, équilibre des balises de la phonétique, renvois aux notes de la traduction. Recoupement avec les données de Quran.com : 0 écart (pages, nombre de versets, lieu de révélation).

**Rien n'est généré** : aucun verset, aucune traduction, aucune phonétique, aucune récitation ne vient d'une IA ou d'une conversion automatique. Une ressource absente est signalée, jamais remplacée. La traduction automatique du navigateur est désactivée sur ces textes.

## Installation (une seule fois)

1. **Base de données** : Supabase → SQL Editor → colle [`supabase/mon-coran.sql`](supabase/mon-coran.sql) → **Run**. Il crée seulement la table `qr_items` (RLS : chaque compte ne voit que ses lignes). On peut le relancer sans risque. Sans cette étape, Mon Coran fonctionne quand même, mais **sur ce téléphone seulement** (c'est écrit dans Mes progrès et les réglages) ; l'export / import JSON reste possible.
2. **Mise en ligne** : publier sur `main` → GitHub Pages. Le service worker passe en v41.
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
- **Versets longs** : le texte est découpé seulement aux marques de pause du texte source (jamais au milieu d'un mot) ; l'audio lit le verset entier.
- **Suivi mot à mot** : seulement avec Al-Husary, Al-Minshawi et Alafasy (quran-align). Avec Al-Luhaidan et Al-Dossari, suivi par verset (aucun repère mot à mot publié pour ces enregistrements).
- **Limites incertaines (Al-Luhaidan)** : versets surlignés ensemble ; un verset concerné, joué seul, est lu par Al-Husary (annoncé).
- **Lire et écrire l’arabe** : à l’entraînement, l’écriture à l’écran et la lecture à voix haute sont des **auto-évaluations** ; la partie orale des examens dépend de Gemini (clé de l’agenda, accord demandé) : l’IA peut se tromper, sa note reste à part et indicative ; le nom des lettres n’a un audio vérifié que pour les trois lettres récitées seules en tête de sourate (ق, ن, ص), les autres ont leur nom et leur son écrits ; contenus non relus par un enseignant.
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
python3 luhaidan.py && python3 autodidacte.py   # voix principale, suivi, versets regroupés ; « Je la connais à 100 % »
python3 arabe.py && python3 arabe_niveaux.py && python3 arabe_contenu.py && python3 arabe_ecrans.py   # « Lire et écrire l'arabe » (chapitres, examens, clavier, oral simulé, fiches, contenus, écrans)
npm install @supabase/supabase-js@2.117.1 && python3 sync.py   # sauvegarde sur le compte, avec un faux serveur
```

Audio remplacé par un bip local, faux serveur Supabase en mémoire, données fictives, dates simulées : aucun service réel n'est appelé.
