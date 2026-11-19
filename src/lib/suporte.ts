/** WhatsApp do suporte técnico (DDI + DDD + número, só dígitos), vindo do ambiente. */
const WHATSAPP_SUPORTE = (import.meta.env.VITE_WHATSAPP_SUPORTE ?? '').replace(/\D/g, '')

/**
 * Link para abrir a conversa de suporte com uma mensagem pronta.
 * Só leva o caminho da tela (sem ids nem dados de paciente — LGPD).
 */
export function linkSuporte(caminho?: string) {
  const tela = caminho ? caminho.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id').split('?')[0] : ''
  const texto = `Olá! Preciso de suporte no sistema Orto Fortino.${tela ? ` Tela: ${tela}` : ''}`
  return `https://wa.me/${WHATSAPP_SUPORTE}?text=${encodeURIComponent(texto)}`
}
