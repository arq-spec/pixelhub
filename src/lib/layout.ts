import {
  COLORS,
  DIVIDER,
  DRAWING,
  FULL_CELL,
  LEGEND,
  PAGE,
  SCALE_LADDER,
  SIDEBAR,
  SIDEBAR_CX,
  SIDEBAR_W,
  STAMP,
} from './sheetSpec'
import { computeMetrics, moduleEdges, runKinds, type Metrics } from './calc'
import { eventDateLabel, isoToBr, meters, num } from './format'
import { fitSize, textWidth, wrapText } from './measure'
import type { FieldId, PanelConfig, Project, Sheet } from '../types'

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

export interface Cell { x0: number; y0: number; x1: number; y1: number }

export interface SheetLayout {
  page: { w: number; h: number }
  prims: Prim[]
  /** Métricas de cada painel da folha, na ordem. */
  metrics: Metrics[]
  /** Escala escolhida para cada painel. */
  scales: number[]
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

/** Descreve a composição de placas, separando a fileira de preenchimento. */
function modulesLabel(m: Metrics): string {
  if (m.rows.hasFiller) {
    const plate = `${meters(m.fillerSizeMm)}x${meters(m.fillerSizeMm)}m`
    const base = `${m.cols.total}x${m.rows.full} de ${meters(m.cols.runs[0].sizeMm)}x${meters(m.rows.runs[1].sizeMm)}m`
    return `${base} + ${m.fillerCount} de ${plate}`
  }
  const suffix = m.hasCut ? ', c/ recorte' : ''
  return `${m.cols.total}x${m.rows.total} (${m.moduleCount} un.${suffix})`
}

/** Linhas do quadro de dados, como pares rótulo/valor, já filtradas. */
export function specLines(
  sheet: Sheet, _panel: PanelConfig, m: Metrics, scaleDen: number,
): Array<[string, string]> {
  // O nome do painel já encabeça o desenho; aqui a linha é sempre "PAINEL:".
  const all: Array<[FieldId, string, string]> = [
    ['dimensao', 'PAINEL:', `${meters(m.widthMm)}x${meters(m.heightMm)}m`],
    ['pixels', 'PIXELS:', `${m.pixelsW}x${m.pixelsH}p`],
    ['modulos', 'MÓDULOS:', modulesLabel(m)],
    ['area', 'ÁREA TOTAL:', `${num(m.areaM2, 2)} m²`],
    ['peso', 'PESO:', `${trim(m.weightKg, 1)}kg`],
    ['consumo', 'CONSUMO:', `${trim(m.powerKva, 1)}kVa`],
    ['escala', 'ESCALA:', `1:${num(scaleDen, scaleDen % 1 ? 1 : 0)}`],
  ]
  return all.filter(([id]) => sheet.fields[id] !== false).map(([, l, v]) => [l, v])
}

/** Rótulo da folha: numeração manual quando houver, senão a sequência. */
export function sheetNumber(sheet: Sheet, index: number): string {
  const manual = sheet.numberOverride?.trim()
  return manual || String(index + 1).padStart(2, '0')
}

/**
 * Divide a prancha em células, uma por painel.
 * Até 3 painéis ficam lado a lado; acima disso a grade ganha uma segunda fila.
 */
export function panelCells(count: number): Cell[] {
  const cols = count <= 3 ? count : count <= 6 ? 3 : 4
  const rows = Math.ceil(count / cols)
  const totalW = DRAWING.x1 - DRAWING.x0
  const totalH = DRAWING.y1 - DRAWING.y0
  const cw = (totalW - DRAWING.gap * (cols - 1)) / cols
  const ch = (totalH - DRAWING.gap * (rows - 1)) / rows

  const cells: Cell[] = []
  for (let i = 0; i < count; i++) {
    const c = i % cols
    const r = Math.floor(i / cols)
    const x0 = DRAWING.x0 + c * (cw + DRAWING.gap)
    const y0 = DRAWING.y0 + r * (ch + DRAWING.gap)
    cells.push({ x0, y0, x1: x0 + cw, y1: y0 + ch })
  }
  return cells
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Desenha um painel dentro da sua célula e devolve a escala usada. */
function drawPanelCell(
  prims: Prim[], sheet: Sheet, panel: PanelConfig, m: Metrics, cell: Cell,
): number {
  const cw = cell.x1 - cell.x0
  const ch = cell.y1 - cell.y0
  const cx = (cell.x0 + cell.x1) / 2

  // Tipografia proporcional à célula, para a folha com vários painéis
  // continuar legível sem mudar de linguagem visual.
  const k = Math.min(cw / FULL_CELL.w, ch / FULL_CELL.h)
  const titleSize = clamp(DRAWING.titleSize * k, 3.0, DRAWING.titleSize)
  const specsSize = clamp(DRAWING.specsSize * k, 2.1, DRAWING.specsSize)
  const lineH = specsSize * (DRAWING.specsLineHeight / DRAWING.specsSize)
  const titleGap = DRAWING.titleGap * clamp(k, 0.55, 1)
  const drawGap = DRAWING.drawingGap * clamp(k, 0.5, 1)
  const specsGap = DRAWING.specsGap * clamp(k, 0.55, 1)

  activeLayer = LAYERS.text
  const title = panel.name.trim().toUpperCase()
  const titleBaseline = cell.y0 + titleSize
  if (title) {
    prims.push(
      text(cx, titleBaseline, title, fitSize(title, cw, titleSize, true), COLORS.navy, {
        bold: true, anchor: 'middle', tracking: DRAWING.titleTracking * k,
      }),
    )
  }

  // A escala precisa das linhas do quadro, que por sua vez mostram a escala:
  // resolve-se com uma primeira passada só para medir a altura do quadro.
  const probe = specLines(sheet, panel, m, 1)
  const specsLast = cell.y1
  const specsFirst = specsLast - Math.max(0, probe.length - 1) * lineH
  const separatorY = specsFirst - specsGap
  const band = { top: titleBaseline + titleGap, bottom: separatorY - drawGap }

  const dimPad = sheet.showDimensions ? 12 * clamp(k, 0.6, 1) : 0
  const reserve = sheet.showDimensions ? 15 * clamp(k, 0.6, 1) : 0
  const availW = cw - dimPad * 2
  const availH = band.bottom - band.top - reserve

  const den = pickScale(
    m.widthMm, m.heightMm,
    availW * DRAWING.fillFactor, availH * DRAWING.fillFactor,
  )
  const w = m.widthMm / den
  const h = m.heightMm / den
  const x = cx - w / 2
  const y = band.top + Math.max(0, (availH - h) / 2)

  const colEdges = moduleEdges(m.cols).map((e) => x + e / den)
  const rowEdges = moduleEdges(m.rows).map((e) => y + e / den)
  const colKinds = runKinds(m.cols)
  const rowKinds = runKinds(m.rows)

  activeLayer = LAYERS.modules
  for (let r = 0; r < rowEdges.length - 1; r++) {
    for (let c = 0; c < colEdges.length - 1; c++) {
      // Só o recorte sai tracejado; a placa de preenchimento é uma peça real.
      const isCut = colKinds[c] === 'cut' || rowKinds[r] === 'cut'
      prims.push({
        kind: 'rect', layer: LAYERS.modules,
        x: colEdges[c], y: rowEdges[r],
        w: colEdges[c + 1] - colEdges[c],
        h: rowEdges[r + 1] - rowEdges[r],
        fill: COLORS.moduleFill,
        stroke: COLORS.moduleStroke,
        width: 0.3,
        dashed: isCut,
      })
    }
  }

  prims.push({
    kind: 'rect', layer: LAYERS.panel, x, y, w, h,
    stroke: COLORS.moduleStroke, width: 0.55,
  })

  if (sheet.showDimensions) {
    activeLayer = LAYERS.dims
    const off = 6.5 * clamp(k, 0.6, 1)
    const tick = 1.5
    const dimSize = clamp(2.6 * k, 1.9, 2.6)
    const dy = y + h + off
    prims.push(line(x, dy, x + w, dy, COLORS.dim, 0.2))
    prims.push(line(x, dy - tick, x, dy + tick, COLORS.dim, 0.2))
    prims.push(line(x + w, dy - tick, x + w, dy + tick, COLORS.dim, 0.2))
    prims.push(text(cx, dy - 1.3, `${meters(m.widthMm)}m`, dimSize, COLORS.dim, { anchor: 'middle' }))

    const dx = x - off
    prims.push(line(dx, y, dx, y + h, COLORS.dim, 0.2))
    prims.push(line(dx - tick, y, dx + tick, y, COLORS.dim, 0.2))
    prims.push(line(dx - tick, y + h, dx + tick, y + h, COLORS.dim, 0.2))
    // O texto assenta na linha de base: o deslocamento centra a cota no vão.
    prims.push(
      text(dx - 1.3, y + h / 2 + dimSize * 0.36, `${meters(m.heightMm)}m`, dimSize, COLORS.dim, {
        anchor: 'end',
      }),
    )
  }

  activeLayer = LAYERS.text
  const specs = specLines(sheet, panel, m, den)
  if (specs.length) {
    const gap = specsSize * 0.28
    const widths = specs.map(
      ([l, v]) => textWidth(l, specsSize, true) + gap + textWidth(v, specsSize, false),
    )
    // O separador acompanha a linha mais larga do quadro, com uma folga.
    const halfWidth = Math.min(Math.max(...widths) / 2 + 4, cw / 2)
    prims.push(
      line(cx - halfWidth, separatorY, cx + halfWidth, separatorY, COLORS.dash, 0.3, true),
    )
    specs.forEach(([label, value], i) => {
      const ly = specsFirst + i * lineH
      const startX = cx - widths[i] / 2
      prims.push(text(startX, ly, label, specsSize, COLORS.navy, { bold: true }))
      prims.push(
        text(startX + textWidth(label, specsSize, true) + gap, ly, value, specsSize, COLORS.slateText),
      )
    })
  }

  return den
}

export function buildSheetLayout(project: Project, sheet: Sheet, index: number): SheetLayout {
  const prims: Prim[] = []
  const panels = sheet.panels.length ? sheet.panels : []
  const metrics = panels.map(computeMetrics)

  activeLayer = LAYERS.frame
  prims.push({ kind: 'rect', layer: LAYERS.frame, x: 0, y: 0, w: PAGE.w, h: PAGE.h, fill: '#ffffff' })

  // ---------------------------------------------------------------- prancha
  const cells = panelCells(panels.length)
  const scales = panels.map((panel, i) =>
    drawPanelCell(prims, sheet, panel, metrics[i], cells[i]),
  )

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
    prims.push(
      text(SIDEBAR_CX, STAMP.logoBottom - 3, brand, fitSize(brand, SIDEBAR_W, 9, true), COLORS.accent, {
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
    prims.push(
      text(STAMP.colL, STAMP.eventBaseline, eventName, fitSize(eventName, contentW, STAMP.eventSize, true), COLORS.navyDeep, {
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

  return { page: { w: PAGE.w, h: PAGE.h }, prims, metrics, scales }
}
