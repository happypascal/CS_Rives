#!/usr/bin/env python3
"""Lecture des résumés d'assemblée un par un (.docx) → JSON.

⚠ CE N'EST PAS LE REGISTRE CONSOLIDÉ. Il existe deux documents :
  - `Registre_decisions_AG_Rives_1988-2026.docx`, une table pour tout le fonds,
    qui a servi à REMPLIR la base (`lire_registre_ag.py`) ;
  - un `Resume_AG_<date>.docx` par assemblée, qui dit la même chose sous la forme
    d'une fiche.
Ce script lit les seconds, pour pouvoir CONFRONTER la base à une source qui n'a
pas servi à la remplir. Vérifier une donnée avec ce qui l'a produite ne vérifie
rien.

Format constaté (identique de 1988 à 2026) :
    ASL du Lotissement de Rives — Nernier
    <Titre : Assemblée générale ordinaire du 26 octobre 2024>
    | Président de séance | Scrutateur | Secrétaire (Foncia) | Quorum |
    | <valeurs>                                                      |
    Résolutions <unité de vote>
    | N° | Sujet | Décision | Résultat du vote |
    | <résolutions…>                            |
    Résumé établi le <date> d'après le procès-verbal ; seul le PV fait foi.

Usage  : /usr/bin/python3 scripts/lire_resume_ag.py <dossier racine des AG>
Sortie : { "resumes": [...] } sur la sortie standard.
"""

import json
import os
import re
import sys
import zipfile

MOIS = {
    'janvier': 1, 'février': 2, 'fevrier': 2, 'mars': 3, 'avril': 4, 'mai': 5,
    'juin': 6, 'juillet': 7, 'août': 8, 'aout': 8, 'septembre': 9,
    'octobre': 10, 'novembre': 11, 'décembre': 12, 'decembre': 12,
}


def date_iso(texte):
    m = re.search(r'(\d{1,2})\s+([A-Za-zéûôàè]+)\s+(\d{4})', texte or '')
    if not m:
        return None
    mois = MOIS.get(m.group(2).lower())
    return '%s-%02d-%02d' % (m.group(3), mois, int(m.group(1))) if mois else None


def contenu(chemin):
    """Le document, en (paragraphes hors tableau, lignes de tableau)."""
    with zipfile.ZipFile(chemin) as z:
        xml = z.read('word/document.xml').decode('utf-8')
    xml = xml.replace('</w:tc>', '\x01').replace('</w:tr>', '\x02').replace('</w:p>', '\x03')
    texte = re.sub(r'<[^>]+>', '', xml)
    # ⚠ Les entités XML sont décodées APRÈS le retrait des balises : &amp;lt;
    # deviendrait sinon une balise fantôme.
    for brut, clair in (('&amp;', '&'), ('&lt;', '<'), ('&gt;', '>'),
                        ('&quot;', '"'), ('&apos;', "'")):
        texte = texte.replace(brut, clair)

    # ⚠ TOUS les paragraphes, à plat. Le titre du document et l'intertitre
    # « Résolutions … » se retrouvent AVALÉS dans la première cellule du tableau
    # qui les suit : tout ce qui précède le premier `</w:tr>` tombe dans le même
    # bloc. Les chercher « hors tableau » ne donnait rien — premier essai, zéro
    # en-tête lu sur vingt-cinq fichiers.
    paragraphes = [re.sub(r'\s+', ' ', p).strip()
                   for p in texte.replace('\x01', '\x03').replace('\x02', '\x03').split('\x03')]
    paragraphes = [p for p in paragraphes if p]

    lignes = []
    for bloc in texte.split('\x02'):
        cellules = []
        for c in bloc.split('\x01'):
            paras = [re.sub(r'\s+', ' ', p).strip() for p in c.split('\x03')]
            paras = [p for p in paras if p]
            if paras:
                cellules.append(paras)
        if cellules and '\x01' in bloc:
            lignes.append(cellules)
    return paragraphes, lignes


def lire_un(chemin):
    paragraphes, lignes = contenu(chemin)

    titre = next((p for p in paragraphes if p.lower().startswith('assemblée')), None)
    unite = next((p[len('Résolutions'):].strip() for p in paragraphes
                  if p.startswith('Résolutions')), None)
    etabli = next((date_iso(p) for p in paragraphes if p.startswith('Résumé établi')), None)

    entete, resolutions = {}, []
    attend_valeurs = False
    dans_resolutions = False
    for cellules in lignes:
        plat = [' '.join(c) for c in cellules]

        # ⚠ On reconnaît la ligne d'en-tête à « Scrutateur » en DEUXIÈME cellule,
        # pas à « Président de séance » en première : celle-ci porte aussi le
        # titre du document, collé devant.
        if len(plat) >= 2 and plat[1] == 'Scrutateur':
            attend_valeurs = True
            continue
        if attend_valeurs and len(plat) >= 4:
            entete = {
                'president': plat[0], 'scrutateur': plat[1],
                'secretaire': plat[2], 'quorum': plat[3],
            }
            attend_valeurs = False
            continue
        # Même raison : « N° » peut être précédé de l'intertitre « Résolutions … ».
        if len(plat) >= 2 and plat[1] == 'Sujet':
            dans_resolutions = True
            continue
        if dans_resolutions and len(plat) >= 4:
            resolutions.append({
                'numero': plat[0], 'sujet': plat[1],
                'decision': plat[2], 'resultat': plat[3],
            })

    return {
        'fichier': os.path.basename(chemin),
        'date_ag': date_iso(titre) or date_iso(os.path.basename(chemin)),
        'titre': titre,
        'unite_vote': unite,
        'resume_etabli_le': etabli,
        **entete,
        'resolutions': resolutions,
    }


def lire(racine):
    out = []
    for dossier, _, fichiers in os.walk(racine):
        for f in sorted(fichiers):
            if re.match(r'^Resume_AG_.*\.docx$', f) and not f.startswith('~$'):
                out.append(lire_un(os.path.join(dossier, f)))
    return {'resumes': sorted(out, key=lambda r: r['date_ag'] or '')}


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.stderr.write('usage: lire_resume_ag.py <dossier des AG>\n')
        sys.exit(2)
    try:
        print(json.dumps(lire(sys.argv[1]), ensure_ascii=False))
    except Exception as e:  # noqa: BLE001
        print(json.dumps({'erreur': str(e)}, ensure_ascii=False))
        sys.exit(1)
