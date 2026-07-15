// Edge Function Supabase — notifie les membres du CS par email lorsqu'une
// nouvelle décision à voter est créée.
//
// Déclenchement : Database Webhook sur INSERT de la table `decisions`
// (Dashboard → Database → Webhooks). Le webhook envoie { type, record }.
//
// Secrets requis (Dashboard → Edge Functions → notify-decision → Secrets) :
//   RESEND_API_KEY  : clé API Resend (https://resend.com)
//   FROM_EMAIL      : expéditeur vérifié dans Resend (ex: "CS Rives <cs@ton-domaine.fr>")
//   APP_URL         : (optionnel) URL de l'app, défaut https://cs-rives.vercel.app
//
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'CS Rives <onboarding@resend.dev>'
const APP_URL = Deno.env.get('APP_URL') ?? 'https://cs-rives.vercel.app'

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

    // Destinataires : membres actifs (ils ont tous à voter).
    const { data: membres, error } = await supabase
      .from('membres_cs')
      .select('email, prenom')
      .eq('actif', true)
    if (error) throw new Error(error.message)

    const recipients = (membres ?? []).map((m) => m.email).filter(Boolean)
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

    // Un envoi par membre (chacun ne voit que son adresse).
    const results = await Promise.allSettled(
      recipients.map((to) =>
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to,
            subject: `Nouvelle décision à voter — n° ${dec.numero ?? ''}`,
            html,
          }),
        }),
      ),
    )
    const sent = results.filter((r) => r.status === 'fulfilled').length
    return new Response(JSON.stringify({ ok: true, sent, total: recipients.length }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
})
