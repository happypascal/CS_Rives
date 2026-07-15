// Edge Function Supabase — notifie les membres du CS par email lorsqu'une
// nouvelle décision à voter est créée.
//
// Déclenchement : Database Webhook sur INSERT de la table `decisions`.
//
// Secrets (Dashboard → Edge Functions → Secrets) :
//   RESEND_API_KEY  : clé API Resend (requis)
//   FROM_EMAIL      : expéditeur (défaut onboarding@resend.dev en mode test)
//   APP_URL         : URL de l'app (défaut https://cs-rives.vercel.app)
//   TEST_EMAIL      : si défini, envoie UNIQUEMENT à cette adresse (mode test).
//                     En mode test Resend n'accepte que l'email du compte Resend.
//                     Laisse ce secret VIDE en production (domaine vérifié).
//
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'CS Rives <onboarding@resend.dev>'
const APP_URL = Deno.env.get('APP_URL') ?? 'https://cs-rives.vercel.app'
const TEST_EMAIL = Deno.env.get('TEST_EMAIL')?.trim()

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const dec = payload.record ?? payload
    if (!dec?.id || !dec?.titre) {
      return new Response('Ignoré (pas une décision)', { status: 200 })
    }

    // Destinataires : en mode test, uniquement TEST_EMAIL ; sinon membres actifs.
    let recipients: string[]
    if (TEST_EMAIL) {
      recipients = [TEST_EMAIL]
    } else {
      const { data: membres, error } = await supabase
        .from('membres_cs')
        .select('email')
        .eq('actif', true)
      if (error) throw new Error(error.message)
      recipients = (membres ?? []).map((m) => m.email).filter(Boolean)
    }
    if (recipients.length === 0) return new Response('Aucun destinataire', { status: 200 })

    const limite = fmtDate(dec.date_limite_reponse)
    const html = `
      <div style="font-family:Segoe UI,Arial,sans-serif;color:#1e2530">
        <h2 style="color:#1F3864;margin:0 0 8px">Nouvelle décision à voter</h2>
        <p><strong>N° ${dec.numero ?? ''} — ${dec.titre}</strong></p>
        ${limite ? `<p>Date limite de réponse : <strong>${limite}</strong></p>` : ''}
        <p>Connectez-vous pour voter (Pour / Contre / Abstention) :</p>
        <p><a href="${APP_URL}/registre" style="background:#1F3864;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Voter maintenant</a></p>
        <p style="font-size:12px;color:#8a93a6;margin-top:16px">Registre des décisions du Conseil Syndical — ASL Lotissement de Rives, Nernier.</p>
      </div>`

    // Envoi + capture de la réponse Resend (visible dans les logs).
    const results = []
    for (const to of recipients) {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to,
          subject: `Nouvelle décision à voter — n° ${dec.numero ?? ''}`,
          html,
        }),
      })
      results.push({ to, status: r.status, body: await r.text() })
    }
    console.log('notify-decision', JSON.stringify({ from: FROM_EMAIL, results }))
    return new Response(JSON.stringify({ ok: true, from: FROM_EMAIL, results }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
})
