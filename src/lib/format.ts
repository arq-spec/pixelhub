/** Formata número no padrão pt-BR (vírgula decimal). */
export function num(value: number, decimals = 2): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/** Metros com 2 casas: 0,96 */
export const meters = (mm: number) => num(mm / 1000, 2)

/** Converte "yyyy-mm-dd" em "dd/mm/aaaa". */
export function isoToBr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!m) return ''
  return `${m[3]}/${m[2]}/${m[1]}`
}

/**
 * Data do evento no carimbo. A ausência de data é intencionalmente visível:
 * a folha sai com "A DEFINIR" em vez de um campo vazio.
 */
export const PLACEHOLDER_DATE = 'A DEFINIR'

export function eventDateLabel(iso: string): string {
  return isoToBr(iso) || PLACEHOLDER_DATE
}

export function todayIso(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Numeração automática: 01, 02, ... 10, 11 */
export const autoNumber = (index: number) => String(index + 1).padStart(2, '0')

/** Remove acentos e caracteres inválidos para uso em nome de arquivo. */
export function slug(text: string, fallback = 'folha'): string {
  const s = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase()
  return s || fallback
}
