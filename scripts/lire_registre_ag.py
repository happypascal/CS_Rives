#!/usr/bin/env python3
"""Lecture du registre consolidé des décisions d'AG (.docx) → JSON.

⚠ POURQUOI LE .docx ET NON LES PDF DE RÉSUMÉ. Il existe un résumé par assemblée,
en PDF, et un registre consolidé qui reprend les mêmes données sous forme de
TABLEAU. Les deux disent la même chose ; un tableau de .docx se lit par ses
cellules, un tableau de PDF se lit par des coordonnées et des sauts de ligne qui
recollent « Non votée » et « — » en « Non votée— ». Le premier est une donnée, le
second une mise en page. On lit la donnée.

⚠ AUCUNE DÉPENDANCE : un .docx est un ZIP dont `word/document.xml` porte le
texte. `zipfile` et `re` suffisent — `python-docx` n'est pas installé sur cette
machine et n'a pas à l'être pour lire six colonnes.

Structure du document, constatée sur le fichier réel (1988-2026) :
  1. Un tableau de SYNTHÈSE, une ligne par assemblée :
     Date | Type | Syndic | Présents ou représentés | Président de séance | Décisions
  2. Puis, par assemblée, un tableau de RÉSOLUTIONS précédé d'une ligne d'en-tête
     dont la première cellule porte le titre de l'assemblée :
     « Assemblée générale ordinaire du 28 juin 2003 » | Objet et décision |
     Résultat | Pour | Contre | Abstention

Usage  : /usr/bin/python3 scripts/lire_registre_ag.py <registre.docx>
Sortie : un objet JSON { assemblees: [...] } sur la sortie standard.
"""

import json
import re
import sys
import zipfile

MOIS = {
    'janvier': 1, 'février': 2, 'fevrier': 2, 'mars': 3, 'avril': 4, 'mai': 5,
    'juin': 6, 'juillet': 7, 'août': 8, 'aout': 8, 'septembre': 9,
    'octobre': 10, 'novembre': 11, 'décembre': 12, 'decembre': 12,
}


def date_iso(texte):
    """« 28 juin 2003 » → « 2003-06-28 ». None si ce n'est pas une date."""
    m = re.search(r'(\d{1,2})\s+([A-Za-zéûôàè]+)\s+(\d{4})', texte or '')
    if not m:
        return None
    mois = MOIS.get(m.group(2).lower())
    if not mois:
        return None
    return '%s-%02d-%02d' % (m.group(3), mois, int(m.group(1)))


def nombre(texte):
    """« 3 400 » → 3400. None sur « — », « n/c », vide.

    ⚠ None et 0 ne sont PAS la même chose : un zéro dit que personne n'a voté
    ainsi, None que le procès-verbal ne le chiffre pas. Une lacune n'est pas une
    défaite.
    """
    t = (texte or '').strip()
    if not t or t in ('—', '-', '–', 'n/c'):
        return None
    # ⚠ « 40 COPROPRIÉTAIRES TOTALISENT 4100 / 5100 TANTIÈMES » — trois cellules
    # de l'AG de 2004 comptent d'abord les PERSONNES, et la voix vient après le
    # verbe. Le premier nombre y est un effectif : le retenir a rangé 40 dans une
    # colonne qui compte des voix sur 5 100, soit deux ordres de grandeur
    # d'écart, sur une résolution adoptée à l'unanimité. Trouvé en confrontant la
    # base aux résumés par année, jamais en relisant le registre seul.
    # ⚠ On ne saute au nombre suivant que sur ce verbe précis : partout ailleurs
    # (« 3 200 sur 3 400 tantièmes ») le premier nombre est bien la voix, et une
    # règle plus large casserait les cent trente autres cellules.
    apres_verbe = re.search(r'totalisent\s*(\d[\d\s.]*)', t, re.IGNORECASE)
    if apres_verbe:
        chiffres = re.sub(r'[^\d]', '', apres_verbe.group(1))
        return int(chiffres) if chiffres else None

    # Espaces de toutes sortes, y compris l'insécable et la fine.
    # ⚠ LE PREMIER NOMBRE, PAS TOUS LES CHIFFRES. Une première version retirait
    # tout ce qui n'était pas un chiffre : « 75 540 sur 104 646 » devenait
    # 75540104646, et une cellule citant les votants rendait quarante-six
    # chiffres. Ces cellules ne contiennent pas qu'un nombre — elles portent
    # l'assiette du vote (« sur 3 200 tantièmes ») et parfois la liste des noms.
    m = re.match(r'\s*(\d[\d\s.]*)', t)
    if not m:
        return None
    chiffres = re.sub(r'[^\d]', '', m.group(1))
    return int(chiffres) if chiffres else None


def lignes_de_tableau(chemin):
    """Les lignes de tous les tableaux, chacune en liste de cellules."""
    with zipfile.ZipFile(chemin) as z:
        xml = z.read('word/document.xml').decode('utf-8')
    # ⚠ Les marqueurs sont posés AVANT de retirer les balises : une fois le XML
    # aplati, plus rien ne distingue une cellule d'une autre.
    # ⚠ Le saut de PARAGRAPHE est conservé (\x03) et non aplati en espace : dans
    # la colonne « objet », le premier paragraphe est le TITRE de la résolution et
    # les suivants son détail. Collés, on obtenait « Approbation des statuts de
    # mise en conformité de l'ASL Approbation des statuts de l'ASL rédigés par
    # Me Garnier… » — le titre répété au début d'un pavé, illisible en tableau.
    xml = xml.replace('</w:tc>', '\x01').replace('</w:tr>', '\x02').replace('</w:p>', '\x03')
    texte = re.sub(r'<[^>]+>', '', xml)
    out = []
    for ligne in texte.split('\x02'):
        cellules = []
        for c in ligne.split('\x01'):
            paragraphes = [re.sub(r'\s+', ' ', p).strip() for p in c.split('\x03')]
            paragraphes = [p for p in paragraphes if p]
            if paragraphes:
                cellules.append(paragraphes)
        if cellules:
            out.append(cellules)
    return out


def lire(chemin):
    lignes = lignes_de_tableau(chemin)
    par_date = {}
    courante = None

    for cellules in lignes:
        # Une cellule = une liste de paragraphes. `plat` en donne le texte
        # complet, `tete` le premier paragraphe seul.
        plat = [' '.join(c) for c in cellules]
        premiere = plat[0]

        # En-tête d'un tableau de résolutions : la première cellule nomme
        # l'assemblée, les suivantes sont les titres de colonnes.
        if len(cellules) >= 6 and plat[1].startswith('Objet et décision'):
            iso = date_iso(premiere)
            courante = par_date.get(iso)
            if courante is None and iso:
                courante = {'date_ag': iso, 'resolutions': []}
                par_date[iso] = courante
            continue

        # Ligne du tableau de synthèse : la première cellule est une date.
        iso = date_iso(premiere)
        if iso and len(cellules) >= 6 and re.match(r'^AG[OE]$', plat[1]):
            a = par_date.setdefault(iso, {'date_ag': iso, 'resolutions': []})
            a['type_ag'] = plat[1]
            a['syndic'] = plat[2]
            a['presents_representes'] = plat[3]
            a['president_seance'] = plat[4]
            # ⚠ Le décompte annoncé — « 20 (13 adoptées, 1 rejetées) ». Il ne
            # sert pas à l'affichage mais au RECOUPEMENT : c'est lui qui dit si
            # l'analyse du tableau a perdu des lignes en route.
            a['decisions_annoncees'] = plat[5]
            courante = None
            continue

        # Ligne de résolution : six cellules, dans le tableau ouvert au-dessus.
        if courante is not None and len(cellules) >= 6:
            if premiere in ('N°', 'No', 'Numéro'):
                continue
            # Premier paragraphe = titre, le reste = détail.
            objet = cellules[1]
            courante['resolutions'].append({
                'numero': premiere,
                'objet': objet[0],
                'detail': ' '.join(objet[1:]) or None,
                'resultat': plat[2],
                'pour': nombre(plat[3]),
                'contre': nombre(plat[4]),
                'abstention': nombre(plat[5]),
                # ⚠ LE TEXTE BRUT EST CONSERVÉ à côté du nombre. « 1 500 sur
                # 3 200 tantièmes (ALLEN PEREGRINE, BERSETH GILBERT, …) » ne se
                # résume pas à 1500 : l'assiette du vote, et parfois les votants
                # eux-mêmes, ne se retrouvent nulle part ailleurs.
                'voix_texte': {'pour': plat[3], 'contre': plat[4], 'abstention': plat[5]},
            })

    return {'assemblees': sorted(par_date.values(), key=lambda a: a['date_ag'])}


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.stderr.write('usage: lire_registre_ag.py <registre.docx>\n')
        sys.exit(2)
    try:
        print(json.dumps(lire(sys.argv[1]), ensure_ascii=False))
    except Exception as e:  # noqa: BLE001 — l'appelant veut la raison, pas la pile
        print(json.dumps({'erreur': str(e)}, ensure_ascii=False))
        sys.exit(1)
