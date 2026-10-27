#!/usr/bin/env python3
"""Programme « Lire et écrire l'arabe » : 10 chapitres en 3 parties, étapes, examens.

Ce fichier ne contient que l'organisation pédagogique et les consignes (en français). Les lettres, signes
et mots viennent de lettres.py et du texte coranique (build_bank.py). Choix de conception (pas une norme) :
un examen par chapitre, 20 questions notées par l'appli, réussi à partir de 16/20 ; un examen final sur tout.
"""

# Compétences suivies séparément
SKILLS = [
    {"id": "rec", "nom": "Reconnaissance des lettres", "court": "Lettres"},
    {"id": "lie", "nom": "Lecture des formes liées", "court": "Formes liées"},
    {"id": "voy", "nom": "Lecture des voyelles et des signes", "court": "Voyelles et signes"},
    {"id": "ecr", "nom": "Écriture", "court": "Écriture"},
    {"id": "dec", "nom": "Déchiffrage de mots nouveaux", "court": "Mots nouveaux"},
    {"id": "pas", "nom": "Lecture de passages", "court": "Passages"},
    {"id": "flu", "nom": "Fluidité", "court": "Fluidité"},
]

# Erreurs utiles enregistrées
ERRORS = {
    "confusion": "confusion entre deux lettres",
    "point": "point oublié ou mal placé",
    "liaison": "liaison incorrecte",
    "voyelle": "confusion de voyelles",
    "signe": "signe mal lu (sukūn, shadda, tanwīn, allongement)",
    "hesitation": "hésitation",
    "indice": "besoin d'un indice",
    "forme": "forme de lettre incorrecte à l'écrit",
    "ordre": "ordre des lettres",
}

LEVELS = [
    {
        "n": 0, "nom": "Premiers repères", "but": "Comprendre le sens de lecture et distinguer lettres, points et signes.",
        "preuve": "Réussir de petits exercices guidés.",
        "units": [
            {"id": "u0a", "titre": "Le sens de lecture", "notion": "sens",
             "resume": "L’arabe se lit et s’écrit de droite à gauche. Une ligne commence à droite.",
             "comprendre": "On commence à lire en haut à droite de la page, puis on avance vers la gauche. Les chiffres, eux, s’écrivent de gauche à droite, comme en français. Dans un mot, la première lettre est donc la plus à droite."},
            {"id": "u0b", "titre": "Lettre, points et signes", "notion": "parties",
             "resume": "Une lettre a une forme de base ; des points la distinguent d’une autre ; de petits signes au-dessus ou au-dessous notent les voyelles.",
             "comprendre": "Beaucoup de lettres partagent la même forme : seuls les points changent (ب ت ث). Les voyelles brèves ne sont pas des lettres : ce sont de petits signes (َ ِ ُ). Dans le Coran, tous les signes sont écrits, ce qui permet de lire chaque son."},
            {"id": "u0c", "titre": "Des lettres qui s’attachent", "notion": "liaisons",
             "resume": "Dans un mot, les lettres s’attachent entre elles ; six lettres ne s’attachent jamais à la suivante : ا د ذ ر ز و.",
             "comprendre": "L’écriture arabe est liée, même imprimée. Une lettre change un peu de forme selon sa place : seule, au début, au milieu ou à la fin d’un mot. Après ا د ذ ر ز و, il y a toujours une coupure : la lettre suivante reprend comme en début de mot."},
        ],
        "skills": ["rec"],
    },
    {
        "n": 1, "nom": "Les lettres", "but": "Reconnaître les 28 lettres, leurs sons et leurs formes selon leur place.",
        "preuve": "Identifier des lettres présentées dans un ordre variable et les écrire.",
        "units": [
            {"id": "u1a", "titre": "ا ب ت ث", "letters": ["alif", "ba", "ta", "tha"], "notion": "lettres",
             "resume": "Alif, puis la famille de ب : même forme, les points font la différence.",
             "comprendre": "ب : un point dessous ; ت : deux points dessus ; ث : trois points dessus. L’alif est un trait vertical qui ne s’attache pas à la lettre suivante."},
            {"id": "u1b", "titre": "ن ي", "letters": ["nun", "ya"], "notion": "lettres",
             "resume": "ن et ي ont la même petite dent que ب au début et au milieu d’un mot ; seule leur forme finale change.",
             "comprendre": "Au début et au milieu d’un mot, ne te fie qu’aux points : un dessus (ن), deux dessous (ي), un dessous (ب). En fin de mot, ن forme une coupe et ي une boucle."},
            {"id": "u1c", "titre": "ج ح خ", "letters": ["jim", "ha_", "kha"], "notion": "lettres",
             "resume": "Même forme : point dessous (ج), aucun point (ح), point dessus (خ).",
             "comprendre": "ح et خ sont deux sons de gorge absents du français : ح est un h soufflé, serré, sans raclement ; خ est raclé, comme la jota espagnole."},
            {"id": "u1d", "titre": "د ذ ر ز و", "letters": ["dal", "dhal", "ra", "zay", "waw"], "notion": "lettres",
             "resume": "Lettres qui ne s’attachent jamais à la suivante.",
             "comprendre": "د et ذ restent sur la ligne ; ر et ز descendent dessous. و aussi descend sous la ligne avec sa petite tête ronde. Après elles, le mot continue avec une forme de début."},
            {"id": "u1e", "titre": "س ش ص ض", "letters": ["sin", "shin", "sad", "dad"], "notion": "lettres",
             "resume": "Trois petites dents pour س ش ; une boucle allongée pour ص ض.",
             "comprendre": "ص et ض sont emphatiques : la langue se relève vers l’arrière et le son devient plus grave que س et د. Bien les distinguer change le sens des mots."},
            {"id": "u1f", "titre": "ط ظ ع غ", "letters": ["ta_", "za_", "ayn", "ghayn"], "notion": "lettres",
             "resume": "ط ظ : boucle et trait vertical. ع غ : forme ouverte qui change selon la place.",
             "comprendre": "ط et ظ sont emphatiques (sons graves). ع est un son de gorge avec la voix ; غ ressemble au r parisien."},
            {"id": "u1g", "titre": "ف ق ك ل", "letters": ["fa", "qaf", "kaf", "lam"], "notion": "lettres",
             "resume": "ف (un point) et ق (deux points) ont une petite boucle ; ك et ل se dressent vers le haut.",
             "comprendre": "ق se prononce tout au fond de la bouche ; ك comme le k français. Quand ل est suivi de ا, on écrit toujours la ligature لا."},
            {"id": "u1h", "titre": "م ه", "letters": ["mim", "ha"], "notion": "lettres",
             "resume": "م : petite boucle ronde. ه : forme très variable selon sa place.",
             "comprendre": "ه change beaucoup de forme : seule (ه), au début (هـ), au milieu (ـهـ), à la fin (ـه). Le son reste un h expiré, plus léger que ح."},
        ],
        "skills": ["rec", "lie", "ecr"],
    },
    {
        "n": 2, "nom": "Premières lectures", "but": "Lire avec fatḥa, kasra et ḍamma.",
        "preuve": "Déchiffrer de nouvelles syllabes et écrire sous dictée simple.",
        "units": [
            {"id": "u2a", "titre": "La fatḥa", "signs": ["fatha"], "notion": "voyelles",
             "resume": "Petit trait au-dessus de la lettre : son « a ».", "comprendre": "بَ se lit « ba », تَ « ta ». Le trait est oblique, au-dessus de la lettre."},
            {"id": "u2b", "titre": "La kasra", "signs": ["kasra"], "notion": "voyelles",
             "resume": "Petit trait au-dessous de la lettre : son « i ».", "comprendre": "بِ se lit « bi ». Même trait que la fatḥa, mais sous la lettre."},
            {"id": "u2c", "titre": "La ḍamma", "signs": ["damma"], "notion": "voyelles",
             "resume": "Petit wāw au-dessus de la lettre : son « ou ».", "comprendre": "بُ se lit « bou » (noté « bu »). Ne la confonds pas avec la fatḥa : c’est une petite boucle, pas un trait."},
            {"id": "u2d", "titre": "Syllabes et premiers mots", "signs": ["fatha", "kasra", "damma"], "notion": "mots_courts",
             "resume": "Des lettres attachées, chacune avec sa voyelle : on lit syllabe par syllabe.",
             "comprendre": "Lis lettre par lettre, de droite à gauche : خَلَقَ = kha-la-qa. Chaque lettre porte sa voyelle ; aucune n’est muette à ce niveau."},
        ],
        "skills": ["rec", "lie", "voy", "ecr", "dec"],
    },
    {
        "n": 3, "nom": "Les signes essentiels", "but": "Comprendre voyelles longues, sukūn, shadda et tanwīn.",
        "preuve": "Lire et écrire des combinaisons adaptées.",
        "units": [
            {"id": "u3a", "titre": "Voyelles longues", "signs": ["madd_a", "madd_i", "madd_u"], "notion": "longues",
             "resume": "ا après une fatḥa, ي après une kasra, و après une ḍamma : la voyelle s’allonge.",
             "comprendre": "بَا = « bâ », بِي = « bî », بُو = « boû ». La lettre d’allongement ne porte pas de voyelle : elle prolonge celle d’avant (environ deux temps)."},
            {"id": "u3b", "titre": "Le sukūn", "signs": ["sukun"], "notion": "sukun",
             "resume": "Petit rond : la lettre n’a pas de voyelle.", "comprendre": "قُلْ = « qul » : le ل porte un sukūn, on s’arrête sur la consonne. Deux consonnes se suivent alors sans voyelle entre elles."},
            {"id": "u3c", "titre": "La shadda", "signs": ["shadda"], "notion": "shadda",
             "resume": "La lettre est doublée : on appuie dessus.", "comprendre": "رَبِّ = « rabbi » : le ب est prononcé deux fois (b-b). La voyelle s’écrit avec la shadda : au-dessus pour a et ou, au-dessous pour i."},
            {"id": "u3d", "titre": "Le tanwīn", "signs": ["fathatan", "kasratan", "dammatan"], "notion": "tanwin",
             "resume": "Voyelle doublée en fin de mot : « an », « in », « oun ».", "comprendre": "نُورٌ = « nûroun ». Avec « an », on ajoute souvent un ا qui ne se prononce pas : كَثِيرًا = « kathîran »."},
        ],
        "skills": ["rec", "lie", "voy", "ecr", "dec"],
    },
    {
        "n": 4, "nom": "Les mots", "but": "Lire les liaisons et reconnaître les formes particulières.",
        "preuve": "Déchiffrer des mots nouveaux et les écrire.",
        "units": [
            {"id": "u4a", "titre": "L’article : lettres lunaires", "feat": "article_moon", "notion": "article",
             "resume": "ال devant une lettre lunaire : le ل se prononce (al-).", "comprendre": "الْحَمْدُ = « al-ḥamdou ». Le ل porte un sukūn. Les lettres lunaires : ا ب ج ح خ ع غ ف ق ك م ه و ي."},
            {"id": "u4b", "titre": "L’article : lettres solaires", "feat": "article_sun", "notion": "article",
             "resume": "ال devant une lettre solaire : le ل ne se prononce pas et la lettre suivante est doublée.",
             "comprendre": "الشَّمْسِ = « ash-shamsi ». Le ل n’a pas de signe ; la lettre suivante porte une shadda. Lettres solaires : ت ث د ذ ر ز س ش ص ض ط ظ ل ن."},
            {"id": "u4c", "titre": "La hamza", "feat": "hamza", "notion": "hamza",
             "resume": "ء : petite attaque de la voix. Elle se pose sur ا (أ إ), sur و (ؤ), sur ي sans points (ئ), ou seule (ء).",
             "comprendre": "La hamza est une consonne (coup de glotte, comme entre les deux « a » de « ah ah »). Le support (ا, و, ي) ne se prononce pas : seule la hamza et sa voyelle comptent."},
            {"id": "u4d", "titre": "Tā’ marbūṭa et alif maqṣūra", "feat": "ta_marbuta|alif_maqsura", "notion": "fins",
             "resume": "ة en fin de mot se lit « t » en liaison ; ى en fin de mot se lit « â ».",
             "comprendre": "رَحْمَةً = « raḥmatan » ; à l’arrêt, on dit « raḥmah ». عَلَى = « ʿalâ » : ى ressemble à ي sans points."},
            {"id": "u4e", "titre": "La ligature lām-alif", "feat": "lam_alif", "notion": "lam_alif",
             "resume": "ل suivi de ا s’écrit لا : c’est obligatoire.", "comprendre": "لَا = « lâ ». On la retrouve avec la hamza : لأ, لإ. En écrivant, trace la ligature d’un seul geste après la lettre précédente."},
            {"id": "u4f", "titre": "Petits mots attachés et alif de liaison", "feat": "wasla", "notion": "liaison",
             "resume": "و، ف، بِ، لِ، كَ s’attachent au mot suivant ; l’alif de l’article ne se prononce alors pas.",
             "comprendre": "وَالشَّمْسِ = « wash-shamsi » : on enchaîne « wa » et le mot, l’alif de l’article est muet. Dans le mushaf, cet alif muet porte un signe (ٱ) : tu le verras au niveau 5."},
        ],
        "skills": ["rec", "lie", "voy", "ecr", "dec"],
    },
    {
        "n": 5, "nom": "Les passages", "but": "Enchaîner plusieurs mots et comprendre les premiers repères de lecture coranique.",
        "preuve": "Lire de courts passages avec les arrêts travaillés.",
        "units": [
            {"id": "u5a", "titre": "Du manuel au mushaf", "notion": "mushaf", "marks": ["wasla", "dagger", "small_waw", "small_ya", "zero", "madd"],
             "resume": "Le mushaf utilise quelques signes de plus : ٱ (alif muet en liaison), ٰ (â), ۥ ۦ (voyelle allongée), ۟ (lettre muette), ٓ (allongement).",
             "comprendre": "Ces signes ne changent pas les mots : ils indiquent exactement comment les lire. Le petit alif ٰ se lit « â » ; ٱ ne se prononce pas quand on enchaîne ; une lettre surmontée d’un petit cercle ۟ est écrite mais muette."},
            {"id": "u5b", "titre": "Les signes de pause", "notion": "pauses", "marks": ["lazim", "awla_waqf", "jaiz", "awla_wasl", "mamnu", "taanuq"],
             "resume": "De petits signes au-dessus du texte indiquent où s’arrêter ou enchaîner.",
             "comprendre": "ۘ arrêt obligatoire ; ۗ arrêt préférable ; ۚ arrêt permis ; ۖ enchaîner de préférence ; ۙ ne pas s’arrêter ; ۛ … ۛ arrêt à l’un des deux. À la fin d’un verset (le numéro), on peut toujours s’arrêter."},
            {"id": "u5c", "titre": "Règles de base de la récitation", "notion": "regles",
             "resume": "Allongements, nasalisation (ghunna), rebond (qalqala) et fusion des lettres, tels que le mushaf les indique.",
             "comprendre": "Allongement naturel : deux temps ; le signe ٓ demande un allongement plus long. ن et م avec shadda : légère nasalisation (ghunna). ق ط ب ج د avec sukūn : petit rebond (qalqala). Quand une lettre n’a pas de sukūn et que la suivante porte une shadda, la première se fond dans la seconde."},
            {"id": "u5d", "titre": "Lire un passage avec ses arrêts", "notion": "passages",
             "resume": "Lire de courts passages, groupe de mots par groupe de mots, en respectant les arrêts.",
             "comprendre": "Lis d’abord par petits groupes, puis tout le verset d’une traite. Arrête-toi aux fins de versets et aux signes travaillés ; reprends après un arrêt au début du groupe."},
        ],
        "skills": ["voy", "dec", "pas", "ecr"],
    },
    {
        "n": 6, "nom": "La fluidité", "but": "Réduire les hésitations en gardant une lecture correcte.",
        "preuve": "Lire plusieurs passages différents sans phonétique.",
        "units": [
            {"id": "u6a", "titre": "Cycle de fluidité", "notion": "fluidite",
             "resume": "Lecture précise de petits groupes, réécoute ciblée, nouvelle lecture, puis un passage comparable.",
             "comprendre": "La relecture d’un même passage développe l’aisance ; un passage nouveau vérifie que tu sais vraiment déchiffrer. On ne cherche jamais la vitesse au prix de la justesse."},
        ],
        "skills": ["pas", "flu", "dec"],
    },
    {
        "n": 7, "nom": "L’autonomie", "but": "Transférer les acquis à des passages peu familiers.",
        "preuve": "Réussir plusieurs évaluations espacées et identifier ses difficultés restantes.",
        "units": [
            {"id": "u7a", "titre": "Passages peu familiers", "notion": "autonomie",
             "resume": "Des passages de tout le Coran, lus sans aide, évalués à plusieurs jours d’intervalle.",
             "comprendre": "Le bilan final repose sur plusieurs passages et plusieurs séances : il montre ce qui est acquis et ce qui reste à consolider, sans certificat automatique."},
        ],
        "skills": ["pas", "flu", "dec"],
    },
]

# ---------------------------------------------------------------------------------------------------------------
# Le cours : 3 parties, 10 chapitres. Un chapitre = des étapes numérotées (les unités ci-dessus, dans l'ordre),
# puis l'entraînement, puis l'examen du chapitre. Les niveaux ci-dessus restent la référence des contenus
# (lettres déjà vues, mots, passages) ; l'élève, lui, ne voit que les chapitres.
PARTS = [
    {"id": "p1", "n": 1, "nom": "Les lettres", "desc": "Les 28 lettres : les reconnaître, les nommer, les écrire.", "chapitres": [1, 2, 3, 4, 5]},
    {"id": "p2", "n": 2, "nom": "Lire des mots", "desc": "Voyelles, signes et formes particulières : déchiffrer n’importe quel mot.", "chapitres": [6, 7, 8]},
    {"id": "p3", "n": 3, "nom": "Lire le Coran", "desc": "Les signes du mushaf, les pauses, puis lire couramment.", "chapitres": [9, 10]},
]

CHAPTERS = [
    {"n": 1, "id": "c1", "part": "p1", "lv": 0, "titre": "Les bases", "units": ["u0a", "u0b", "u0c"],
     "but": "Savoir dans quel sens on lit, ce qui distingue une lettre d’une autre (les points), à quoi servent les petits signes, et quelles lettres ne s’attachent jamais à la suivante.",
     "savoir": ["L’arabe se lit de droite à gauche : la première lettre d’un mot est tout à droite.",
                "Beaucoup de lettres ont la même forme : seuls les points les distinguent (ب ت ث).",
                "Les voyelles brèves sont de petits signes au-dessus ou au-dessous des lettres.",
                "Six lettres ne s’attachent jamais à la suivante : ا د ذ ر ز و."]},
    {"n": 2, "id": "c2", "part": "p1", "lv": 1, "titre": "ا ب ت ث ن ي", "units": ["u1a", "u1b"],
     "but": "Reconnaître, nommer et écrire ا ب ت ث ن ي, seules et à leur place dans un mot.",
     "savoir": ["ب ت ث ن ي ont la même petite dent au début et au milieu d’un mot : on les distingue par les points.",
                "En fin de mot, ن forme une coupe et ي une boucle.",
                "L’alif ne s’attache pas à la lettre suivante."]},
    {"n": 3, "id": "c3", "part": "p1", "lv": 1, "titre": "ج ح خ · د ذ ر ز و", "units": ["u1c", "u1d"],
     "but": "Reconnaître, nommer et écrire ج ح خ (une seule forme, trois points différents) et د ذ ر ز و (qui ne s’attachent pas).",
     "savoir": ["ج : point dessous ; ح : aucun point ; خ : point dessus.",
                "ح est un h soufflé ; خ est raclé, comme la jota espagnole.",
                "د ذ ر ز و ne s’attachent jamais à la lettre suivante."]},
    {"n": 4, "id": "c4", "part": "p1", "lv": 1, "titre": "س ش ص ض · ط ظ ع غ", "units": ["u1e", "u1f"],
     "but": "Reconnaître, nommer et écrire س ش ص ض ط ظ ع غ et distinguer les sons proches.",
     "savoir": ["س ش : trois petites dents ; ص ض : une boucle allongée.",
                "ص ض ط ظ sont emphatiques : la langue se relève vers l’arrière, le son devient plus grave.",
                "ع est un son de gorge avec la voix ; غ ressemble au r parisien."]},
    {"n": 5, "id": "c5", "part": "p1", "lv": 1, "titre": "ف ق ك ل م ه", "units": ["u1g", "u1h"],
     "but": "Reconnaître, nommer et écrire les six dernières lettres : tu connais alors les 28.",
     "savoir": ["ف : un point ; ق : deux points.",
                "ل suivi de ا s’écrit toujours لا.",
                "ه change beaucoup de forme selon sa place : ه هـ ـهـ ـه."]},
    {"n": 6, "id": "c6", "part": "p2", "lv": 2, "titre": "Les voyelles courtes", "units": ["u2a", "u2b", "u2c", "u2d"],
     "but": "Lire et écrire une lettre avec sa voyelle (a, i, ou), puis des mots courts syllabe par syllabe.",
     "savoir": ["Fatḥa (trait au-dessus) : « a ». Kasra (trait au-dessous) : « i ». Ḍamma (petit wāw au-dessus) : « ou ».",
                "On lit lettre par lettre, de droite à gauche, chaque lettre avec sa voyelle."]},
    {"n": 7, "id": "c7", "part": "p2", "lv": 3, "titre": "Allonger, arrêter, doubler", "units": ["u3a", "u3b", "u3c", "u3d"],
     "but": "Lire les voyelles longues, le sukūn (pas de voyelle), la shadda (lettre doublée) et le tanwīn (an, in, oun).",
     "savoir": ["ا après une fatḥa, ي après une kasra, و après une ḍamma : la voyelle s’allonge.",
                "Sukūn (petit rond) : la lettre n’a pas de voyelle.",
                "Shadda : la lettre est prononcée deux fois.",
                "Tanwīn : voyelle doublée en fin de mot, « an », « in », « oun »."]},
    {"n": 8, "id": "c8", "part": "p2", "lv": 4, "titre": "Les mots", "units": ["u4a", "u4b", "u4c", "u4d", "u4e", "u4f"],
     "but": "Lire l’article (lettres lunaires et solaires), la hamza, ة et ى, la ligature لا et les petits mots attachés.",
     "savoir": ["Devant une lettre lunaire, le ل de ال se prononce ; devant une lettre solaire, il se tait et la lettre suivante est doublée.",
                "La hamza (ء) est une attaque de la voix ; son support ne se prononce pas.",
                "ة se lit « t » en liaison (« h » à l’arrêt) ; ى en fin de mot se lit « â »."]},
    {"n": 9, "id": "c9", "part": "p3", "lv": 5, "titre": "Lire le mushaf", "units": ["u5a", "u5b", "u5c", "u5d"],
     "but": "Comprendre les signes propres au mushaf et les signes de pause, puis lire un passage avec ses arrêts.",
     "savoir": ["ٱ ne se prononce pas quand on enchaîne ; le petit alif ٰ se lit « â ».",
                "Les signes de pause disent où s’arrêter ou enchaîner ; à la fin d’un verset, on peut toujours s’arrêter.",
                "Le mushaf indique les allongements (ٓ) et les lettres muettes (۟)."]},
    {"n": 10, "id": "c10", "part": "p3", "lv": 6, "titre": "Lire couramment", "units": ["u6a", "u7a"],
     "but": "Lire des passages sans hésiter, puis des passages jamais travaillés, en gardant une lecture juste.",
     "savoir": ["D’abord la justesse, ensuite l’aisance : jamais la vitesse au prix de la justesse.",
                "Lire par petits groupes de mots, réécouter, relire d’une traite."]},
]

# Examens : 20 questions notées par l'appli (une question = 1 point ; une dictée juste sans ses voyelles quand
# elles étaient demandées = ½ point). L'examen final : 30 questions ramenées sur 20. Partie orale à part.
# types « k_… » : réponse tapée au clavier arabe de l'appli. full = les voyelles comptent.
CHAPTER_EXAMS = {
    "c1": [
        {"titre": "Le sens de lecture", "types": ["sens"], "n": 5},
        {"titre": "La première lettre, au clavier", "types": ["k_premiere"], "n": 3},
        {"titre": "Les points", "types": ["points"], "n": 6},
        {"titre": "Les lettres qui ne s’attachent pas", "types": ["liaison", "forme"], "n": 6},
    ],
    "c2": "LETTRES", "c3": "LETTRES", "c4": "LETTRES",
    "c5": [
        {"titre": "Nommer les lettres", "types": ["nom"], "n": 5},
        {"titre": "Reconnaître une lettre", "types": ["lettre", "son"], "n": 4},
        {"titre": "Les lettres dans un mot", "types": ["forme"], "n": 5},
        {"titre": "Écrire la lettre, au clavier", "types": ["k_lettre"], "n": 4},
        {"titre": "Dictée de mots", "types": ["k_dictee"], "n": 2, "fb": ["k_lettre"]},
    ],
    "c6": [
        {"titre": "Lire une syllabe", "types": ["syllabe"], "n": 5},
        {"titre": "Lire un mot", "types": ["lecture"], "n": 4},
        {"titre": "Écouter", "types": ["ecoute"], "n": 4},
        {"titre": "Écrire une syllabe, avec sa voyelle", "types": ["k_syllabe"], "n": 4},
        {"titre": "Dictée de mots, avec les voyelles", "types": ["k_dictee"], "n": 3, "full": True},
    ],
    "c7": [
        {"titre": "Les signes", "types": ["signe"], "n": 6},
        {"titre": "Lire un mot", "types": ["lecture"], "n": 5},
        {"titre": "Écouter", "types": ["ecoute"], "n": 4},
        {"titre": "Dictée de mots, avec les voyelles et les signes", "types": ["k_dictee"], "n": 5, "full": True},
    ],
    "c8": [
        {"titre": "L’article", "types": ["article"], "n": 4},
        {"titre": "Formes particulières", "types": ["special"], "n": 4},
        {"titre": "Lire un mot", "types": ["lecture"], "n": 5},
        {"titre": "Écouter", "types": ["ecoute"], "n": 4},
        {"titre": "Dictée de mots", "types": ["k_dictee"], "n": 3},
    ],
    "c9": [
        {"titre": "Les signes du mushaf", "types": ["mushaf"], "n": 6, "marks": ["wasla", "dagger", "small_waw", "small_ya", "zero", "madd"]},
        {"titre": "Les signes de pause", "types": ["mushaf"], "n": 5, "marks": ["lazim", "awla_waqf", "jaiz", "awla_wasl", "mamnu", "taanuq"]},
        {"titre": "Lire un mot", "types": ["lecture"], "n": 5},
        {"titre": "Écouter", "types": ["ecoute"], "n": 4},
    ],
    "c10": [
        {"titre": "Des mots jamais travaillés", "types": ["lecture"], "n": 8, "fresh": True},
        {"titre": "Écouter", "types": ["ecoute"], "n": 6},
        {"titre": "Dictée de mots", "types": ["k_dictee"], "n": 3},
        {"titre": "Signes du mushaf et de pause", "types": ["mushaf"], "n": 3},
    ],
    "final": [
        {"titre": "Les lettres", "types": ["nom", "lettre", "son"], "n": 6, "lv": 1},
        {"titre": "Les lettres dans un mot", "types": ["forme"], "n": 4, "lv": 1},
        {"titre": "Voyelles et signes", "types": ["syllabe", "signe"], "n": 5, "lv": 3},
        {"titre": "Lire des mots", "types": ["lecture", "article", "special"], "n": 6, "lv": 4},
        {"titre": "Écouter", "types": ["ecoute"], "n": 4, "lv": 4},
        {"titre": "Écrire au clavier", "types": ["k_lettre", "k_dictee"], "n": 5, "lv": 3},
    ],
}
LETTRES = [
    {"titre": "Nommer les lettres", "types": ["nom"], "n": 5},
    {"titre": "Reconnaître une lettre", "types": ["lettre", "son"], "n": 4},
    {"titre": "Les lettres dans un mot", "types": ["forme"], "n": 5},
    {"titre": "Écrire la lettre, au clavier", "types": ["k_lettre"], "n": 4},
    {"titre": "Dictée de mots", "types": ["k_dictee"], "n": 2, "fb": ["k_lettre"]},
]
for _k, _v in list(CHAPTER_EXAMS.items()):
    if _v == "LETTRES":
        CHAPTER_EXAMS[_k] = LETTRES

VALIDATION = {
    "seuil": 16, "sur": 20,
    "regle": "Chaque examen compte 20 questions notées par l’appli (l’examen final : 30, ramenées sur 20). Réussi à partir de 16/20 ; en dessous, on refait un examen similaire, avec d’autres questions. La partie orale est notée à part, à titre indicatif.",
    "nature": "Choix de conception ajustable, pas une norme scientifique. Aucun contenu n’a été relu par un enseignant.",
}
