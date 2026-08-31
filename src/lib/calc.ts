import {
  PITCHES,
  POWER_KVA_PER_M2,
  WEIGHT_KG_PER_M2,
  type PanelConfig,
} from '../types'

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

export function computeMetrics(panel: PanelConfig): Metrics {
  const pitch = PITCHES[panel.pitch]

  const cols = axis(panel.widthMm, panel.moduleWMm, pitch.pixelsPerMeter)
  // A sobra de altura vira uma fileira de placas quadradas no topo do painel.
  const rows = axis(panel.heightMm, panel.moduleHMm, pitch.pixelsPerMeter, {
    fillerMm: panel.moduleWMm,
    remainderFirst: true,
  })

  const areaM2 = (panel.widthMm / 1000) * (panel.heightMm / 1000)
  const fillerCount = rows.hasFiller ? cols.total : 0

  return {
    widthMm: panel.widthMm,
    heightMm: panel.heightMm,
    cols,
    rows,
    moduleCount: cols.total * rows.total,
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
