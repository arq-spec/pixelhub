/**
 * Larguras de avanço da Helvetica / Helvetica-Bold (unidades AFM, em 1/1000 em).
 *
 * O layout precisa medir texto para centralizar linhas antes de existir um DOM
 * — o mesmo cálculo alimenta a tela, o PDF e o DXF. Como todo o documento usa
 * Helvetica (fonte base do PDF), a tabela abaixo dá o resultado exato.
 */

const REGULAR = ' 278!278"355#556$556%889&667\'191(333)333*389+584,278-333.278/278'
const DIGITS = 556

function buildTable(spec: string, letters: Record<string, number>): Record<string, number> {
  const table: Record<string, number> = {}
  const re = /(.)(\d{3})/g
  let m: RegExpExecArray | null
  while ((m = re.exec(spec))) table[m[1]] = Number(m[2])
  for (const d of '0123456789') table[d] = DIGITS
  Object.assign(table, letters)
  return table
}

const HELVETICA = buildTable(REGULAR, {
  ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556, '@': 1015,
  A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278,
  J: 500, K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722,
  S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  '[': 278, '\\': 278, ']': 278, '^': 469, _: 556, '`': 333,
  a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222,
  j: 222, k: 500, l: 222, m: 833, n: 556, o: 556, p: 556, q: 556, r: 333,
  s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500, z: 500,
  '{': 334, '|': 260, '}': 334, '~': 584, '²': 365, '°': 400, '–': 556, '—': 1000,
})

const HELVETICA_BOLD = buildTable(REGULAR, {
  '!': 333, '"': 474, "'": 238, ':': 333, ';': 333, '?': 611, '@': 975,
  '&': 722,
  A: 722, B: 722, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278,
  J: 556, K: 722, L: 611, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722,
  S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  '[': 333, '\\': 278, ']': 333, '^': 584, _: 556, '`': 333,
  a: 556, b: 611, c: 556, d: 611, e: 556, f: 333, g: 611, h: 611, i: 278,
  j: 278, k: 556, l: 278, m: 889, n: 611, o: 611, p: 611, q: 611, r: 389,
  s: 556, t: 333, u: 611, v: 556, w: 778, x: 556, y: 556, z: 500,
  '{': 389, '|': 280, '}': 389, '~': 584, '²': 365, '°': 400, '–': 556, '—': 1000,
})

/** Acentuadas avançam como a letra base na Helvetica. */
const stripAccents = (text: string) =>
  text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/**
 * Largura do texto em mm.
 * `tracking` é o espaçamento extra entre caracteres, também em mm.
 */
export function textWidth(text: string, sizeMm: number, bold = false, tracking = 0): number {
  const table = bold ? HELVETICA_BOLD : HELVETICA
  const plain = stripAccents(text)
  let units = 0
  for (const ch of plain) units += table[ch] ?? 556
  const extra = plain.length > 1 ? (plain.length - 1) * tracking : 0
  return (units / 1000) * sizeMm + extra
}

/** Quebra o texto em linhas que caibam em `maxWidth` mm. */
export function wrapText(
  text: string,
  maxWidth: number,
  sizeMm: number,
  bold = false,
): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']
  const lines: string[] = []
  let line = words[0]
  for (let i = 1; i < words.length; i++) {
    const candidate = `${line} ${words[i]}`
    if (textWidth(candidate, sizeMm, bold) <= maxWidth) line = candidate
    else {
      lines.push(line)
      line = words[i]
    }
  }
  lines.push(line)
  return lines
}

/** Reduz o corpo do texto até caber em `maxWidth`, respeitando um mínimo. */
export function fitSize(
  text: string,
  maxWidth: number,
  sizeMm: number,
  bold = false,
  minSize = 1.6,
): number {
  const w = textWidth(text, sizeMm, bold)
  if (w <= maxWidth || w === 0) return sizeMm
  return Math.max(minSize, (sizeMm * maxWidth) / w)
}
