/** WhatsApp do suporte técnico do sistema (DDI 55 + DDD 21). */
export const WHATSAPP_SUPORTE = '5500000000000'
export const TELEFONE_SUPORTE = '(00) 00000-0000'

/**
 * Link para abrir a conversa de suporte com uma mensagem pronta.
 * Só leva o caminho da tela (sem ids nem dados de paciente — LGPD).
 */
export function linkSuporte(caminho?: string) {
  const tela = caminho ? caminho.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id').split('?')[0] : ''
  const texto = `Olá! Preciso de suporte no sistema Orto Fortino.${tela ? ` Tela: ${tela}` : ''}`
  return `https://wa.me/${WHATSAPP_SUPORTE}?text=${encodeURIComponent(texto)}`
}
