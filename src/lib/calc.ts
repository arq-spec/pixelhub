import {
  PITCHES,
  POWER_KVA_PER_M2,
  WEIGHT_KG_PER_M2,
  type PanelConfig,
} from '../types'

/** Uma faixa de módulos: `count` módulos de `sizeMm`, inteiros ou não. */
export interface ModuleRun {
  count: number
  sizeMm: number
  partial: boolean
}

export interface Axis {
  /** Módulos inteiros. */
  full: number
  /** Sobra em mm (0 quando o painel fecha exato no módulo). */
  remainderMm: number
  /** Total de colunas/linhas desenhadas, incluindo a parcial. */
  total: number
  /** Pixels de um módulo inteiro neste eixo. */
  pixelsPerModule: number
  /** Pixels totais do eixo. */
  pixels: number
  /** Faixas para desenho, na ordem. */
  runs: ModuleRun[]
}

export interface Metrics {
  widthMm: number
  heightMm: number
  cols: Axis
  rows: Axis
  /** Módulos inteiros + parciais. */
  moduleCount: number
  fullModuleCount: number
  areaM2: number
  weightKg: number
  powerKva: number
  pixelsW: number
  pixelsH: number
  pixelsTotal: number
  pitchMm: number
  pitchLabel: string
  pixelsPerMeter: number
  /** true quando o painel não fecha exato no módulo em algum eixo. */
  hasPartial: boolean
}

const EPS = 0.01

function axis(sizeMm: number, moduleMm: number, pixelsPerMeter: number): Axis {
  const safeModule = moduleMm > 0 ? moduleMm : 1
  const size = Math.max(sizeMm, 0)

  const full = Math.floor(size / safeModule + EPS)
  const remainderRaw = size - full * safeModule
  const remainderMm = remainderRaw > EPS ? remainderRaw : 0

  const pixelsPerModule = Math.round((safeModule / 1000) * pixelsPerMeter)
  const partialPixels = remainderMm
    ? Math.round((remainderMm / 1000) * pixelsPerMeter)
    : 0

  const runs: ModuleRun[] = []
  if (full > 0) runs.push({ count: full, sizeMm: safeModule, partial: false })
  if (remainderMm) runs.push({ count: 1, sizeMm: remainderMm, partial: true })

  return {
    full,
    remainderMm,
    total: full + (remainderMm ? 1 : 0),
    pixelsPerModule,
    pixels: full * pixelsPerModule + partialPixels,
    runs,
  }
}

export function computeMetrics(panel: PanelConfig): Metrics {
  const pitch = PITCHES[panel.pitch]
  const cols = axis(panel.widthMm, panel.moduleWMm, pitch.pixelsPerMeter)
  const rows = axis(panel.heightMm, panel.moduleHMm, pitch.pixelsPerMeter)

  const areaM2 = (panel.widthMm / 1000) * (panel.heightMm / 1000)

  return {
    widthMm: panel.widthMm,
    heightMm: panel.heightMm,
    cols,
    rows,
    moduleCount: cols.total * rows.total,
    fullModuleCount: cols.full * rows.full,
    areaM2,
    weightKg: areaM2 * WEIGHT_KG_PER_M2,
    powerKva: areaM2 * POWER_KVA_PER_M2,
    pixelsW: cols.pixels,
    pixelsH: rows.pixels,
    pixelsTotal: cols.pixels * rows.pixels,
    pitchMm: pitch.pitchMm,
    pitchLabel: pitch.label,
    pixelsPerMeter: pitch.pixelsPerMeter,
    hasPartial: cols.remainderMm > 0 || rows.remainderMm > 0,
  }
}

/** Posições das arestas de módulo ao longo de um eixo, em mm a partir de 0. */
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

/** Múltiplo do módulo mais próximo — usado para sugerir um tamanho que fecha exato. */
export function snapToModule(sizeMm: number, moduleMm: number): number {
  if (moduleMm <= 0) return sizeMm
  return Math.max(1, Math.round(sizeMm / moduleMm)) * moduleMm
}
