import { PITCHES, RIG_LABELS, type Project, type Sheet } from '../types'
import { cellRects, computeMetrics, hasPlate } from './calc'
import { sheetPanels } from './store'
import { meters, num } from './format'

export interface MaterialRow {
  label: string
  qty: number
  /** Ordena o grupo na lista: placas antes da estrutura. */
  group: number
}

export interface MaterialList {
  rows: MaterialRow[]
  weightKg: number
  powerKva: number
}

/** Arredonda a medida da placa para agrupar o que é a mesma peça. */
const sizeKey = (w: number, h: number) => `${Math.round(w)}x${Math.round(h)}`

/**
 * Lista de materiais da folha: as placas dos painéis marcados e as peças das
 * montagens marcadas, somadas por tipo e medida.
 *
 * As placas são contadas pelo tamanho real de cada posição, então uma fileira
 * de preenchimento 500x500 aparece separada das 500x1000, e um recorte
 * aparece com a sua própria medida — que é o que a equipe precisa separar na
 * hora de carregar.
 */
export function buildMaterials(project: Project, sheet: Sheet): MaterialList {
  const counts = new Map<string, MaterialRow>()
  const add = (label: string, group: number, qty = 1) => {
    const key = `${group}|${label}`
    const row = counts.get(key)
    if (row) row.qty += qty
    else counts.set(key, { label, qty, group })
  }

  let weightKg = 0
  let powerKva = 0

  for (const panel of sheetPanels(project, sheet)) {
    const m = computeMetrics(panel)
    const pitch = PITCHES[panel.pitch].label
    const bySize = new Map<string, number>()
    for (const c of cellRects(m, (col, row) => hasPlate(panel, col, row))) {
      const key = sizeKey(c.x1 - c.x0, c.y1 - c.y0)
      bySize.set(key, (bySize.get(key) ?? 0) + 1)
    }
    for (const [key, qty] of bySize) {
      const [w, h] = key.split('x').map(Number)
      add(`PLACA ${meters(w)}×${meters(h)}m ${pitch}`, 0, qty)
    }
    weightKg += m.weightKg
    powerKva += m.powerKva
  }

  for (const rig of project.rigs.filter((r) => sheet.activeRigIds.includes(r.id))) {
    for (const item of rig.items) {
      // O painel da montagem já foi contado pelas placas do catálogo.
      if (item.kind === 'painel') continue
      const times = Math.max(1, Math.round(item.count))
      const label =
        item.kind === 'praticavel'
          ? `PRATICÁVEL ${meters(item.wMm)}×${meters(item.dMm)}m · perna ${meters(item.legMm)}m`
          : `${RIG_LABELS[item.kind].toUpperCase()} ${meters(item.wMm)}×${meters(item.hMm)}×${meters(item.dMm)}m`
      add(label, item.kind === 'praticavel' ? 1 : 2, times)
    }
  }

  const rows = [...counts.values()].sort(
    (a, b) => a.group - b.group || a.label.localeCompare(b.label, 'pt-BR'),
  )
  return { rows, weightKg, powerKva }
}

/** Linhas prontas para o quadro, com a quantidade à frente. */
export function materialLines(list: MaterialList): Array<[string, string]> {
  const lines: Array<[string, string]> = list.rows.map((r) => [
    `${r.qty}×`,
    r.label,
  ])
  if (list.weightKg > 0) {
    lines.push(['', `PESO TOTAL ${num(list.weightKg, 1)} kg`])
    lines.push(['', `CONSUMO TOTAL ${num(list.powerKva, 2)} kVA`])
  }
  return lines
}
