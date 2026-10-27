#!/usr/bin/env python3
"""Programme « Lire et écrire l'arabe » : niveaux, unités, compétences, grilles d'examen.

Ce fichier ne contient que l'organisation pédagogique et les consignes (en français). Les lettres, signes
et mots viennent de lettres.py et du texte coranique (build_bank.py). Choix de conception (pas une norme) :
validation d'un niveau à 16/20 sur chaque compétence obligatoire, confirmée sur une autre série lors d'une
séance ultérieure (au moins le lendemain).
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

# Grilles d'examen (annoncées avant de commencer). obligatoire = compte pour la validation.
EXAMS = {
    0: [{"comp": "rec", "titre": "Reconnaissance", "n": 10, "type": "auto", "obligatoire": True}],
    1: [
        {"comp": "rec", "titre": "Reconnaître les lettres (ordre variable)", "n": 14, "type": "auto", "obligatoire": True},
        {"comp": "lie", "titre": "Retrouver une lettre dans un mot", "n": 8, "type": "auto", "obligatoire": True},
        {"comp": "ecr", "titre": "Écrire des lettres (sur papier ou à l’écran)", "n": 6, "type": "auto-eval", "obligatoire": True},
    ],
    2: [
        {"comp": "voy", "titre": "Lire des syllabes", "n": 10, "type": "auto", "obligatoire": True},
        {"comp": "dec", "titre": "Déchiffrer des mots nouveaux", "n": 8, "type": "auto", "obligatoire": True},
        {"comp": "ecr", "titre": "Dictée de mots", "n": 5, "type": "auto", "obligatoire": True},
        {"comp": "ecr", "titre": "Écrire sans modèle", "n": 4, "type": "auto-eval", "obligatoire": False},
    ],
    3: [
        {"comp": "voy", "titre": "Lire les signes", "n": 10, "type": "auto", "obligatoire": True},
        {"comp": "dec", "titre": "Déchiffrer des mots nouveaux", "n": 10, "type": "auto", "obligatoire": True},
        {"comp": "ecr", "titre": "Dictée de mots", "n": 5, "type": "auto", "obligatoire": True},
        {"comp": "pas", "titre": "Lecture à voix haute", "n": 4, "type": "auto-eval", "obligatoire": False},
    ],
    4: [
        {"comp": "voy", "titre": "Formes particulières", "n": 10, "type": "auto", "obligatoire": True},
        {"comp": "dec", "titre": "Déchiffrer des mots nouveaux", "n": 12, "type": "auto", "obligatoire": True},
        {"comp": "ecr", "titre": "Dictée de mots", "n": 6, "type": "auto", "obligatoire": True},
        {"comp": "pas", "titre": "Lecture à voix haute", "n": 4, "type": "auto-eval", "obligatoire": False},
    ],
    5: [
        {"comp": "voy", "titre": "Signes du mushaf et de pause", "n": 10, "type": "auto", "obligatoire": True},
        {"comp": "dec", "titre": "Mots du mushaf jamais travaillés", "n": 10, "type": "auto", "obligatoire": True},
        {"comp": "pas", "titre": "Lire un passage avec ses arrêts", "n": 2, "type": "auto-eval", "obligatoire": True},
    ],
    6: [
        {"comp": "dec", "titre": "Mots nouveaux", "n": 10, "type": "auto", "obligatoire": True},
        {"comp": "pas", "titre": "Passages nouveaux, sans phonétique", "n": 3, "type": "auto-eval", "obligatoire": True},
        {"comp": "flu", "titre": "Fluidité (justesse, hésitations, continuité)", "n": 2, "type": "auto-eval", "obligatoire": True},
    ],
    7: [
        {"comp": "dec", "titre": "Mots nouveaux de tout le Coran", "n": 12, "type": "auto", "obligatoire": True},
        {"comp": "pas", "titre": "Passages peu familiers", "n": 3, "type": "auto-eval", "obligatoire": True},
        {"comp": "flu", "titre": "Fluidité", "n": 2, "type": "auto-eval", "obligatoire": True},
    ],
}

VALIDATION = {
    "seuil": 16, "sur": 20,
    "regle": "Chaque compétence obligatoire doit atteindre 16/20, puis être confirmée sur une autre série lors d’une séance ultérieure (au moins le lendemain). Une note de reconnaissance ne compense jamais une lecture ou une écriture insuffisante.",
    "nature": "Choix de conception ajustable, pas une norme scientifique.",
}
