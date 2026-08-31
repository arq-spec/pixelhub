import type { Prim, SheetLayout } from '../layout'
import { FONT } from '../sheetSpec'

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** 3 casas bastam: 0,001 mm é muito abaixo da resolução de qualquer saída. */
const n = (v: number) => {
  const r = Math.round(v * 1000) / 1000
  return Object.is(r, -0) ? '0' : String(r)
}

function primToSvg(p: Prim): string {
  switch (p.kind) {
    case 'line': {
      const dash = p.dashed ? ' stroke-dasharray="2.4 2"' : ''
      return `<line x1="${n(p.x1)}" y1="${n(p.y1)}" x2="${n(p.x2)}" y2="${n(p.y2)}" stroke="${p.color}" stroke-width="${n(p.width)}" stroke-linecap="butt"${dash}/>`
    }
    case 'rect': {
      const fill = p.fill ?? 'none'
      const stroke = p.stroke ?? 'none'
      const sw = p.stroke ? ` stroke-width="${n(p.width ?? 0.3)}"` : ''
      const dash = p.dashed ? ' stroke-dasharray="1.4 1.2"' : ''
      const r = p.radius ? ` rx="${n(p.radius)}" ry="${n(p.radius)}"` : ''
      return `<rect x="${n(p.x)}" y="${n(p.y)}" width="${n(p.w)}" height="${n(p.h)}"${r} fill="${fill}" stroke="${stroke}"${sw}${dash}/>`
    }
    case 'text': {
      const anchor = p.anchor && p.anchor !== 'start' ? ` text-anchor="${p.anchor}"` : ''
      const weight = p.bold ? ' font-weight="700"' : ''
      const tracking = p.tracking ? ` letter-spacing="${n(p.tracking)}"` : ''
      return `<text x="${n(p.x)}" y="${n(p.y)}" font-size="${n(p.size)}" fill="${p.color}"${weight}${anchor}${tracking}>${esc(p.text)}</text>`
    }
    case 'image':
      return `<image x="${n(p.x)}" y="${n(p.y)}" width="${n(p.w)}" height="${n(p.h)}" href="${esc(p.href)}" preserveAspectRatio="xMidYMid meet"/>`
  }
}

export interface SvgOptions {
  /** Inclui width/height em mm — necessário para arquivo e para o PDF. */
  physicalSize?: boolean
  /**
   * Família tipográfica. O svg2pdf resolve nomes de fonte base do PDF, então a
   * exportação usa `helvetica` puro em vez da pilha com alternativas.
   */
  fontFamily?: string
}

export function renderSvg(layout: SheetLayout, options: SvgOptions = {}): string {
  const { w, h } = layout.page
  const size = options.physicalSize ? ` width="${w}mm" height="${h}mm"` : ''
  const font = options.fontFamily ?? FONT
  const body = layout.prims.map(primToSvg).join('\n    ')
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"${size} viewBox="0 0 ${w} ${h}" font-family="${esc(font)}">`,
    `  <g shape-rendering="geometricPrecision" text-rendering="geometricPrecision">`,
    `    ${body}`,
    `  </g>`,
    `</svg>`,
  ].join('\n')
}

/** Arquivo .svg autônomo. */
export function renderSvgFile(layout: SheetLayout): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${renderSvg(layout, { physicalSize: true })}`
}
