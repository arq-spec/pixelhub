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
import {
  cellKey, cellRects, computeMetrics, derivedRegions, hasPlate, outlineOf,
  regionMetrics, runKinds, type Metrics,
} from './calc'
import { sheetPanels } from './store'
import { eventDateLabel, isoToBr, meters, num } from './format'
import { fitSize, textWidth, wrapText } from './measure'
import type { FieldId, PanelConfig, Project, Rig, Sheet } from '../types'
import { rigBounds, rigDimensions, rigFaces } from './rigScene'
import { faceBounds, project as project3d, projectFaces, VIEWS, VIEW_LABELS } from './scene3d'

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
export interface PolyP extends HasLayer {
  kind: 'poly'
  pts: Array<{ x: number; y: number }>
  fill?: string
  stroke?: string
  width?: number
}
export interface ImageP extends HasLayer {
  kind: 'image'
  x: number; y: number; w: number; h: number; href: string
}
export type Prim = LineP | RectP | TextP | PolyP | ImageP

export const LAYERS = {
  panel: 'PH-PAINEL',
  modules: 'PH-MODULOS',
  dims: 'PH-COTAS',
  text: 'PH-TEXTO',
  frame: 'PH-CARIMBO',
  brand: 'PH-LOGO',
  rig: 'PH-MONTAGEM',
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

/** Versão clara da cor, para preencher a placa sem apagar o traço por cima. */
export function tint(hex: string, amount = 0.86): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return COLORS.moduleFill
  const n = parseInt(m[1], 16)
  const mix = (c: number) => Math.round(c + (255 - c) * amount)
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map((c) => mix(c).toString(16).padStart(2, '0'))
    .join('')}`
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
  sheet: Sheet, panel: PanelConfig, m: Metrics, scaleDen: number,
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
  const lines = all
    .filter(([id]) => sheet.fields[id] !== false)
    .map(([, l, v]) => [l, v] as [string, string])

  const regions = derivedRegions(panel, m)
  // Painel sem divisão tem uma "parte" só, que é ele inteiro: repetir a
  // medida logo abaixo da linha PAINEL não informa nada.
  if (sheet.fields.reparticoes !== false && regions.length > 1) {
    for (const region of regions) {
      const rm = regionMetrics(m, region)
      if (!rm) continue
      lines.push([
        `${region.name.trim().toUpperCase() || 'PARTE'}:`,
        `${meters(rm.widthMm)}x${meters(rm.heightMm)}m · ${rm.pixelsW}x${rm.pixelsH}p`,
      ])
    }
  }
  return lines
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
  const specsSize = clamp(DRAWING.specsSize * k, 2.9, DRAWING.specsSize)
  const lineH = specsSize * (DRAWING.specsLineHeight / DRAWING.specsSize)
  const titleGap = DRAWING.titleGap * clamp(k, 0.55, 1)
  const drawGap = DRAWING.drawingGap * clamp(k, 0.5, 1)
  const specsGap = DRAWING.specsGap * clamp(k, 0.55, 1)

  const title = panel.name.trim().toUpperCase()

  // A escala precisa das linhas do quadro, que por sua vez mostram a escala:
  // resolve-se com uma primeira passada só para medir a altura do quadro.
  const probe = specLines(sheet, panel, m, 1)
  const specsH = Math.max(0, probe.length - 1) * lineH

  const dimPad = sheet.showDimensions ? 12 * clamp(k, 0.6, 1) : 0
  // Espaço da linha de cota horizontal, entre o desenho e o separador.
  const dimSpace = sheet.showDimensions ? 10 * clamp(k, 0.6, 1) : 0

  const headH = title ? titleSize + titleGap : 0
  const tailH = dimSpace + drawGap + specsGap + specsH
  const availW = cw - dimPad * 2
  const availH = ch - headH - tailH

  const den = pickScale(
    m.widthMm, m.heightMm,
    availW * DRAWING.fillFactor, availH * DRAWING.fillFactor,
  )
  const w = m.widthMm / den
  const h = m.heightMm / den

  // Título, desenho, separador e quadro formam um bloco contínuo, centralizado
  // como uma peça só na célula: o quadro acompanha a base do desenho e o
  // título fica preso ao painel a que se refere.
  const groupH = headH + h + tailH
  const groupTop = cell.y0 + Math.max(0, (ch - groupH) / 2)
  const x = cx - w / 2
  const y = groupTop + headH
  const separatorY = y + h + dimSpace + drawGap
  const specsFirst = separatorY + specsGap

  activeLayer = LAYERS.text
  if (title) {
    prims.push(
      text(cx, groupTop + titleSize, title, fitSize(title, cw, titleSize, true), COLORS.navy, {
        bold: true, anchor: 'middle', tracking: DRAWING.titleTracking * k,
      }),
    )
  }

  const colKinds = runKinds(m.cols)
  const rowKinds = runKinds(m.rows)
  /** mm do painel -> mm da folha. */
  const px = (mm: number) => x + mm / den
  const py = (mm: number) => y + mm / den

  // Cor de fundo de cada posição: a da repartição, senão a do painel.
  const regions = derivedRegions(panel, m)
  const regionOf = new Map<string, string>()
  for (const region of regions) {
    if (!region.color) continue
    for (const key of region.cells) regionOf.set(key, region.color)
  }
  const fillFor = (c: number, r: number) => {
    const color = regionOf.get(cellKey(c, r)) ?? panel.color
    return color ? tint(color) : COLORS.moduleFill
  }

  activeLayer = LAYERS.modules
  for (const cell of cellRects(m, (c, r) => hasPlate(panel, c, r))) {
    // Só o recorte sai tracejado; a placa de preenchimento é uma peça real.
    const isCut = colKinds[cell.col] === 'cut' || rowKinds[cell.row] === 'cut'
    prims.push({
      kind: 'rect', layer: LAYERS.modules,
      x: px(cell.x0), y: py(cell.y0),
      w: (cell.x1 - cell.x0) / den, h: (cell.y1 - cell.y0) / den,
      fill: fillFor(cell.col, cell.row),
      stroke: COLORS.moduleStroke,
      width: 0.3,
      dashed: isCut,
    })
  }

  // O contorno acompanha a forma real: num pórtico ele desenha o vão.
  activeLayer = LAYERS.panel
  const outlineColor = panel.color ?? COLORS.moduleStroke
  for (const seg of outlineOf(m, (c, r) => hasPlate(panel, c, r))) {
    prims.push({
      kind: 'line', layer: LAYERS.panel,
      x1: px(seg.x1), y1: py(seg.y1), x2: px(seg.x2), y2: py(seg.y2),
      color: outlineColor, width: 0.55,
    })
  }

  // Cada repartição é delimitada pelo seu próprio tracejado.
  for (const region of regions) {
    const set = new Set(region.cells)
    const inside = (c: number, r: number) =>
      set.has(cellKey(c, r)) && hasPlate(panel, c, r)
    // Sem cor atribuída, a divisão sai no traço neutro do desenho.
    const divider = region.color ?? COLORS.navy
    for (const seg of outlineOf(m, inside)) {
      prims.push({
        kind: 'line', layer: LAYERS.panel,
        x1: px(seg.x1), y1: py(seg.y1), x2: px(seg.x2), y2: py(seg.y2),
        color: divider, width: 0.45, dashed: true,
      })
    }
    const rm = regionMetrics(m, region)
    const label = region.name.trim().toUpperCase()
    // Uma repartição só, ou seja, painel sem divisão: não precisa de etiqueta.
    if (rm && label && regions.length > 1) {
      // Etiqueta no canto superior esquerdo da envoltória da repartição.
      const bounds = [...set].map((key) => key.split(',').map(Number))
      const c0 = Math.min(...bounds.map((b) => b[0]))
      const r0 = Math.min(...bounds.map((b) => b[1]))
      prims.push(
        text(
          px(m.colEdgesMm[c0]) + 1.2,
          py(m.rowEdgesMm[r0]) + 3.4 * clamp(k, 0.7, 1),
          label,
          clamp(2.8 * k, 1.9, 2.8),
          divider,
          { bold: true },
        ),
      )
    }
  }

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

/** Desenha a projeção de uma montagem dentro da sua célula. */
function drawRigCell(prims: Prim[], project: Project, rig: Rig, cell: Cell) {
  const cw = cell.x1 - cell.x0
  const ch = cell.y1 - cell.y0
  const cx = (cell.x0 + cell.x1) / 2

  const k = Math.min(cw / FULL_CELL.w, ch / FULL_CELL.h)
  const titleSize = clamp(DRAWING.titleSize * k, 3.0, DRAWING.titleSize)
  const specsSize = clamp(DRAWING.specsSize * k, 2.9, DRAWING.specsSize)
  const lineH = specsSize * (DRAWING.specsLineHeight / DRAWING.specsSize)

  const faces = rigFaces(project, rig)
  const projected = projectFaces(faces, VIEWS[rig.view])
  const dims = rigBounds(faces)

  const bounds = faceBounds(projected)

  /**
   * Cotas já resolvidas: para cada uma, o lado do deslocamento é escolhido
   * pelo que afasta a linha do centro do desenho. O mesmo deslocamento cai
   * sobre a peça numa vista e fora dela noutra, então decidir por projeção
   * vale para as quatro.
   */
  const cam = VIEWS[rig.view]
  const center = { x: (bounds.x0 + bounds.x1) / 2, y: (bounds.y0 + bounds.y1) / 2 }
  const dimLines = rig.showDimensions
    ? rigDimensions(project, rig).map((d) => {
        const mid = { x: (d.a.x + d.b.x) / 2, y: (d.a.y + d.b.y) / 2, z: (d.a.z + d.b.z) / 2 }
        const away = (sign: number) => {
          const q = project3d(
            { x: mid.x + d.off.x * sign, y: mid.y + d.off.y * sign, z: mid.z + d.off.z * sign },
            cam,
          )
          return Math.hypot(q.x - center.x, q.y - center.y)
        }
        const sign = away(1) >= away(-1) ? 1 : -1
        return {
          ...d,
          off: { x: d.off.x * sign, y: d.off.y * sign, z: d.off.z * sign },
        }
      })
    : []

  // A envoltória inclui as cotas, senão elas escapariam da célula.
  for (const d of dimLines) {
    for (const v of [d.a, d.b]) {
      const q = project3d({ x: v.x + d.off.x, y: v.y + d.off.y, z: v.z + d.off.z }, cam)
      bounds.x0 = Math.min(bounds.x0, q.x); bounds.x1 = Math.max(bounds.x1, q.x)
      bounds.y0 = Math.min(bounds.y0, q.y); bounds.y1 = Math.max(bounds.y1, q.y)
    }
  }

  const lines: Array<[string, string]> = [
    ['VISTA:', VIEW_LABELS[rig.view]],
    ['MONTAGEM:', `${meters(dims.wMm)}x${meters(dims.hMm)}x${meters(dims.dMm)}m`],
  ]

  const title = rig.name.trim().toUpperCase()
  const headH = title ? titleSize + DRAWING.titleGap * clamp(k, 0.55, 1) : 0
  const specsH = (lines.length - 1) * lineH
  const tailH = DRAWING.drawingGap * clamp(k, 0.5, 1) + DRAWING.specsGap * clamp(k, 0.55, 1) + specsH

  const availW = cw
  const availH = ch - headH - tailH
  const spanW = bounds.x1 - bounds.x0 || 1
  const spanH = bounds.y1 - bounds.y0 || 1
  const den = pickScale(spanW, spanH, availW * DRAWING.fillFactor, availH * DRAWING.fillFactor)

  const w = spanW / den
  const h = spanH / den
  const groupTop = cell.y0 + Math.max(0, (ch - (headH + h + tailH)) / 2)
  const x = cx - w / 2
  const y = groupTop + headH

  activeLayer = LAYERS.text
  if (title) {
    prims.push(
      text(cx, groupTop + titleSize, title, fitSize(title, cw, titleSize, true), COLORS.navy, {
        bold: true, anchor: 'middle', tracking: DRAWING.titleTracking * k,
      }),
    )
  }

  activeLayer = LAYERS.rig
  for (const face of projected) {
    prims.push({
      kind: 'poly', layer: LAYERS.rig,
      pts: face.pts.map((p) => ({
        x: x + (p.x - bounds.x0) / den,
        y: y + (p.y - bounds.y0) / den,
      })),
      fill: face.fill,
      stroke: face.stroke,
      width: face.width,
    })
  }

  if (dimLines.length) {
    activeLayer = LAYERS.dims
    const to2d = (v: { x: number; y: number; z: number }) => {
      const q = project3d(v, cam)
      return { x: x + (q.x - bounds.x0) / den, y: y + (q.y - bounds.y0) / den }
    }
    const dimSize = clamp(2.5 * k, 1.8, 2.5)
    for (const d of dimLines) {
      const a = to2d(d.a)
      const bb = to2d(d.b)
      const ao = to2d({ x: d.a.x + d.off.x, y: d.a.y + d.off.y, z: d.a.z + d.off.z })
      const bo = to2d({ x: d.b.x + d.off.x, y: d.b.y + d.off.y, z: d.b.z + d.off.z })
      // Linhas de chamada até a linha de cota, como num desenho técnico.
      prims.push(line(a.x, a.y, ao.x, ao.y, COLORS.dim, 0.16))
      prims.push(line(bb.x, bb.y, bo.x, bo.y, COLORS.dim, 0.16))
      prims.push(line(ao.x, ao.y, bo.x, bo.y, COLORS.dim, 0.22))
      prims.push(
        text((ao.x + bo.x) / 2, (ao.y + bo.y) / 2 - 1, d.label, dimSize, COLORS.dim, {
          anchor: 'middle',
        }),
      )
    }
  }

  activeLayer = LAYERS.text
  const separatorY = y + h + DRAWING.drawingGap * clamp(k, 0.5, 1)
  const specsFirst = separatorY + DRAWING.specsGap * clamp(k, 0.55, 1)
  const gap = specsSize * 0.28
  const widths = lines.map(
    ([l, v]) => textWidth(l, specsSize, true) + gap + textWidth(v, specsSize, false),
  )
  prims.push(
    line(
      cx - Math.min(Math.max(...widths) / 2 + 4, cw / 2), separatorY,
      cx + Math.min(Math.max(...widths) / 2 + 4, cw / 2), separatorY,
      COLORS.dash, 0.3, true,
    ),
  )
  lines.forEach(([label, value], i) => {
    const ly = specsFirst + i * lineH
    const startX = cx - widths[i] / 2
    prims.push(text(startX, ly, label, specsSize, COLORS.navy, { bold: true }))
    prims.push(
      text(startX + textWidth(label, specsSize, true) + gap, ly, value, specsSize, COLORS.slateText),
    )
  })
}

export function buildSheetLayout(project: Project, sheet: Sheet, index: number): SheetLayout {
  const prims: Prim[] = []
  const panels = sheetPanels(project, sheet)
  const metrics = panels.map(computeMetrics)

  activeLayer = LAYERS.frame
  prims.push({ kind: 'rect', layer: LAYERS.frame, x: 0, y: 0, w: PAGE.w, h: PAGE.h, fill: '#ffffff' })

  // ---------------------------------------------------------------- prancha
  // Painéis e montagens dividem as mesmas células da prancha.
  const rigs = project.rigs.filter((r) => sheet.activeRigIds.includes(r.id))
  const cells = panelCells(panels.length + rigs.length)
  const scales = panels.map((panel, i) =>
    drawPanelCell(prims, sheet, panel, metrics[i], cells[i]),
  )
  rigs.forEach((rig, i) => drawRigCell(prims, project, rig, cells[panels.length + i]))

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

  let legendBottom = LEGEND.boxTop
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
    legendBottom = LEGEND.boxTop + boxH
  }

  // ------------------------------------------------------------ cores
  // Entradas: a cor do painel e, abaixo, a de cada repartição colorida.
  const legendEntries: Array<{ color: string; label: string; sub?: boolean }> = []
  if (sheet.showColorLegend) {
    panels.forEach((panel) => {
      if (!panel.showInLegend) return
      const name = panel.name.trim().toUpperCase() || 'PAINEL'
      if (panel.color) legendEntries.push({ color: panel.color, label: name })
      const regions = derivedRegions(panel, computeMetrics(panel))
      if (regions.length > 1) {
        for (const region of regions) {
          const label = region.name.trim().toUpperCase()
          // Só entra na legenda a parte que tem cor de fato.
          if (label && region.color) {
            legendEntries.push({ color: region.color, label: `${name} · ${label}`, sub: true })
          }
        }
      }
    })
  }

  if (legendEntries.length) {
    const top = legendBottom + 8
    prims.push(
      text(SIDEBAR.x0, top, 'CORES:', LEGEND.obsSize, COLORS.slate, {
        bold: true, tracking: LEGEND.obsTracking,
      }),
    )
    legendEntries.forEach((entry, i) => {
      const rowY = top + 5.4 + i * 6.2
      prims.push({
        kind: 'rect', layer: LAYERS.frame,
        x: SIDEBAR.x0 + (entry.sub ? 3 : 0), y: rowY - 2.6,
        w: 3.4, h: 3.4,
        fill: entry.color, stroke: COLORS.boxStroke, width: 0.2,
      })
      prims.push(
        text(
          SIDEBAR.x0 + (entry.sub ? 3 : 0) + 5,
          rowY,
          entry.label,
          LEGEND.itemSize * 0.86,
          entry.sub ? COLORS.slate : COLORS.slateText,
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
