#!/usr/bin/env python3
"""Données de référence des lettres arabes pour « Lire et écrire l'arabe ».

Chaque information est vérifiable dans des références identifiées (voir SOURCES) :
- formes et liaisons : The Unicode Standard, chap. 9.2 « Arabic » et ArabicShaping.txt (Joining_Type) ;
  les formes affichées sont produites par la police à partir de la lettre (jamais dessinées à la main) ;
- noms, ordre, points, familles : présentation standard de l'alphabet (Northwestern University, MENA Languages ;
  The Unicode Standard pour les noms de caractères) ;
- sons : transcription API d'après « Handbook of the International Phonetic Association » (illustration
  « Arabic », Thelwall & Sa'adeddin, 1990), formulée en équivalents approximatifs pour un francophone.
Aucune de ces fiches n'a été relue par un enseignant : l'appli ne le prétend pas.
"""

SOURCES = [
    {"id": "unicode", "titre": "The Unicode Standard, chapitre 9.2 « Arabic » et ArabicShaping.txt (types de liaison)",
     "url": "https://www.unicode.org/versions/latest/core-spec/chapter-9/#G7480",
     "sert": "formes isolée, initiale, médiane et finale ; lettres qui ne se lient pas à la suivante ; ligature lam-alif obligatoire"},
    {"id": "northwestern", "titre": "Northwestern University, MENA Languages — Arabic Alphabet",
     "url": "https://mena-languages.northwestern.edu/language-learning/languages-with-different-scripts/arabic-alphabet.html",
     "sert": "28 lettres consonnes, écriture de droite à gauche et liée, quatre formes selon la position, voyelles brèves notées par des signes"},
    {"id": "ipa", "titre": "Handbook of the International Phonetic Association (1999), illustration « Arabic » (Thelwall & Sa'adeddin)",
     "url": "https://doi.org/10.1017/CBO9780511807954",
     "sert": "valeur phonétique de chaque lettre (API)"},
    {"id": "tanzil", "titre": "Tanzil Project — texte coranique Uthmani (Hafs), version 1.1",
     "url": "https://tanzil.net/docs/quran_text_types",
     "sert": "mots et passages du Coran, signes du mushaf (alif wasla, petits signes, marques de pause)"},
    {"id": "madina", "titre": "Mushaf de Médine (Complexe du roi Fahd) — conventions de notation et signes de pause",
     "url": "https://qurancomplex.gov.sa/",
     "sert": "sens des signes de pause et des petits signes du mushaf retenu"},
    {"id": "everyayah", "titre": "EveryAyah — Mahmoud Khalil Al-Husary, récitation pédagogique « Al-Mu'allim » (un fichier par verset)",
     "url": "https://everyayah.com/data/Husary_Muallim_128kbps/",
     "sert": "audio des mots et des versets d'exercice (récitation lente destinée aux apprenants)"},
    {"id": "qalign", "titre": "quran-align (Collin Fair) — repères mot à mot, CC BY 4.0",
     "url": "https://github.com/cpfair/quran-align",
     "sert": "début et fin de chaque mot dans les fichiers Al-Husary (pour écouter un seul mot)"},
]

# Ordre hija'i (ordre usuel des manuels). joins = se lie à la lettre suivante (vers la gauche).
# dots = (nombre, position) ; pos : 'dessus', 'dessous', None.
LETTERS = [
    # id, lettre, nom fr, nom ar, translit, API, son (fr), points, se lie à la suivante, famille
    ("alif", "ا", "alif", "أَلِف", "ā", "aː / ʔ", "Ne se prononce pas seule : porte une hamza (attaque de voyelle) ou allonge le son « a » (â).", (0, None), False, "alif"),
    ("ba", "ب", "bā’", "بَاء", "b", "b", "« b » comme dans « bateau ».", (1, "dessous"), True, "ba"),
    ("ta", "ت", "tā’", "تَاء", "t", "t", "« t » comme dans « table ».", (2, "dessus"), True, "ba"),
    ("tha", "ث", "thā’", "ثَاء", "th", "θ", "Langue entre les dents, sans la voix : le « th » de l’anglais « think ».", (3, "dessus"), True, "ba"),
    ("jim", "ج", "jīm", "جِيم", "j", "d͡ʒ", "« dj » comme dans « Djibouti ».", (1, "dessous"), True, "jim"),
    ("ha_", "ح", "ḥā’", "حَاء", "ḥ", "ħ", "« h » fort et soufflé, serré au milieu de la gorge, sans raclement.", (0, None), True, "jim"),
    ("kha", "خ", "khā’", "خَاء", "kh", "x", "Son raclé au fond de la bouche, comme la « jota » espagnole ou le « ch » allemand de « Bach ».", (1, "dessus"), True, "jim"),
    ("dal", "د", "dāl", "دَال", "d", "d", "« d » comme dans « dos ».", (0, None), False, "dal"),
    ("dhal", "ذ", "dhāl", "ذَال", "dh", "ð", "Langue entre les dents, avec la voix : le « th » de l’anglais « this ».", (1, "dessus"), False, "dal"),
    ("ra", "ر", "rā’", "رَاء", "r", "r", "« r » roulé du bout de la langue.", (0, None), False, "ra"),
    ("zay", "ز", "zāy", "زَاي", "z", "z", "« z » comme dans « zéro ».", (1, "dessus"), False, "ra"),
    ("sin", "س", "sīn", "سِين", "s", "s", "« s » comme dans « sel ».", (0, None), True, "sin"),
    ("shin", "ش", "shīn", "شِين", "sh", "ʃ", "« ch » comme dans « chat ».", (3, "dessus"), True, "sin"),
    ("sad", "ص", "ṣād", "صَاد", "ṣ", "sˤ", "« s » emphatique : langue relevée vers l’arrière, son plus grave que س.", (0, None), True, "sad"),
    ("dad", "ض", "ḍād", "ضَاد", "ḍ", "dˤ", "« d » emphatique : son grave, langue relevée vers l’arrière.", (1, "dessus"), True, "sad"),
    ("ta_", "ط", "ṭā’", "طَاء", "ṭ", "tˤ", "« t » emphatique : son grave, plus sourd que ت.", (0, None), True, "ta_"),
    ("za_", "ظ", "ẓā’", "ظَاء", "ẓ", "ðˤ", "Le son de ذ, mais emphatique : grave, langue relevée vers l’arrière.", (1, "dessus"), True, "ta_"),
    ("ayn", "ع", "‘ayn", "عَيْن", "‘", "ʕ", "Son de gorge propre à l’arabe : on serre le milieu de la gorge en faisant vibrer la voix.", (0, None), True, "ayn"),
    ("ghayn", "غ", "ghayn", "غَيْن", "gh", "ɣ", "« r » grasseyé, proche du « r » parisien.", (1, "dessus"), True, "ayn"),
    ("fa", "ف", "fā’", "فَاء", "f", "f", "« f » comme dans « fil ».", (1, "dessus"), True, "fa"),
    ("qaf", "ق", "qāf", "قَاف", "q", "q", "« k » prononcé tout au fond de la bouche, plus profond que ك.", (2, "dessus"), True, "fa"),
    ("kaf", "ك", "kāf", "كَاف", "k", "k", "« k » comme dans « kilo ».", (0, None), True, "kaf"),
    ("lam", "ل", "lām", "لَام", "l", "l", "« l » comme dans « lit ».", (0, None), True, "lam"),
    ("mim", "م", "mīm", "مِيم", "m", "m", "« m » comme dans « mer ».", (0, None), True, "mim"),
    ("nun", "ن", "nūn", "نُون", "n", "n", "« n » comme dans « nid ».", (1, "dessus"), True, "nun"),
    ("ha", "ه", "hā’", "هَاء", "h", "h", "« h » expiré, comme dans l’anglais « house ».", (0, None), True, "ha"),
    ("waw", "و", "wāw", "وَاو", "w / ū", "w / uː", "« w » comme dans « oui » ; allonge aussi le son « ou » (û).", (0, None), False, "waw"),
    ("ya", "ي", "yā’", "يَاء", "y / ī", "j / iː", "« y » comme dans « yoga » ; allonge aussi le son « i » (î).", (2, "dessous"), True, "ya"),
]

# Familles de formes (même squelette, les points font la différence)
FAMILIES = {
    "ba": {"nom": "même squelette : ب ت ث", "regle": "Le squelette est le même ; seul le nombre et la place des points changent (1 dessous, 2 dessus, 3 dessus). Au début et au milieu d’un mot, ن et ي prennent aussi cette forme de petite dent."},
    "jim": {"nom": "même squelette : ج ح خ", "regle": "Même forme ; ج a un point dessous (dans la courbe), ح aucun point, خ un point dessus."},
    "dal": {"nom": "د ذ", "regle": "Petite lettre qui ne se lie jamais à la suivante ; ذ a un point dessus."},
    "ra": {"nom": "ر ز", "regle": "Descend sous la ligne et ne se lie jamais à la suivante ; ز a un point dessus."},
    "sin": {"nom": "س ش", "regle": "Trois petites dents ; ش porte trois points dessus."},
    "sad": {"nom": "ص ض", "regle": "Boucle allongée suivie d’une petite dent ; ض porte un point dessus."},
    "ta_": {"nom": "ط ظ", "regle": "Boucle et trait vertical ; ظ porte un point dessus."},
    "ayn": {"nom": "ع غ", "regle": "Forme ouverte qui change beaucoup selon la position ; غ porte un point dessus."},
    "fa": {"nom": "ف ق", "regle": "Petite boucle ; ف a un point dessus, ق deux points dessus (et une queue plus ronde en fin de mot)."},
}

# Sons proches à bien distinguer (paires travaillées en discrimination)
CLOSE_SOUNDS = [
    ("sin", "sad", "س léger / ص emphatique (grave)"),
    ("ta", "ta_", "ت léger / ط emphatique (grave)"),
    ("dal", "dad", "د léger / ض emphatique (grave)"),
    ("dhal", "za_", "ذ léger / ظ emphatique (grave)"),
    ("dhal", "zay", "ذ (langue entre les dents) / ز (« z »)"),
    ("tha", "sin", "ث (langue entre les dents) / س (« s »)"),
    ("ha", "ha_", "ه (h expiré) / ح (h fort de la gorge)"),
    ("ha_", "kha", "ح (h fort, sans raclement) / خ (raclé)"),
    ("alif", "ayn", "attaque de voyelle (hamza) / ع (son de gorge)"),
    ("kaf", "qaf", "ك (k ordinaire) / ق (k du fond de la bouche)"),
    ("ghayn", "ra", "غ (r grasseyé) / ر (r roulé)"),
]

# Lettres qui ne se lient pas à la suivante (Unicode : Joining_Type = R)
NON_JOINING = ["ا", "د", "ذ", "ر", "ز", "و"]

# Formes particulières (niveau 4)
SPECIAL = [
    {"id": "hamza", "ch": "ء", "nom": "hamza", "role": "Arrêt de voix bref suivi d’une voyelle (coup de glotte). Seule, ou portée par ا (أ إ), و (ؤ) ou ي sans points (ئ)."},
    {"id": "hamza_alif_haut", "ch": "أ", "nom": "hamza sur alif", "role": "Hamza portée par un alif, avec « a » ou « u »."},
    {"id": "hamza_alif_bas", "ch": "إ", "nom": "hamza sous alif", "role": "Hamza portée par un alif, avec « i »."},
    {"id": "hamza_waw", "ch": "ؤ", "nom": "hamza sur wāw", "role": "Hamza portée par un wāw (souvent après « u »)."},
    {"id": "hamza_ya", "ch": "ئ", "nom": "hamza sur yā’ (sans points)", "role": "Hamza portée par un yā’ sans points (souvent après « i »)."},
    {"id": "ta_marbuta", "ch": "ة", "nom": "tā’ marbūṭa", "role": "Seulement en fin de mot : se lit « a » à l’arrêt, « t » quand on enchaîne avec le mot suivant."},
    {"id": "alif_maqsura", "ch": "ى", "nom": "alif maqṣūra", "role": "En fin de mot, forme de ي sans points : se lit « â » (voyelle longue)."},
    {"id": "lam_alif", "ch": "لا", "nom": "lām-alif", "role": "ل suivi de ا s’écrit toujours avec cette ligature (لا) : c’est une obligation de l’écriture, pas une lettre de plus."},
]

# Signes (niveaux 2 et 3)
SIGNS = [
    {"id": "fatha", "ch": "َ", "nom": "fatḥa", "son": "a", "role": "Petit trait au-dessus : voyelle brève « a »."},
    {"id": "kasra", "ch": "ِ", "nom": "kasra", "son": "i", "role": "Petit trait au-dessous : voyelle brève « i »."},
    {"id": "damma", "ch": "ُ", "nom": "ḍamma", "son": "ou", "role": "Petit wāw au-dessus : voyelle brève « ou » (u)."},
    {"id": "sukun", "ch": "ْ", "nom": "sukūn", "son": "—", "role": "Petit rond au-dessus : la lettre n’a pas de voyelle, on passe directement à la suivante."},
    {"id": "shadda", "ch": "ّ", "nom": "shadda", "son": "lettre doublée", "role": "Petit « w » au-dessus : la lettre est doublée (on appuie dessus), avec la voyelle placée sur la shadda ou sous elle."},
    {"id": "fathatan", "ch": "ً", "nom": "tanwīn fatḥ", "son": "an", "role": "Deux traits au-dessus, en fin de mot : « an » (souvent écrit avec un ا ajouté qui ne se prononce pas)."},
    {"id": "kasratan", "ch": "ٍ", "nom": "tanwīn kasr", "son": "in", "role": "Deux traits au-dessous, en fin de mot : « in »."},
    {"id": "dammatan", "ch": "ٌ", "nom": "tanwīn ḍamm", "son": "oun", "role": "Double ḍamma en fin de mot : « oun » (un)."},
    {"id": "madd_a", "ch": "َا", "nom": "voyelle longue â", "son": "â", "role": "fatḥa suivie de ا : « a » allongé."},
    {"id": "madd_i", "ch": "ِي", "nom": "voyelle longue î", "son": "î", "role": "kasra suivie de ي : « i » allongé."},
    {"id": "madd_u", "ch": "ُو", "nom": "voyelle longue û", "son": "oû", "role": "ḍamma suivie de و : « ou » allongé."},
]

# Particularités du mushaf retenu (texte Uthmani de Tanzil, Mushaf de Médine) — niveau 5
MUSHAF = [
    {"id": "wasla", "ch": "ٱ", "nom": "alif waṣla", "role": "Alif de liaison : il ne se prononce pas quand on enchaîne avec le mot précédent ; au début d’une lecture, on le lit avec une voyelle (« a » pour l’article)."},
    {"id": "dagger", "ch": "ٰ", "nom": "petit alif (alif suscrit)", "role": "Petit alif vertical au-dessus d’une lettre : se lit comme un « â » long, même s’il n’y a pas d’alif écrit en entier."},
    {"id": "small_waw", "ch": "ۥ", "nom": "petit wāw", "role": "Petit wāw après le pronom ه : le son « ou » est allongé (hû)."},
    {"id": "small_ya", "ch": "ۦ", "nom": "petit yā’", "role": "Petit yā’ après le pronom ه : le son « i » est allongé (hî)."},
    {"id": "zero", "ch": "۟", "nom": "petit cercle", "role": "Petit cercle au-dessus d’une lettre : cette lettre est écrite mais ne se prononce pas (ex. l’alif après « û » dans كَفَرُوا۟)."},
    {"id": "rect_zero", "ch": "۠", "nom": "petit rectangle", "role": "Lettre prononcée seulement à l’arrêt, pas en liaison (ex. l’alif final de أَنَا۠)."},
    {"id": "madd", "ch": "ٓ", "nom": "signe de prolongation (madda)", "role": "Vague au-dessus d’une voyelle longue : on prolonge davantage le son."},
    {"id": "iqlab", "ch": "ۢ", "nom": "petit mīm", "role": "Petit mīm à la place du sukūn ou du tanwīn : le son « n » se prononce « m » (devant ب)."},
    {"id": "iqlab_low", "ch": "ۭ", "nom": "petit mīm dessous", "role": "Même rôle que le petit mīm, sous un tanwīn kasr."},
]

STOPS = [
    {"id": "lazim", "ch": "ۘ", "nom": "arrêt obligatoire (mīm)", "role": "On s’arrête ici : enchaîner changerait le sens."},
    {"id": "awla_waqf", "ch": "ۗ", "nom": "arrêt préférable (qalā)", "role": "On peut enchaîner, mais s’arrêter est préférable."},
    {"id": "jaiz", "ch": "ۚ", "nom": "arrêt permis (jīm)", "role": "S’arrêter ou enchaîner : les deux sont permis."},
    {"id": "awla_wasl", "ch": "ۖ", "nom": "enchaîner de préférence (ṣalā)", "role": "On peut s’arrêter, mais enchaîner est préférable."},
    {"id": "mamnu", "ch": "ۙ", "nom": "ne pas s’arrêter (lā)", "role": "Ne pas s’arrêter ici."},
    {"id": "taanuq", "ch": "ۛ", "nom": "arrêt à l’un des deux (trois points)", "role": "Deux groupes de trois points se répondent : on s’arrête à l’un des deux, pas aux deux."},
    {"id": "sakta", "ch": "ۜ", "nom": "sakta (petit sīn)", "role": "Courte pause sans reprendre son souffle (quatre endroits dans la lecture de Ḥafṣ)."},
]
