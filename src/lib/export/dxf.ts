import { LAYERS, type Prim, type SheetLayout } from '../layout'

/**
 * Exportação DXF (AutoCAD R12 ASCII) — geometria vetorial em milímetros,
 * pronta para abrir no AutoCAD, BricsCAD, LibreCAD ou QCAD.
 *
 * O R12 é o dialeto mais portátil do formato: qualquer versão do AutoCAD
 * dos últimos 30 anos o lê sem conversão.
 */

/** Índices ACI aproximando as cores da folha. */
const LAYER_COLORS: Record<string, number> = {
  [LAYERS.panel]: 7,
  [LAYERS.modules]: 8,
  [LAYERS.dims]: 3,
  [LAYERS.text]: 7,
  [LAYERS.frame]: 8,
  [LAYERS.brand]: 1,
}

const LAYER_NAMES = Object.keys(LAYER_COLORS)

/** Razão entre a altura de caixa alta da Helvetica e o corpo da fonte. */
const CAP_RATIO = 0.717

const dec = (v: number) => (Math.round(v * 1e6) / 1e6).toFixed(6)

class DxfWriter {
  private out: string[] = []

  pair(code: number | string, value: string | number) {
    this.out.push(String(code), String(value))
    return this
  }

  toString() {
    return `${this.out.join('\r\n')}\r\n`
  }
}

/**
 * DXF R12 não define codificação Unicode; caracteres fora do ASCII vão como
 * escapes \\U+XXXX, que o AutoCAD interpreta de volta como o caractere.
 */
function encodeText(text: string): string {
  let out = ''
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 63
    out += code < 128 ? ch : `\\U+${code.toString(16).toUpperCase().padStart(4, '0')}`
  }
  return out
}

export function renderDxf(layout: SheetLayout): string {
  const { w: pageW, h: pageH } = layout.page
  const d = new DxfWriter()
  /** DXF tem Y para cima; a folha é modelada com Y para baixo. */
  const fy = (y: number) => pageH - y

  const layer = (p: Prim) => p.layer ?? LAYERS.text

  // ------------------------------------------------------------- cabeçalho
  d.pair(0, 'SECTION').pair(2, 'HEADER')
  d.pair(9, '$ACADVER').pair(1, 'AC1009')
  d.pair(9, '$INSUNITS').pair(70, 4) // 4 = milímetros
  d.pair(9, '$EXTMIN').pair(10, dec(0)).pair(20, dec(0)).pair(30, dec(0))
  d.pair(9, '$EXTMAX').pair(10, dec(pageW)).pair(20, dec(pageH)).pair(30, dec(0))
  d.pair(0, 'ENDSEC')

  // ---------------------------------------------------------------- tabelas
  d.pair(0, 'SECTION').pair(2, 'TABLES')

  d.pair(0, 'TABLE').pair(2, 'LTYPE').pair(70, 2)
  d.pair(0, 'LTYPE').pair(2, 'CONTINUOUS').pair(70, 0)
    .pair(3, 'Solid line').pair(72, 65).pair(73, 0).pair(40, dec(0))
  d.pair(0, 'LTYPE').pair(2, 'DASHED').pair(70, 0)
    .pair(3, '__ __ __').pair(72, 65).pair(73, 2).pair(40, dec(4.4))
    .pair(49, dec(2.4)).pair(49, dec(-2))
  d.pair(0, 'ENDTAB')

  d.pair(0, 'TABLE').pair(2, 'LAYER').pair(70, LAYER_NAMES.length)
  for (const name of LAYER_NAMES) {
    d.pair(0, 'LAYER').pair(2, name).pair(70, 0)
      .pair(62, LAYER_COLORS[name]).pair(6, 'CONTINUOUS')
  }
  d.pair(0, 'ENDTAB')

  d.pair(0, 'TABLE').pair(2, 'STYLE').pair(70, 1)
  d.pair(0, 'STYLE').pair(2, 'STANDARD').pair(70, 0)
    .pair(40, dec(0)).pair(41, dec(1)).pair(50, dec(0))
    .pair(71, 0).pair(42, dec(2.5)).pair(3, 'txt').pair(4, '')
  d.pair(0, 'ENDTAB')

  d.pair(0, 'ENDSEC')

  // -------------------------------------------------------------- entidades
  d.pair(0, 'SECTION').pair(2, 'ENTITIES')

  const emitLine = (
    x1: number, y1: number, x2: number, y2: number, lay: string, dashed?: boolean,
  ) => {
    d.pair(0, 'LINE').pair(8, lay)
    if (dashed) d.pair(6, 'DASHED')
    d.pair(10, dec(x1)).pair(20, dec(fy(y1))).pair(30, dec(0))
    d.pair(11, dec(x2)).pair(21, dec(fy(y2))).pair(31, dec(0))
  }

  const emitArc = (cx: number, cy: number, r: number, a0: number, a1: number, lay: string) => {
    d.pair(0, 'ARC').pair(8, lay)
      .pair(10, dec(cx)).pair(20, dec(fy(cy))).pair(30, dec(0))
      .pair(40, dec(r)).pair(50, dec(a0)).pair(51, dec(a1))
  }

  for (const p of layout.prims) {
    const lay = layer(p)
    switch (p.kind) {
      case 'line':
        emitLine(p.x1, p.y1, p.x2, p.y2, lay, p.dashed)
        break

      case 'rect': {
        // Retângulo sem contorno é só preenchimento de tela: não vai para o CAD.
        if (!p.stroke) break
        const { x, y, w, h } = p
        const r = Math.min(p.radius ?? 0, w / 2, h / 2)
        if (r <= 0) {
          emitLine(x, y, x + w, y, lay, p.dashed)
          emitLine(x + w, y, x + w, y + h, lay, p.dashed)
          emitLine(x + w, y + h, x, y + h, lay, p.dashed)
          emitLine(x, y + h, x, y, lay, p.dashed)
        } else {
          // Cantos arredondados: 4 trechos retos + 4 arcos.
          emitLine(x + r, y, x + w - r, y, lay, p.dashed)
          emitLine(x + w, y + r, x + w, y + h - r, lay, p.dashed)
          emitLine(x + w - r, y + h, x + r, y + h, lay, p.dashed)
          emitLine(x, y + h - r, x, y + r, lay, p.dashed)
          // Ângulos em coordenadas DXF (Y para cima, sentido anti-horário).
          emitArc(x + w - r, y + r, r, 0, 90, lay)
          emitArc(x + r, y + r, r, 90, 180, lay)
          emitArc(x + r, y + h - r, r, 180, 270, lay)
          emitArc(x + w - r, y + h - r, r, 270, 360, lay)
        }
        break
      }

      case 'text': {
        if (!p.text) break
        const justify = p.anchor === 'middle' ? 1 : p.anchor === 'end' ? 2 : 0
        d.pair(0, 'TEXT').pair(8, lay)
          .pair(10, dec(p.x)).pair(20, dec(fy(p.y))).pair(30, dec(0))
          .pair(40, dec(p.size * CAP_RATIO))
          .pair(1, encodeText(p.text))
          .pair(50, dec(0))
          .pair(7, 'STANDARD')
          .pair(72, justify)
          .pair(11, dec(p.x)).pair(21, dec(fy(p.y))).pair(31, dec(0))
        break
      }

      case 'poly': {
        // O DXF leva o contorno: preenchimento de tela não vira geometria.
        if (!p.stroke || p.pts.length < 2) break
        for (let i = 0; i < p.pts.length; i++) {
          const a = p.pts[i]
          const b = p.pts[(i + 1) % p.pts.length]
          emitLine(a.x, a.y, b.x, b.y, lay)
        }
        break
      }

      case 'image':
        // Imagens raster não têm equivalente vetorial; o quadro do logotipo
        // é marcado para o desenhista reposicionar a marca no CAD.
        emitLine(p.x, p.y, p.x + p.w, p.y, LAYERS.brand, true)
        emitLine(p.x + p.w, p.y, p.x + p.w, p.y + p.h, LAYERS.brand, true)
        emitLine(p.x + p.w, p.y + p.h, p.x, p.y + p.h, LAYERS.brand, true)
        emitLine(p.x, p.y + p.h, p.x, p.y, LAYERS.brand, true)
        break
    }
  }

  d.pair(0, 'ENDSEC')
  d.pair(0, 'EOF')
  return d.toString()
}
