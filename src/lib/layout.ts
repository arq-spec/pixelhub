import {
  COLORS,
  DIVIDER,
  DRAWING,
  DRAWING_CX,
  LEGEND,
  PAGE,
  SCALE_LADDER,
  SIDEBAR,
  SIDEBAR_CX,
  SIDEBAR_W,
  STAMP,
} from './sheetSpec'
import { computeMetrics, moduleEdges, type Metrics } from './calc'
import { eventDateLabel, isoToBr, meters, num } from './format'
import { fitSize, textWidth, wrapText } from './measure'
import type { Project, Sheet } from '../types'

export type Anchor = 'start' | 'middle' | 'end'

interface HasLayer {
  /** Camada de destino na exportação DXF. */
  layer?: string
}

export interface LineP extends HasLayer {
  kind: 'line'
  x1: number; y1: number; x2: number; y2: number
  color: string; width: number; dashed?: boolean
}
export interface RectP extends HasLayer {
  kind: 'rect'
  x: number; y: number; w: number; h: number
  fill?: string; stroke?: string; width?: number; dashed?: boolean; radius?: number
}
export interface TextP extends HasLayer {
  kind: 'text'
  x: number; y: number; text: string
  size: number; color: string; bold?: boolean; anchor?: Anchor; tracking?: number
}
export interface ImageP extends HasLayer {
  kind: 'image'
  x: number; y: number; w: number; h: number; href: string
}
export type Prim = LineP | RectP | TextP | ImageP

export const LAYERS = {
  panel: 'PH-PAINEL',
  modules: 'PH-MODULOS',
  dims: 'PH-COTAS',
  text: 'PH-TEXTO',
  frame: 'PH-CARIMBO',
  brand: 'PH-LOGO',
} as const

export interface SheetLayout {
  page: { w: number; h: number }
  prims: Prim[]
  metrics: Metrics
  scaleDenominator: number
}

/**
 * Camada corrente. As primitivas são criadas em sequência dentro de
 * `buildSheetLayout`, então basta trocar esta variável ao entrar em cada
 * bloco do desenho para que a exportação DXF saia organizada por camada.
 */
let activeLayer: string = LAYERS.text

const line = (
  x1: number, y1: number, x2: number, y2: number,
  color: string, width: number, dashed = false,
): LineP => ({ kind: 'line', x1, y1, x2, y2, color, width, dashed, layer: activeLayer })

const text = (
  x: number, y: number, value: string, size: number, color: string,
  opts: { bold?: boolean; anchor?: Anchor; tracking?: number } = {},
): TextP => ({ kind: 'text', x, y, text: value, size, color, layer: activeLayer, ...opts })

/** Menor escala normalizada que acomoda o painel na área disponível. */
export function pickScale(widthMm: number, heightMm: number, availW: number, availH: number): number {
  const needed = Math.max(widthMm / Math.max(availW, 1), heightMm / Math.max(availH, 1))
  for (const s of SCALE_LADDER) if (s >= needed) return s
  return SCALE_LADDER[SCALE_LADDER.length - 1]
}

/** kg e kVA saem sem casa decimal quando o valor é inteiro, como no modelo. */
function trim(value: number, decimals: number): string {
  const rounded = Number(value.toFixed(decimals))
  return Number.isInteger(rounded) ? num(rounded, 0) : num(rounded, decimals)
}

/** Linhas do quadro de dados, como pares rótulo/valor. */
export function specLines(sheet: Sheet, m: Metrics): Array<[string, string]> {
  const name = sheet.panel.name.trim() || 'PAINEL'
  const modules = m.hasPartial
    ? `${m.cols.total}x${m.rows.total} (${m.moduleCount} un., c/ recorte)`
    : `${m.cols.total}x${m.rows.total} (${m.moduleCount} un.)`
  return [
    [`${name}:`, `${meters(m.widthMm)}x${meters(m.heightMm)}m`],
    ['PIXELS:', `${m.pixelsW}x${m.pixelsH}p`],
    ['MÓDULOS:', modules],
    ['ÁREA TOTAL:', `${num(m.areaM2, 2)} m²`],
    ['PESO:', `${trim(m.weightKg, 1)}kg`],
    ['CONSUMO:', `${trim(m.powerKva, 1)}kVa`],
  ]
}

/** Rótulo da folha: numeração manual quando houver, senão a sequência. */
export function sheetNumber(sheet: Sheet, index: number): string {
  const manual = sheet.numberOverride?.trim()
  return manual || String(index + 1).padStart(2, '0')
}

function drawPanel(prims: Prim[], sheet: Sheet, m: Metrics, band: { top: number; bottom: number }) {
  // Com cotas, a faixa inferior da banda fica reservada para a linha de cota
  // e a nota de escala, e as laterais abrem espaço para a cota de altura.
  const pad = sheet.showDimensions ? 13 : 0
  const reserve = sheet.showDimensions ? 16 : 0
  const availW = DRAWING.x1 - DRAWING.x0 - pad * 2
  const availH = band.bottom - band.top - reserve

  const den = sheet.scaleDenominator ?? pickScale(m.widthMm, m.heightMm, availW, availH)
  const w = m.widthMm / den
  const h = m.heightMm / den
  const x = DRAWING_CX - w / 2
  const y = band.top + Math.max(0, (availH - h) / 2)

  const colEdges = moduleEdges(m.cols).map((e) => x + e / den)
  const rowEdges = moduleEdges(m.rows).map((e) => y + e / den)

  // Um retângulo por módulo: o parcial (recorte de gabinete) sai tracejado.
  for (let r = 0; r < rowEdges.length - 1; r++) {
    for (let c = 0; c < colEdges.length - 1; c++) {
      const partial =
        (m.cols.remainderMm > 0 && c === colEdges.length - 2) ||
        (m.rows.remainderMm > 0 && r === rowEdges.length - 2)
      prims.push({
        kind: 'rect',
        layer: LAYERS.modules,
        x: colEdges[c],
        y: rowEdges[r],
        w: colEdges[c + 1] - colEdges[c],
        h: rowEdges[r + 1] - rowEdges[r],
        fill: COLORS.moduleFill,
        stroke: COLORS.moduleStroke,
        width: 0.3,
        dashed: partial,
      })
    }
  }

  // Contorno externo mais forte, como no modelo.
  prims.push({
    kind: 'rect', layer: LAYERS.panel, x, y, w, h,
    stroke: COLORS.moduleStroke, width: 0.55,
  })

  if (sheet.showDimensions) {
    const off = 7
    const tick = 1.6
    // Cota horizontal, abaixo do desenho.
    const dy = y + h + off
    prims.push(line(x, dy, x + w, dy, COLORS.dim, 0.2))
    prims.push(line(x, dy - tick, x, dy + tick, COLORS.dim, 0.2))
    prims.push(line(x + w, dy - tick, x + w, dy + tick, COLORS.dim, 0.2))
    prims.push(
      text(DRAWING_CX, dy - 1.4, `${meters(m.widthMm)}m`, 2.6, COLORS.dim, { anchor: 'middle' }),
    )
    // Cota vertical, à esquerda.
    const dx = x - off
    prims.push(line(dx, y, dx, y + h, COLORS.dim, 0.2))
    prims.push(line(dx - tick, y, dx + tick, y, COLORS.dim, 0.2))
    prims.push(line(dx - tick, y + h, dx + tick, y + h, COLORS.dim, 0.2))
    // O texto assenta na linha de base: o deslocamento centra a cota no vão.
    prims.push(
      text(dx - 1.4, y + h / 2 + 0.95, `${meters(m.heightMm)}m`, 2.6, COLORS.dim, { anchor: 'end' }),
    )
  }

  // Com as cotas ligadas, a linha de cota ocupa a faixa logo abaixo do
  // desenho; a nota de escala desce para não escrever por cima dela.
  return { den, gridBottom: y + h, noteOffset: sheet.showDimensions ? 14 : 6.5 }
}

export function buildSheetLayout(project: Project, sheet: Sheet, index: number): SheetLayout {
  const m = computeMetrics(sheet.panel)
  const prims: Prim[] = []

  activeLayer = LAYERS.frame
  prims.push({ kind: 'rect', layer: LAYERS.frame, x: 0, y: 0, w: PAGE.w, h: PAGE.h, fill: '#ffffff' })

  // ---------------------------------------------------------------- prancha
  activeLayer = LAYERS.text
  const title = sheet.panel.name.trim().toUpperCase()
  if (title) {
    const size = fitSize(title, DRAWING.x1 - DRAWING.x0, DRAWING.titleSize, true)
    prims.push(
      text(DRAWING_CX, DRAWING.titleBaseline, title, size, COLORS.navy, {
        bold: true, anchor: 'middle', tracking: DRAWING.titleTracking,
      }),
    )
  }

  const specs = specLines(sheet, m)
  const specsFirstBaseline =
    DRAWING.specsLastBaseline - (specs.length - 1) * DRAWING.specsLineHeight
  const separatorY = specsFirstBaseline - DRAWING.specsGap
  const band = { top: DRAWING.gridTop, bottom: separatorY - DRAWING.drawingGap }

  activeLayer = LAYERS.dims
  const { den, gridBottom, noteOffset } = drawPanel(prims, sheet, m, band)
  activeLayer = LAYERS.text

  prims.push(
    text(DRAWING_CX, gridBottom + noteOffset, `ESC. 1:${num(den, den % 1 ? 1 : 0)}`, DRAWING.scaleNoteSize, COLORS.slate, {
      anchor: 'middle', tracking: 0.15,
    }),
  )

  prims.push(
    line(
      DRAWING_CX - DRAWING.separatorHalfWidth, separatorY,
      DRAWING_CX + DRAWING.separatorHalfWidth, separatorY,
      COLORS.dash, 0.3, true,
    ),
  )

  // Cada linha do quadro é centralizada como um bloco rótulo+valor.
  specs.forEach(([label, value], i) => {
    const y = specsFirstBaseline + i * DRAWING.specsLineHeight
    const gap = DRAWING.specsSize * 0.28
    const lw = textWidth(label, DRAWING.specsSize, true)
    const vw = textWidth(value, DRAWING.specsSize, false)
    const startX = DRAWING_CX - (lw + gap + vw) / 2
    prims.push(text(startX, y, label, DRAWING.specsSize, COLORS.navy, { bold: true }))
    prims.push(text(startX + lw + gap, y, value, DRAWING.specsSize, COLORS.slateText))
  })

  // ---------------------------------------------------------------- lateral
  activeLayer = LAYERS.frame
  prims.push(line(DIVIDER.x, DIVIDER.y0, DIVIDER.x, DIVIDER.y1, COLORS.ink, DIVIDER.width))

  activeLayer = LAYERS.text
  prims.push(
    text(SIDEBAR_CX, LEGEND.titleBaseline, 'LEGENDAS', LEGEND.titleSize, COLORS.ink, {
      bold: true, anchor: 'middle', tracking: LEGEND.titleTracking,
    }),
  )
  prims.push({
    kind: 'line', layer: LAYERS.frame,
    x1: SIDEBAR.x0, y1: LEGEND.ruleY, x2: SIDEBAR.x1, y2: LEGEND.ruleY,
    color: COLORS.ink, width: LEGEND.ruleWidth,
  })

  const notes = sheet.notes.filter((n) => n.trim().length > 0)
  if (notes.length) {
    prims.push(
      text(SIDEBAR.x0, LEGEND.obsBaseline, 'OBSERVAÇÕES:', LEGEND.obsSize, COLORS.slate, {
        bold: true, tracking: LEGEND.obsTracking,
      }),
    )
    const innerW = SIDEBAR_W - LEGEND.boxPadX * 2
    // Observação longa quebra em várias linhas dentro da própria caixa.
    const rendered = notes.flatMap((n) => wrapText(n.trim(), innerW, LEGEND.itemSize))
    const boxH =
      LEGEND.firstBaseline + (rendered.length - 1) * LEGEND.lineHeight + LEGEND.bottomPad
    prims.push({
      kind: 'rect', layer: LAYERS.frame,
      x: SIDEBAR.x0, y: LEGEND.boxTop, w: SIDEBAR_W, h: boxH,
      stroke: COLORS.dash, width: 0.25, dashed: true,
    })
    rendered.forEach((item, i) => {
      prims.push(
        text(
          SIDEBAR.x0 + LEGEND.boxPadX,
          LEGEND.boxTop + LEGEND.firstBaseline + i * LEGEND.lineHeight,
          item, LEGEND.itemSize, COLORS.slateText,
        ),
      )
    })
  }

  // ------------------------------------------------------- logotipo/carimbo
  prims.push({
    kind: 'line', layer: LAYERS.frame,
    x1: SIDEBAR.x0, y1: STAMP.ruleY, x2: SIDEBAR.x1, y2: STAMP.ruleY,
    color: COLORS.ink, width: STAMP.ruleWidth,
  })

  const logoH = STAMP.logoBottom - STAMP.logoTop
  if (project.brand.logoDataUri) {
    prims.push({
      kind: 'image', layer: LAYERS.brand,
      x: SIDEBAR.x0, y: STAMP.logoTop, w: SIDEBAR_W, h: logoH,
      href: project.brand.logoDataUri,
    })
  } else if (project.brand.name.trim()) {
    const brand = project.brand.name.trim()
    const size = fitSize(brand, SIDEBAR_W, 6.4, true)
    prims.push(
      text(SIDEBAR_CX, STAMP.logoBottom - 1.2, brand, size, COLORS.accent, {
        bold: true, anchor: 'middle',
      }),
    )
  }

  activeLayer = LAYERS.frame
  prims.push({
    kind: 'rect', layer: LAYERS.frame,
    x: STAMP.boxX0, y: STAMP.boxTop,
    w: STAMP.boxX1 - STAMP.boxX0, h: STAMP.boxBottom - STAMP.boxTop,
    stroke: COLORS.boxStroke, width: 0.35, radius: STAMP.radius,
  })

  activeLayer = LAYERS.text
  const contentW = STAMP.colREnd - STAMP.colL
  const eventName = project.eventName.trim().toUpperCase()
  if (eventName) {
    const size = fitSize(eventName, contentW, STAMP.eventSize, true)
    prims.push(
      text(STAMP.colL, STAMP.eventBaseline, eventName, size, COLORS.navyDeep, {
        bold: true, tracking: 0.12,
      }),
    )
  }
  prims.push({ ...line(STAMP.colL, STAMP.rule1Y, STAMP.colREnd, STAMP.rule1Y, COLORS.hair, STAMP.hairWidth), layer: LAYERS.frame })

  const field = (x: number, labelY: number, valueY: number, label: string, value: string, maxW: number) => {
    prims.push(
      text(x, labelY, label, STAMP.labelSize, COLORS.label, {
        bold: true, tracking: STAMP.labelTracking,
      }),
    )
    if (value) {
      prims.push(
        text(x, valueY, value, fitSize(value, maxW, STAMP.valueSize, true), COLORS.navyDeep, {
          bold: true,
        }),
      )
    }
  }

  field(
    STAMP.colL, STAMP.titleLabelBaseline, STAMP.titleValueBaseline,
    'TÍTULO DA FOLHA', sheet.title.trim().toUpperCase(), contentW,
  )
  prims.push({ ...line(STAMP.colL, STAMP.rule2Y, STAMP.colREnd, STAMP.rule2Y, COLORS.hair, STAMP.hairWidth), layer: LAYERS.frame })

  const colW = STAMP.colLEnd - STAMP.colL
  field(
    STAMP.colL, STAMP.row1LabelBaseline, STAMP.row1ValueBaseline,
    'DESENHISTA', project.desenhista.trim().toUpperCase(), colW,
  )
  field(
    STAMP.colR, STAMP.row1LabelBaseline, STAMP.row1ValueBaseline,
    'DATA EVENTO', eventDateLabel(project.eventDate), colW,
  )
  prims.push({ ...line(STAMP.colL, STAMP.rule3Y, STAMP.colLEnd, STAMP.rule3Y, COLORS.hair, STAMP.hairWidth), layer: LAYERS.frame })
  prims.push({ ...line(STAMP.colR, STAMP.rule3Y, STAMP.colREnd, STAMP.rule3Y, COLORS.hair, STAMP.hairWidth), layer: LAYERS.frame })

  field(
    STAMP.colL, STAMP.row2LabelBaseline, STAMP.row2ValueBaseline,
    'EMISSÃO', isoToBr(project.issueDate), colW,
  )
  field(
    STAMP.colR, STAMP.row2LabelBaseline, STAMP.row2ValueBaseline,
    'FOLHA', sheetNumber(sheet, index), colW,
  )

  return { page: { w: PAGE.w, h: PAGE.h }, prims, metrics: m, scaleDenominator: den }
}
