// Abstract electronic-signature layer.
// Frozen decision: ship a MOCK provider first, keep the real Yousign wiring
// behind the same interface so it's a one-line swap later.
//
// Interface:
//   createSignatureRequest({ decisionNumero, pdfBlob, signers }) -> { requestId, statut }
//   getStatus(requestId) -> { statut }   ('en_attente' | 'signe' | 'expire')
import { SIGNATURE_PROVIDER } from './config'

// ---- Mock provider: instantly "sends" and marks as pending, then lets the UI
// simulate completion. No external calls. ----
const mockProvider = {
  name: 'mock',
  async createSignatureRequest({ decisionNumero, signers }) {
    await new Promise((r) => setTimeout(r, 150))
    return {
      requestId: `mock-req-${decisionNumero}-${Date.now().toString(36)}`,
      statut: 'en_attente',
      signers: signers.map((s) => s.email),
      note:
        'Mode démo : aucune demande réelle n’a été envoyée. En production, Yousign enverrait un email à chaque signataire.',
    }
  },
  async getStatus() {
    return { statut: 'en_attente' }
  },
  // Demo-only helper: mark a request as signed from the UI.
  async simulateSigned() {
    return { statut: 'signe', pdf_url: 'mock://signed.pdf', signed_at: new Date().toISOString() }
  },
}

// ---- Yousign provider stub. NOT called in mock mode. In production the API key
// must live server-side (Supabase Edge Function), never in the client bundle.
// This stub documents the intended shape and throws if used client-side. ----
const yousignProvider = {
  name: 'yousign',
  async createSignatureRequest() {
    throw new Error(
      "Intégration Yousign non activée. La clé API doit être appelée via une Edge Function Supabase (jamais côté client). Voir README §Signature.",
    )
  },
  async getStatus() {
    throw new Error('Intégration Yousign non activée.')
  },
}

export const signatureProvider =
  SIGNATURE_PROVIDER === 'yousign' ? yousignProvider : mockProvider

export const isMockSignature = signatureProvider.name === 'mock'
