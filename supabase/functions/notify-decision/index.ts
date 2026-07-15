// Edge Function Supabase — notifie les membres du CS (email + WhatsApp) lorsqu'une
// nouvelle décision à voter est créée.
//
// Déclenchement : Database Webhook sur INSERT de la table `decisions`.
//
// Les deux canaux sont indépendants : l'échec de l'un n'empêche pas l'autre, et
// chaque tentative est journalisée (visible dans les logs de la fonction).
//
// Secrets (Dashboard → Edge Functions → Secrets) :
//   RESEND_API_KEY  : clé API Resend (requis pour l'email)
//   FROM_EMAIL      : expéditeur (défaut onboarding@resend.dev en mode test)
//   APP_URL         : URL de l'app (défaut https://cs-rives.vercel.app)
//   TEST_EMAIL      : si défini, envoie UNIQUEMENT à cette adresse (mode test).
//                     En mode test Resend n'accepte que l'email du compte Resend.
//                     Laisse ce secret VIDE en production (domaine vérifié).
//   WHATSAPP_ENABLED     : 'false' pour couper le canal WhatsApp (défaut : actif)
//   TEST_WHATSAPP_PHONE  : si défini (avec la clé ci-dessous), envoie le WhatsApp
//   TEST_WHATSAPP_APIKEY : UNIQUEMENT à ce numéro (mode test).
//
// WhatsApp passe par CallMeBot : chaque membre autorise le bot depuis SON
// WhatsApp et reçoit SA propre clé, stockée dans membres_cs.whatsapp_apikey.
// Un membre sans numéro ou sans clé est ignoré côté WhatsApp — il garde l'email.
//
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'CS Rives <onboarding@resend.dev>'
const APP_URL = Deno.env.get('APP_URL') ?? 'https://cs-rives.vercel.app'
const TEST_EMAIL = Deno.env.get('TEST_EMAIL')?.trim()
const WHATSAPP_ENABLED = Deno.env.get('WHATSAPP_ENABLED')?.trim() !== 'false'
const TEST_WHATSAPP_PHONE = Deno.env.get('TEST_WHATSAPP_PHONE')?.trim()
const TEST_WHATSAPP_APIKEY = Deno.env.get('TEST_WHATSAPP_APIKEY')?.trim()

// CallMeBot est un service gratuit sans garantie de débit : on espace les envois
// plutôt que de les paralléliser.
const WHATSAPP_SPACING_MS = 1500

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

type Membre = {
  email: string | null
  telephone: string | null
  whatsapp_apikey: string | null
}

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function sendEmail(to: string, subject: string, html: string) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  })
  return { to, status: r.status, body: await r.text() }
}

async function sendWhatsApp(phone: string, apikey: string, text: string) {
  const url = 'https://api.callmebot.com/whatsapp.php'
    + `?phone=${encodeURIComponent(phone)}`
    + `&text=${encodeURIComponent(text)}`
    + `&apikey=${encodeURIComponent(apikey)}`
  // Sans User-Agent de navigateur, CallMeBot répond un 403 Apache (le User-Agent
  // Deno par défaut est filtré comme robot). Cf. GUIDE_C_whatsapp.md.
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,*/*',
    },
  })
  // Réponse en HTML : on la tronque, elle ne sert qu'au diagnostic dans les logs.
  return { to: phone, status: r.status, body: (await r.text()).slice(0, 300) }
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const dec = payload.record ?? payload
    if (!dec?.id || !dec?.titre) {
      return new Response('Ignoré (pas une décision)', { status: 200 })
    }

    const { data: membres, error } = await supabase
      .from('membres_cs')
      .select('email, telephone, whatsapp_apikey')
      .eq('actif', true)
    if (error) throw new Error(error.message)
    const actifs = (membres ?? []) as Membre[]

    const limite = fmtDate(dec.date_limite_reponse)
    const titre = `n° ${dec.numero ?? ''} — ${dec.titre}`

    // ---- Canal email ----------------------------------------------------
    const emailTo = TEST_EMAIL ? [TEST_EMAIL] : actifs.map((m) => m.email).filter(Boolean) as string[]
    const html = `
      <div style="font-family:Segoe UI,Arial,sans-serif;color:#1e2530">
        <h2 style="color:#1F3864;margin:0 0 8px">Nouvelle décision à voter</h2>
        <p><strong>N° ${dec.numero ?? ''} — ${dec.titre}</strong></p>
        ${limite ? `<p>Date limite de réponse : <strong>${limite}</strong></p>` : ''}
        <p>Connectez-vous pour voter (Pour / Contre / Abstention) :</p>
        <p><a href="${APP_URL}/registre" style="background:#1F3864;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Voter maintenant</a></p>
        <p style="font-size:12px;color:#8a93a6;margin-top:16px">Registre des décisions du Conseil Syndical — ASL Lotissement de Rives, Nernier.</p>
      </div>`

    const emails = []
    for (const to of emailTo) {
      emails.push(await sendEmail(to, `Nouvelle décision à voter — ${titre}`, html))
    }

    // ---- Canal WhatsApp -------------------------------------------------
    const waTargets = TEST_WHATSAPP_PHONE && TEST_WHATSAPP_APIKEY
      ? [{ phone: TEST_WHATSAPP_PHONE, apikey: TEST_WHATSAPP_APIKEY }]
      : actifs
          .filter((m) => m.telephone && m.whatsapp_apikey)
          .map((m) => ({ phone: m.telephone!, apikey: m.whatsapp_apikey! }))

    const text = [
      '*Nouvelle décision à voter*',
      `N° ${dec.numero ?? ''} — ${dec.titre}`,
      limite ? `Date limite de réponse : ${limite}` : '',
      `Voter : ${APP_URL}/registre`,
    ].filter(Boolean).join('\n')

    const whatsapps = []
    if (WHATSAPP_ENABLED) {
      for (const [i, t] of waTargets.entries()) {
        if (i > 0) await sleep(WHATSAPP_SPACING_MS)
        try {
          whatsapps.push(await sendWhatsApp(t.phone, t.apikey, text))
        } catch (e) {
          // Un numéro en échec ne doit pas faire tomber les suivants.
          whatsapps.push({ to: t.phone, status: 0, body: String(e) })
        }
      }
    }

    const summary = { from: FROM_EMAIL, emails, whatsapps, whatsapp_enabled: WHATSAPP_ENABLED }
    console.log('notify-decision', JSON.stringify(summary))
    return new Response(JSON.stringify({ ok: true, ...summary }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
})
