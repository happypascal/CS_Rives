// Mention RGPD du registre des propriétaires (migration 035).
//
// Le texte vit ICI, dans une constante, et non dans le JSX : il est affiché à
// deux endroits (l'écran d'acceptation, puis le rappel permanent en tête du
// registre) et il est destiné à être relu — voire opposé — des années plus tard.
// Deux rédactions qui divergeraient seraient pires que pas de mention du tout.
//
// ⚠ NE PAS ADOUCIR sans arbitrage. Cette mention dit trois choses que Pascal a
// demandées explicitement, et chacune a une portée :
//   1. ce qui peut être communiqué, et rien d'autre : nom, adresse dans le
//      lotissement, numéro de lot ;
//   2. que le registre relève du RGPD ;
//   3. qu'une divulgation engage la responsabilité de celui qui la commet.
//
// Elle n'est pas un avis juridique et ne prétend pas en être un : elle rappelle
// une règle de conduite au sein du CS. Si le texte doit avoir une valeur
// opposable, il doit être relu par Me Garnier — c'est noté au backlog.

export const RGPD_REGISTRE_TITRE = 'Registre des propriétaires — données personnelles'

// Ce que l'on a le droit de communiquer. Repris tel quel dans les deux écrans.
export const RGPD_COMMUNICABLE = ['le nom du propriétaire', 'l’adresse dans le lotissement', 'le numéro de lot']

export const RGPD_REGISTRE_PARAGRAPHES = [
  'Ce registre contient des données à caractère personnel : noms, adresses privées, adresses électroniques et numéros de téléphone de propriétaires. À ce titre, il relève du Règlement Général sur la Protection des Données (RGPD).',
  'Il vous est ouvert au titre de vos fonctions au bureau du Conseil Syndical, et pour ce seul motif : convoquer, informer et administrer l’association syndicale. Il ne doit servir à rien d’autre.',
  'Vous ne pouvez communiquer à quiconque — coloti, tiers, prestataire — d’autre information que le nom du propriétaire, son adresse dans le lotissement et son numéro de lot. Les adresses de communication, adresses électroniques et numéros de téléphone ne sortent pas de ce registre.',
  'En cas de divulgation, votre responsabilité personnelle est engagée. Cela vaut aussi pour une transmission par commodité : un fichier exporté, une copie d’écran ou une liste recopiée dans un message échappent au registre et ne sont plus protégés.',
  'Vos consultations ne sont pas surveillées, mais votre acceptation de cette mention est horodatée et inscrite au journal de l’application.',
]

// Rappel court, affiché en permanence en tête du registre — la mention longue
// n'étant présentée qu'une fois.
export const RGPD_RAPPEL_COURT =
  'Données personnelles protégées par le RGPD. Ne communiquez que le nom, l’adresse dans le lotissement et le numéro de lot. Toute autre divulgation engage votre responsabilité.'
