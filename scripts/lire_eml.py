#!/usr/bin/env python3
"""Lecture d'un message .eml — en-têtes, destinataires, corps texte.

⚠ POURQUOI DU PYTHON DANS UN DÉPÔT REACT, et pourquoi pas un parseur maison.
Un .eml n'est pas un fichier texte : en-têtes repliés sur plusieurs lignes,
noms d'affichage encodés en RFC 2047 (`=?utf-8?B?…?=`), corps multipart en
quoted-printable. Un parseur écrit à la main par expressions régulières rend du
charabia — ou pire, du texte partiel qui a l'air correct. Le module `email` de
la bibliothèque standard fait tout cela, il est déjà sur la machine, et il est
éprouvé depuis vingt ans. Même raisonnement que `lire_pdf.swift`.

⚠ ON LIT `To` ET `Bcc`. La spécification ne parlait que de `Bcc` ; le message du
18 août porte AUSSI un `To` de quatorze adresses, disjointes des trente-six du
`Bcc`. Ne prendre que le `Bcc` aurait effacé quatorze destinataires réels du
registre, sans que rien ne le signale. Vérifié sur le message, pas supposé.

⚠ LES NOMS SONT RENDUS TELS QU'ILS SONT DANS LE MESSAGE, mojibake compris. Le
message du 18 août porte un « Jean-Fran√ßois » correctement encodé en UTF-8 :
la corruption est dans la fiche de contact au moment de l'envoi, pas dans notre
lecture. La réparer ici écrirait dans le registre autre chose que ce qui est
parti — et masquerait une fiche à corriger.

Usage  : /usr/bin/python3 scripts/lire_eml.py <message.eml>
Sortie : un objet JSON sur la sortie standard.
"""

import json
import sys
import email
import email.policy
from email.utils import getaddresses, parsedate_to_datetime


def lire(chemin):
    with open(chemin, "r", encoding="utf-8", errors="replace") as f:
        msg = email.message_from_string(f.read(), policy=email.policy.default)

    # `getaddresses` sait défaire « Nom <adresse>, "Autre, avec virgule" <x> ».
    entrees = []
    for champ in ("To", "Cc", "Bcc"):
        valeurs = [str(v) for v in (msg.get_all(champ) or [])]
        for nom, adresse in getaddresses(valeurs):
            if adresse:
                entrees.append({"nom": nom or None, "email": adresse, "champ": champ})

    # Dédoublonnage sur l'ADRESSE en minuscules, en gardant la première
    # occurrence : c'est elle qui porte en général le nom le plus complet.
    vus = {}
    ordre = []
    for e in entrees:
        cle = e["email"].strip().lower()
        if cle in vus:
            continue
        vus[cle] = e
        ordre.append(e)

    date = None
    if msg["Date"]:
        try:
            date = parsedate_to_datetime(msg["Date"]).isoformat()
        except (TypeError, ValueError):
            # ⚠ Une date illisible reste nulle : l'appelant retombera sur le
            # manifeste plutôt que sur une date inventée.
            date = None

    partie = msg.get_body(preferencelist=("plain",))
    corps = partie.get_content() if partie else None

    return {
        "date": date,
        "objet": str(msg["Subject"]) if msg["Subject"] else None,
        "expediteur": str(msg["From"]) if msg["From"] else None,
        "destinataires": ordre,
        "corps": corps,
        # Les comptes par en-tête : c'est ce qui a permis de voir que le `To`
        # n'était pas vide. Repris tel quel dans le rapport d'import.
        "comptes": {
            champ: len([e for e in entrees if e["champ"] == champ])
            for champ in ("To", "Cc", "Bcc")
        },
    }


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.stderr.write("usage: lire_eml.py <message.eml>\n")
        sys.exit(2)
    try:
        print(json.dumps(lire(sys.argv[1]), ensure_ascii=False))
    except Exception as e:  # noqa: BLE001 — l'appelant veut la raison, pas la pile
        print(json.dumps({"erreur": str(e)}, ensure_ascii=False))
        sys.exit(1)
