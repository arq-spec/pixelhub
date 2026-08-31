import {
  PITCHES,
  POWER_KVA_PER_M2,
  WEIGHT_KG_PER_M2,
  type PanelConfig,
  type PanelRegion,
} from '../types'

/** Chave de uma posição da grade. */
export const cellKey = (col: number, row: number) => `${col},${row}`

/**
 * Tipo de placa numa faixa do desenho.
 * - `full`   módulo inteiro do gabinete escolhido;
 * - `filler` placa quadrada que completa a sobra (a 500x500 de um 500x1000);
 * - `cut`    recorte, quando a sobra não fecha em placa de catálogo.
 */
export type RunKind = 'full' | 'filler' | 'cut'

export interface ModuleRun {
  count: number
  sizeMm: number
  kind: RunKind
}

export interface Axis {
  /** Módulos inteiros. */
  full: number
  /** Sobra em mm (0 quando o painel fecha exato no módulo). */
  remainderMm: number
  /** Total de colunas/linhas desenhadas, incluindo a sobra. */
  total: number
  /** Pixels de um módulo inteiro neste eixo. */
  pixelsPerModule: number
  /** Pixels totais do eixo. */
  pixels: number
  /** Faixas na ordem do desenho. */
  runs: ModuleRun[]
  /** A sobra fecha numa placa quadrada de catálogo. */
  hasFiller: boolean
  /** A sobra exige recorte. */
  hasCut: boolean
}

export interface Metrics {
  widthMm: number
  heightMm: number
  cols: Axis
  rows: Axis
  /** Placas inteiras + de preenchimento + recortes. */
  moduleCount: number
  /** Só as placas do gabinete escolhido. */
  fullModuleCount: number
  /** Placas quadradas de preenchimento (a fileira superior). */
  fillerCount: number
  fillerSizeMm: number
  areaM2: number
  weightKg: number
  powerKva: number
  pixelsW: number
  pixelsH: number
  pixelsTotal: number
  pitchMm: number
  pitchLabel: string
  pixelsPerMeter: number
  /** Algum eixo exige recorte de placa. */
  hasCut: boolean
  /** Arestas das colunas e das linhas, em mm a partir da origem do painel. */
  colEdgesMm: number[]
  rowEdgesMm: number[]
  /** Placas efetivamente presentes (a grade menos as posições removidas). */
  activeCount: number
  removedCount: number
}

const EPS = 0.01

/**
 * Divide um eixo em faixas de módulo.
 *
 * `fillerMm` é o lado da placa quadrada usada para completar a sobra — no eixo
 * vertical de um gabinete 500x1000, uma sobra de 500 mm é uma placa 500x500 de
 * catálogo, não um recorte. `remainderFirst` coloca essa faixa no começo do
 * eixo, que no desenho é a parte superior do painel.
 */
function axis(
  sizeMm: number,
  moduleMm: number,
  pixelsPerMeter: number,
  options: { fillerMm?: number; remainderFirst?: boolean } = {},
): Axis {
  const safeModule = moduleMm > 0 ? moduleMm : 1
  const size = Math.max(sizeMm, 0)

  const full = Math.floor(size / safeModule + EPS)
  const raw = size - full * safeModule
  const remainderMm = raw > EPS ? raw : 0

  const isFiller =
    remainderMm > 0 &&
    options.fillerMm !== undefined &&
    Math.abs(remainderMm - options.fillerMm) < EPS

  const pixelsPerModule = Math.round((safeModule / 1000) * pixelsPerMeter)
  const remainderPixels = remainderMm
    ? Math.round((remainderMm / 1000) * pixelsPerMeter)
    : 0

  const fullRun: ModuleRun = { count: full, sizeMm: safeModule, kind: 'full' }
  const restRun: ModuleRun = {
    count: 1,
    sizeMm: remainderMm,
    kind: isFiller ? 'filler' : 'cut',
  }

  const runs: ModuleRun[] = []
  if (remainderMm && options.remainderFirst) runs.push(restRun)
  if (full > 0) runs.push(fullRun)
  if (remainderMm && !options.remainderFirst) runs.push(restRun)

  return {
    full,
    remainderMm,
    total: full + (remainderMm ? 1 : 0),
    pixelsPerModule,
    pixels: full * pixelsPerModule + remainderPixels,
    runs,
    hasFiller: isFiller,
    hasCut: remainderMm > 0 && !isFiller,
  }
}

/** Uma posição da grade tem placa? */
export const hasPlate = (panel: PanelConfig, col: number, row: number) =>
  !panel.removedCells.includes(cellKey(col, row))

export function computeMetrics(panel: PanelConfig): Metrics {
  const pitch = PITCHES[panel.pitch]

  const cols = axis(panel.widthMm, panel.moduleWMm, pitch.pixelsPerMeter)
  // A sobra de altura vira uma fileira de placas quadradas no topo do painel.
  const rows = axis(panel.heightMm, panel.moduleHMm, pitch.pixelsPerMeter, {
    fillerMm: panel.moduleWMm,
    remainderFirst: true,
  })

  const colEdgesMm = moduleEdges(cols)
  const rowEdgesMm = moduleEdges(rows)

  // A área é a soma das placas presentes: num painel de formato livre ela é
  // menor que largura x altura, e é ela que dita peso e consumo.
  let areaM2 = 0
  let activeCount = 0
  for (let r = 0; r < rows.total; r++) {
    for (let c = 0; c < cols.total; c++) {
      if (!hasPlate(panel, c, r)) continue
      activeCount++
      areaM2 +=
        ((colEdgesMm[c + 1] - colEdgesMm[c]) / 1000) *
        ((rowEdgesMm[r + 1] - rowEdgesMm[r]) / 1000)
    }
  }

  const total = cols.total * rows.total
  const fillerCount = rows.hasFiller
    ? Array.from({ length: cols.total }, (_, c) => c).filter((c) => hasPlate(panel, c, 0)).length
    : 0

  return {
    colEdgesMm,
    rowEdgesMm,
    activeCount,
    removedCount: total - activeCount,
    widthMm: panel.widthMm,
    heightMm: panel.heightMm,
    cols,
    rows,
    moduleCount: activeCount,
    fullModuleCount: cols.full * rows.full,
    fillerCount,
    fillerSizeMm: panel.moduleWMm,
    areaM2,
    weightKg: areaM2 * WEIGHT_KG_PER_M2,
    powerKva: areaM2 * POWER_KVA_PER_M2,
    pixelsW: cols.pixels,
    pixelsH: rows.pixels,
    pixelsTotal: cols.pixels * rows.pixels,
    pitchMm: pitch.pitchMm,
    pitchLabel: pitch.label,
    pixelsPerMeter: pitch.pixelsPerMeter,
    hasCut: cols.hasCut || rows.hasCut,
  }
}

/** Arestas de módulo ao longo de um eixo, em mm a partir de 0. */
export function moduleEdges(a: Axis): number[] {
  const edges = [0]
  let cursor = 0
  for (const run of a.runs) {
    for (let i = 0; i < run.count; i++) {
      cursor += run.sizeMm
      edges.push(cursor)
    }
  }
  return edges
}

/** Tipo da placa em cada posição do eixo, na ordem do desenho. */
export function runKinds(a: Axis): RunKind[] {
  const kinds: RunKind[] = []
  for (const run of a.runs) {
    for (let i = 0; i < run.count; i++) kinds.push(run.kind)
  }
  return kinds
}

/** Múltiplo do módulo mais próximo — sugere um tamanho que fecha exato. */
export function snapToModule(sizeMm: number, moduleMm: number): number {
  if (moduleMm <= 0) return sizeMm
  return Math.max(1, Math.round(sizeMm / moduleMm)) * moduleMm
}


/** Posições de uma repartição, como conjunto para consulta rápida. */
export const regionCellSet = (region: PanelRegion) => new Set(region.cells)

export interface CellRect { col: number; row: number; x0: number; y0: number; x1: number; y1: number }

/** Retângulos das posições que satisfazem `keep`, em mm a partir da origem. */
export function cellRects(
  m: Metrics,
  keep: (col: number, row: number) => boolean,
): CellRect[] {
  const out: CellRect[] = []
  for (let r = 0; r < m.rows.total; r++) {
    for (let c = 0; c < m.cols.total; c++) {
      if (!keep(c, r)) continue
      out.push({
        col: c, row: r,
        x0: m.colEdgesMm[c], y0: m.rowEdgesMm[r],
        x1: m.colEdgesMm[c + 1], y1: m.rowEdgesMm[r + 1],
      })
    }
  }
  return out
}

export interface Segment { x1: number; y1: number; x2: number; y2: number }

/**
 * Contorno de um conjunto de posições: os lados que separam o conjunto de
 * tudo o que está fora dele. É assim que sai o traço em volta do painel e o
 * tracejado que divide as repartições.
 */
export function outlineOf(
  m: Metrics,
  inside: (col: number, row: number) => boolean,
): Segment[] {
  const segs: Segment[] = []
  const at = (c: number, r: number) =>
    c >= 0 && r >= 0 && c < m.cols.total && r < m.rows.total && inside(c, r)

  for (let r = 0; r < m.rows.total; r++) {
    for (let c = 0; c < m.cols.total; c++) {
      if (!inside(c, r)) continue
      const x0 = m.colEdgesMm[c], x1 = m.colEdgesMm[c + 1]
      const y0 = m.rowEdgesMm[r], y1 = m.rowEdgesMm[r + 1]
      if (!at(c, r - 1)) segs.push({ x1: x0, y1: y0, x2: x1, y2: y0 })
      if (!at(c, r + 1)) segs.push({ x1: x0, y1: y1, x2: x1, y2: y1 })
      if (!at(c - 1, r)) segs.push({ x1: x0, y1: y0, x2: x0, y2: y1 })
      if (!at(c + 1, r)) segs.push({ x1: x1, y1: y0, x2: x1, y2: y1 })
    }
  }
  return segs
}

export interface RegionMetrics {
  region: PanelRegion
  /** Envoltória da repartição, em mm. */
  widthMm: number
  heightMm: number
  pixelsW: number
  pixelsH: number
  plates: number
}

/** Medidas de uma repartição: envoltória em metros e resolução. */
export function regionMetrics(
  panel: PanelConfig, m: Metrics, region: PanelRegion,
): RegionMetrics | null {
  const set = regionCellSet(region)
  let c0 = Infinity, c1 = -Infinity, r0 = Infinity, r1 = -Infinity, plates = 0
  for (let r = 0; r < m.rows.total; r++) {
    for (let c = 0; c < m.cols.total; c++) {
      if (!set.has(cellKey(c, r)) || !hasPlate(panel, c, r)) continue
      plates++
      c0 = Math.min(c0, c); c1 = Math.max(c1, c)
      r0 = Math.min(r0, r); r1 = Math.max(r1, r)
    }
  }
  if (!plates) return null

  const widthMm = m.colEdgesMm[c1 + 1] - m.colEdgesMm[c0]
  const heightMm = m.rowEdgesMm[r1 + 1] - m.rowEdgesMm[r0]
  const axisPixels = (a: number, b: number, edges: number[]) => {
    let sum = 0
    for (let i = a; i <= b; i++) {
      sum += Math.round(((edges[i + 1] - edges[i]) / 1000) * m.pixelsPerMeter)
    }
    return sum
  }

  return {
    region,
    widthMm,
    heightMm,
    pixelsW: axisPixels(c0, c1, m.colEdgesMm),
    pixelsH: axisPixels(r0, r1, m.rowEdgesMm),
    plates,
  }
}
