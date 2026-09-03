#!/usr/bin/env python3
"""Prépare l'envoi aux colotis depuis le registre de l'ASL.

Ce que fait ce script, dans l'ordre :
  1. lit la liste des destinataires exportée du registre (CSV ou TSV) ;
  2. cherche chaque adresse dans Contacts (Apple) ;
  3. crée les fiches manquantes ;
  4. SUPPRIME les trois groupes puis les reconstruit, équilibrés, à envoyer en Cci.

Les groupes sont refaits à chaque exécution parce que le registre de l'app est la
source : un groupe qu'on se contente de compléter garde indéfiniment les adresses
qui en ont été retirées, et l'envoi suivant part encore à l'ancien propriétaire.
⚠ Supprimer un groupe ne supprime AUCUNE fiche du carnet.

Pourquoi trois groupes : un envoi unique à cinquante adresses en Cci ressemble à
un publipostage et se fait filtrer. Trois envois d'une vingtaine passent, et le
Cci reste indispensable — mettre les adresses en « À » les divulguerait à tous
les colotis, ce que la mention RGPD du registre interdit explicitement.

⚠ PAR DÉFAUT, LE SCRIPT NE MODIFIE RIEN. Il affiche ce qu'il ferait. Relancer
avec --appliquer pour écrire dans le carnet d'adresses.

    python3 creer_groupes_colotis.py destinataires.csv
    python3 creer_groupes_colotis.py destinataires.csv --appliquer
    python3 creer_groupes_colotis.py destinataires.csv --terminal   (sans fenêtre)

⚠ COMPTER DEUX À TROIS MINUTES. Chaque recherche dans Contacts coûte environ deux
secondes sur un carnet de plusieurs centaines de fiches, et il en faut une par
destinataire. Mesuré, pas supposé : ni le regroupement des appels dans un seul
processus, ni la lecture en masse, ni le redécoupage de la liste aplatie ne
changent quoi que ce soit. C'est le prix d'un script lancé de loin en loin — et
c'est pour cette durée qu'une fenêtre d'avancement existe.

Le fichier source a une ligne d'en-tête et trois colonnes : nom, email, societe.
C'est exactement ce que produit `scripts/REQUETE_export_destinataires.sql`, à
exécuter dans le SQL Editor de Supabase puis à télécharger en CSV.

⚠ LE CSV NE DOIT JAMAIS ENTRER DANS CE DÉPÔT : il contient les noms et adresses
de cinquante colotis. Le garder dans le dossier de travail de l'ASL, avec les
autres pièces à données personnelles. Ce script, lui, n'est qu'un mécanisme — il
est versionné pour survivre au transfert de l'association (cf.
docs/TRANSFERT_ASL.md, section « Reprendre le projet »).

Le cycle complet :
  1. corriger les données dans l'app ;
  2. exécuter la requête, télécharger le CSV dans le dossier de travail ;
  3. lancer ce script à blanc pour voir ce qui a changé ;
  4. le relancer avec --appliquer ;
  5. envoyer le message trois fois, un groupe à la fois, adresses en Cci.
"""

import csv
import queue
import subprocess
import sys
import threading
from collections import OrderedDict
from pathlib import Path

DOSSIER = Path(__file__).resolve().parent
RAPPORT = DOSSIER / "Rapport_groupes_colotis.txt"
# ⚠ Le préfixe « _N. » n'est pas décoratif : c'est ainsi que les groupes ont été
# renommés dans Contacts pour qu'ils se suivent dans la colonne de gauche. Le
# script doit produire EXACTEMENT ces noms, sinon il en recrée trois autres,
# vides, à côté des vrais — et l'envoi partirait à personne.
PREFIXE_GROUPE = "Colotis Rives"
NB_GROUPES = 3


# ---------------------------------------------------------------- AppleScript
def osascript(source):
    """Exécute un AppleScript et renvoie sa sortie. Lève si Contacts refuse."""
    r = subprocess.run(["osascript", "-"], input=source, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip() or "AppleScript a échoué")
    return r.stdout.strip()


def echappe(valeur):
    """Guillemets et antislashs, seuls caractères qui cassent une chaîne AppleScript."""
    return str(valeur).replace("\\", "\\\\").replace('"', '\\"')


def id_par_adresse(adresse):
    """Identifiant de la fiche portant cette adresse, ou None.

    ⚠ Le filtre `whose` est le seul moyen praticable : parcourir `every person`
    en AppleScript sur un carnet de plusieurs centaines de fiches prend plusieurs
    minutes de plus.

    ⚠ La casse : le carnet contient « LMS_e@gmx.net » là où le registre écrit
    « lms_e@gmx.net ». On essaie les deux formes plutôt que de supposer que la
    comparaison d'AppleScript ignore la casse.
    """
    for forme in dict.fromkeys([adresse, adresse.lower()]):
        src = f'''
        tell application "Contacts"
          set trouve to ""
          repeat with p in (every person whose value of emails contains "{echappe(forme)}")
            set trouve to id of p
            exit repeat
          end repeat
          return trouve
        end tell'''
        identifiant = osascript(src)
        if identifiant:
            return identifiant
    return None


def creer_fiche(nom, adresse, societe):
    """Crée une fiche minimale. Le nom du registre est repris TEL QUEL.

    ⚠ Pas de découpage prénom / nom : le registre porte « Bermejo Philippe »,
    « SCI Ravoire », « Indivision Décima Julien ». Deviner où couper produirait
    des fiches fausses, et ces libellés sont ceux qu'on reconnaît dans le carnet.
    """
    props = (f'{{organization:"{echappe(nom)}", company:true}}' if societe
             else f'{{last name:"{echappe(nom)}"}}')
    src = f'''
    tell application "Contacts"
      set p to make new person with properties {props}
      make new email at end of emails of p with properties {{label:"ASL", value:"{echappe(adresse)}"}}
      save
      return id of p
    end tell'''
    return osascript(src)


def reinitialiser_groupe(nom_groupe):
    """Supprime le groupe s'il existe, puis le recrée VIDE.

    ⚠ Supprimer un GROUPE ne supprime aucune fiche : Contacts ne retire que
    l'appartenance.
    """
    src = f'''
    tell application "Contacts"
      if (exists group "{echappe(nom_groupe)}") then
        delete group "{echappe(nom_groupe)}"
        save
      end if
      make new group with properties {{name:"{echappe(nom_groupe)}"}}
      save
    end tell'''
    osascript(src)


def ajouter_au_groupe(identifiant, nom_groupe):
    src = f'''
    tell application "Contacts"
      add (first person whose id is "{echappe(identifiant)}") to group "{echappe(nom_groupe)}"
      save
    end tell'''
    osascript(src)


# --------------------------------------------------------------------- source
def lire_destinataires(chemin):
    """Lit le fichier exporté du registre. Dédoublonne sur l'adresse.

    ⚠ Le dédoublonnage est indispensable : une même personne peut être
    destinataire pour deux parcelles, et lui écrire deux fois est le genre de
    détail qui décrédibilise un envoi de l'association.
    """
    texte = Path(chemin).read_text(encoding="utf-8-sig")
    dialecte = csv.Sniffer().sniff(texte.splitlines()[0], delimiters=",;\t")
    destinataires = OrderedDict()
    for ligne in csv.DictReader(texte.splitlines(), dialect=dialecte):
        cles = {k.strip().lower(): (v or "").strip() for k, v in ligne.items() if k}
        adresse = cles.get("email", "").lower()
        if "@" in adresse and adresse not in destinataires:
            destinataires[adresse] = {
                "nom": cles.get("nom") or adresse,
                "societe": cles.get("societe", "").lower() in ("true", "t", "1", "oui"),
            }
    return destinataires


# ------------------------------------------------------------------ traitement
def traiter(destinataires, appliquer, avancer, interrompu):
    """Fait le travail. `avancer(i, total, texte)` rapporte, `interrompu()` arrête.

    Séparé de tout affichage pour tourner aussi bien dans un terminal que dans un
    fil d'exécution derrière une fenêtre.
    """
    total = len(destinataires)
    noms_groupes = [f"_{i + 1}.{PREFIXE_GROUPE} {i + 1} sur {NB_GROUPES}" for i in range(NB_GROUPES)]
    repartition = {n: [] for n in noms_groupes}
    # Répartition à la ronde plutôt qu'en tranches : si le fichier est trié par
    # nom, des tranches mettraient tous les A dans le premier groupe. À la ronde,
    # les trois envois sont interchangeables.
    for i, adresse in enumerate(destinataires):
        repartition[noms_groupes[i % NB_GROUPES]].append(adresse)

    crees, existants, echecs = [], [], []
    arrete = False

    if appliquer:
        avancer(0, total, "Réinitialisation des trois groupes…")
        for nom_groupe in noms_groupes:
            reinitialiser_groupe(nom_groupe)

    for i, (adresse, info) in enumerate(destinataires.items(), 1):
        if interrompu():
            arrete = True
            break
        nom_groupe = noms_groupes[(i - 1) % NB_GROUPES]
        avancer(i, total, f"{info['nom']} — {adresse}")
        try:
            identifiant = id_par_adresse(adresse)
            if identifiant is None:
                if appliquer:
                    identifiant = creer_fiche(info["nom"], adresse, info["societe"])
                crees.append((info["nom"], adresse))
            else:
                existants.append((info["nom"], adresse))
            if appliquer:
                ajouter_au_groupe(identifiant, nom_groupe)
        except Exception as e:  # une fiche en échec ne doit pas arrêter les autres
            echecs.append((info["nom"], adresse, str(e)))

    lignes = [
        "Rapport — groupes de colotis pour envoi en Cci",
        f"Mode : {'APPLIQUÉ' if appliquer else 'essai (rien écrit)'}",
        "",
        f"Destinataires uniques : {total}",
        f"Fiches déjà présentes : {len(existants)}",
        f"Fiches {'créées' if appliquer else 'à créer'} : {len(crees)}",
        f"Échecs : {len(echecs)}",
    ]
    if arrete:
        lignes += ["", "⚠ INTERROMPU AVANT LA FIN.",
                   "Les groupes ont été vidés puis remplis partiellement : relancer",
                   "entièrement avant tout envoi, sinon des colotis seront oubliés."]
    lignes += ["", "Groupes (supprimés puis reconstruits depuis le registre) :"]
    for nom_groupe in noms_groupes:
        lignes.append(f"  {nom_groupe} : {len(repartition[nom_groupe])} destinataires")
    if crees:
        lignes += ["", f"Fiches {'créées' if appliquer else 'à créer'} :"]
        lignes += [f"  {n}  <{a}>" for n, a in crees]
    if echecs:
        lignes += ["", "Échecs :"] + [f"  {n}  <{a}> : {e}" for n, a, e in echecs]
    RAPPORT.write_text("\n".join(lignes) + "\n", encoding="utf-8")
    return lignes


# -------------------------------------------------------------------- fenêtre
def avec_fenetre(destinataires, appliquer):
    """Fenêtre d'avancement. Le travail tourne dans un fil, l'affichage reste vif.

    ⚠ Tkinter n'est pas sûr hors du fil principal : le fil de travail ne touche
    donc à rien, il dépose ses messages dans une file que la fenêtre vide toutes
    les 100 ms.
    """
    import tkinter as tk
    from tkinter import ttk

    messages = queue.Queue()
    stop = threading.Event()
    resultat = {}
    total = len(destinataires)

    racine = tk.Tk()
    racine.title("Groupes de colotis" + ("" if appliquer else " — essai"))
    racine.geometry("640x280")
    cadre = ttk.Frame(racine, padding=16)
    cadre.pack(fill="both", expand=True)

    titre = ttk.Label(cadre, font=("", 13, "bold"),
                      text=("Reconstruction des groupes" if appliquer else "Essai — rien ne sera écrit"))
    titre.pack(anchor="w")
    sous_titre = ttk.Label(cadre, foreground="#555",
                           text=f"{total} destinataires · compter deux à trois minutes")
    sous_titre.pack(anchor="w", pady=(2, 12))

    barre = ttk.Progressbar(cadre, mode="determinate", maximum=total)
    barre.pack(fill="x")
    compteur = ttk.Label(cadre, text="Démarrage…")
    compteur.pack(anchor="w", pady=(8, 0))
    courant = ttk.Label(cadre, foreground="#555", wraplength=580, justify="left", text="")
    courant.pack(anchor="w", pady=(2, 0))

    bouton = ttk.Button(cadre, text="Interrompre", command=stop.set)
    bouton.pack(side="bottom", anchor="e", pady=(12, 0))

    def travail():
        try:
            resultat["lignes"] = traiter(
                destinataires, appliquer,
                lambda i, t, texte: messages.put(("progres", i, t, texte)),
                stop.is_set,
            )
        except Exception as e:
            resultat["lignes"] = ["Échec du traitement :", str(e)]
        messages.put(("fini", 0, 0, ""))

    def vider():
        try:
            while True:
                genre, i, t, texte = messages.get_nowait()
                if genre == "progres":
                    barre["value"] = i
                    compteur.config(text=f"{i} sur {t}")
                    courant.config(text=texte)
                else:
                    # ⚠ Le rapport s'affiche DANS la fenêtre : lancé depuis le
                    # Finder, le script n'a pas de terminal où le lire.
                    for w in (barre, compteur, courant, sous_titre):
                        w.pack_forget()
                    titre.config(text="Terminé" + ("" if appliquer else " — essai, rien écrit"))
                    zone = tk.Text(cadre, height=12, wrap="word")
                    zone.insert("1.0", "\n".join(resultat.get("lignes", [])))
                    zone.config(state="disabled")
                    zone.pack(fill="both", expand=True, pady=(8, 0))
                    racine.geometry("640x440")
                    bouton.config(text="Fermer", command=racine.destroy)
                    return
        except queue.Empty:
            pass
        racine.after(100, vider)

    threading.Thread(target=travail, daemon=True).start()
    racine.after(100, vider)
    racine.mainloop()
    return resultat.get("lignes", [])


# ----------------------------------------------------------------------- main
def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    appliquer = "--appliquer" in sys.argv
    sans_fenetre = "--terminal" in sys.argv
    if not args:
        print(__doc__)
        sys.exit(1)

    destinataires = lire_destinataires(args[0])
    print(f"{len(destinataires)} destinataires uniques dans {Path(args[0]).name}")
    if not appliquer:
        print("MODE ESSAI — rien ne sera écrit dans Contacts. Ajouter --appliquer pour agir.")
        print("À l'application, les 3 groupes seront SUPPRIMÉS puis reconstruits d'après ce fichier.")
        print("Les fiches du carnet ne sont jamais supprimées.")

    if sans_fenetre:
        lignes = traiter(destinataires, appliquer,
                         lambda i, t, texte: print(f"  [{i:2}/{t}] {texte}"),
                         lambda: False)
    else:
        lignes = avec_fenetre(destinataires, appliquer)

    print()
    print("\n".join(lignes))
    print(f"\nRapport écrit : {RAPPORT}")
    if not appliquer:
        print("\nRelancer avec --appliquer pour créer les fiches et reconstruire les groupes.")


if __name__ == "__main__":
    main()
