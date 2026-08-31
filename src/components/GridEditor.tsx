import { useMemo, useState, type Dispatch } from 'react'
import type { PanelConfig } from '../types'
import type { Action } from '../lib/store'
import { cellKey, computeMetrics, hasPlate } from '../lib/calc'
import { tint } from '../lib/layout'

export type GridMode = 'plates' | 'region'

/** Todas as posições do retângulo entre dois cantos. */
function rectCells(a: [number, number], b: [number, number]): string[] {
  const [c0, c1] = a[0] <= b[0] ? [a[0], b[0]] : [b[0], a[0]]
  const [r0, r1] = a[1] <= b[1] ? [a[1], b[1]] : [b[1], a[1]]
  const out: string[] = []
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) out.push(cellKey(c, r))
  return out
}

/**
 * Grade clicável do painel: define onde há placa e quais posições compõem cada
 * repartição. Clicar age numa posição; arrastar age no retângulo percorrido.
 */
export function GridEditor({
  panel, mode, activeRegionId, dispatch,
}: {
  panel: PanelConfig
  mode: GridMode
  activeRegionId: string | null
  dispatch: Dispatch<Action>
}) {
  const m = useMemo(() => computeMetrics(panel), [panel])
  const [drag, setDrag] = useState<{ from: [number, number]; to: [number, number] } | null>(null)

  const cols = m.cols.total
  const rows = m.rows.total
  const region = panel.regions.find((r) => r.id === activeRegionId) ?? null
  const regionOf = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of panel.regions) for (const key of r.cells) map.set(key, r.color)
    return map
  }, [panel.regions])

  const preview = drag ? new Set(rectCells(drag.from, drag.to)) : null

  const apply = (from: [number, number], to: [number, number]) => {
    const cells = rectCells(from, to)
    if (mode === 'plates') {
      // O primeiro clique decide a ação: sai de onde havia placa = remover.
      const present = !hasPlate(panel, from[0], from[1])
      dispatch({ type: 'setCells', panelId: panel.id, cells, present })
      return
    }
    if (!region) return
    const inside = !region.cells.includes(cellKey(from[0], from[1]))
    dispatch({ type: 'setRegionCells', panelId: panel.id, regionId: region.id, cells, inside })
  }

  // A grade cabe na coluna: o lado da célula sai da largura disponível.
  const side = Math.max(6, Math.min(22, Math.floor(260 / Math.max(cols, 1))))
  const w = cols * side
  const h = rows * side

  return (
    <div className="grided">
      <svg
        className="grided__svg"
        viewBox={`0 0 ${w} ${h}`}
        style={{ maxWidth: `${w}px` }}
        onPointerLeave={() => setDrag(null)}
      >
        {Array.from({ length: rows }, (_, r) =>
          Array.from({ length: cols }, (_, c) => {
            const key = cellKey(c, r)
            const present = hasPlate(panel, c, r)
            const color = regionOf.get(key) ?? panel.color
            const inPreview = preview?.has(key)
            return (
              <rect
                key={key}
                x={c * side} y={r * side} width={side} height={side}
                fill={present ? (color ? tint(color, 0.72) : '#dfe7f1') : '#1b2430'}
                stroke={inPreview ? '#4c8dff' : '#7d8ba0'}
                strokeWidth={inPreview ? 1.6 : 0.4}
                onPointerDown={(e) => {
                  e.currentTarget.releasePointerCapture?.(e.pointerId)
                  setDrag({ from: [c, r], to: [c, r] })
                }}
                onPointerEnter={() => setDrag((d) => (d ? { ...d, to: [c, r] } : null))}
                onPointerUp={() => {
                  if (drag) apply(drag.from, [c, r])
                  setDrag(null)
                }}
              />
            )
          }),
        )}
      </svg>
      <p className="grided__hint">
        {mode === 'plates'
          ? 'Clique para tirar ou repor a placa. Arraste para agir num trecho inteiro.'
          : region
            ? `Pintando ${region.name || 'a repartição'}. Clique ou arraste sobre as placas.`
            : 'Crie ou selecione uma repartição para pintar.'}
      </p>
      <p className="grided__count">
        {m.activeCount} de {cols * rows} placas · {cols}×{rows} posições
      </p>
    </div>
  )
}
