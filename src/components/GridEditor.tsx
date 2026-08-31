import { useEffect, useMemo, useState, type Dispatch } from 'react'
import type { PanelConfig, PanelRegion } from '../types'
import type { Action } from '../lib/store'
import { cellKey, computeMetrics, hasPlate } from '../lib/calc'
import { tint } from '../lib/layout'

export type GridMode = 'plates' | 'region'

const MIN_PX = 7
const MAX_PX = 40

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
 * repartição.
 *
 * Clicar age numa posição, arrastar age no retângulo percorrido e as réguas de
 * coluna e linha agem na faixa inteira — o que importa em painéis largos, onde
 * a operação comum é abrir um vão de dezenas de colunas.
 */
export function GridEditor({
  panel, mode, onModeChange, regions, activeRegionId, onPickRegion, dispatch, expanded,
}: {
  panel: PanelConfig
  mode: GridMode
  onModeChange: (m: GridMode) => void
  regions: PanelRegion[]
  activeRegionId: string | null
  onPickRegion: (id: string) => void
  dispatch: Dispatch<Action>
  /** Em tela cheia a grade abre maior e com mais folga. */
  expanded?: boolean
}) {
  const m = useMemo(() => computeMetrics(panel), [panel])
  const cols = m.cols.total
  const rows = m.rows.total

  const [cellPx, setCellPx] = useState(() =>
    Math.max(MIN_PX, Math.min(expanded ? 30 : 20, Math.floor((expanded ? 1000 : 250) / Math.max(cols, 1)))),
  )
  const [drag, setDrag] = useState<{ from: [number, number]; to: [number, number] } | null>(null)

  // Soltar o ponteiro fora da grade encerra o arrasto em vez de deixá-lo presa.
  useEffect(() => {
    if (!drag) return
    const end = () => setDrag(null)
    window.addEventListener('pointerup', end)
    return () => window.removeEventListener('pointerup', end)
  }, [drag])

  const region = regions.find((r) => r.id === activeRegionId) ?? null
  const regionOf = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of regions) for (const key of r.cells) map.set(key, r.color)
    return map
  }, [regions])

  const preview = drag ? new Set(rectCells(drag.from, drag.to)) : null

  /** Aplica o modo corrente a um conjunto de posições, guiado pela primeira. */
  const applyCells = (cells: string[], anchor: [number, number]) => {
    if (mode === 'plates') {
      const present = !hasPlate(panel, anchor[0], anchor[1])
      dispatch({ type: 'setCells', panelId: panel.id, cells, present })
      return
    }
    if (!region) return
    const inside = !region.cells.includes(cellKey(anchor[0], anchor[1]))
    dispatch({ type: 'setRegionCells', panelId: panel.id, regionId: region.id, cells, inside })
  }

  const applyRect = (from: [number, number], to: [number, number]) =>
    applyCells(rectCells(from, to), from)

  const applyColumn = (c: number) => applyRect([c, 0], [c, rows - 1])
  const applyRow = (r: number) => applyRect([0, r], [cols - 1, r])

  const gutter = Math.max(13, Math.min(20, cellPx))
  const w = gutter + cols * cellPx
  const h = gutter + rows * cellPx
  const tick = Math.max(6, Math.min(9, cellPx * 0.55))

  return (
    <div className="grided">
      <div className="grided__bar">
        <div className="grided__modes">
          <button
            type="button"
            className={`chip${mode === 'plates' ? ' is-on' : ''}`}
            onClick={() => onModeChange('plates')}
          >
            Placas
          </button>
          <button
            type="button"
            className={`chip${mode === 'region' ? ' is-on' : ''}`}
            onClick={() => onModeChange('region')}
          >
            Repartições
          </button>
        </div>
        <div className="grided__zoom">
          <button
            type="button" className="chip" title="Diminuir"
            onClick={() => setCellPx((v) => Math.max(MIN_PX, v - 3))}
          >
            −
          </button>
          <span>{cellPx}px</span>
          <button
            type="button" className="chip" title="Aumentar"
            onClick={() => setCellPx((v) => Math.min(MAX_PX, v + 3))}
          >
            +
          </button>
        </div>
      </div>

      {mode === 'region' && regions.length ? (
        <div className="grided__regions">
          {regions.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`rpill${r.id === activeRegionId ? ' is-on' : ''}`}
              onClick={() => onPickRegion(r.id)}
            >
              <span className="rpill__dot" style={{ background: r.color }} />
              {r.name || 'PARTE'}
            </button>
          ))}
        </div>
      ) : null}

      <div className={`grided__scroll${expanded ? ' is-expanded' : ''}`}>
        <svg className="grided__svg" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          {/* Réguas: clicar age na coluna ou na linha inteira. */}
          {Array.from({ length: cols }, (_, c) => (
            <g key={`c${c}`} className="grided__ruler" onClick={() => applyColumn(c)}>
              <rect x={gutter + c * cellPx} y={0} width={cellPx} height={gutter} />
              {cellPx >= 14 || c % 5 === 0 ? (
                <text x={gutter + c * cellPx + cellPx / 2} y={gutter - 4} fontSize={tick}>
                  {c + 1}
                </text>
              ) : null}
            </g>
          ))}
          {Array.from({ length: rows }, (_, r) => (
            <g key={`r${r}`} className="grided__ruler" onClick={() => applyRow(r)}>
              <rect x={0} y={gutter + r * cellPx} width={gutter} height={cellPx} />
              {cellPx >= 14 || r % 5 === 0 ? (
                <text x={gutter / 2} y={gutter + r * cellPx + cellPx / 2 + tick / 3} fontSize={tick}>
                  {r + 1}
                </text>
              ) : null}
            </g>
          ))}

          {Array.from({ length: rows }, (_, r) =>
            Array.from({ length: cols }, (_, c) => {
              const key = cellKey(c, r)
              const present = hasPlate(panel, c, r)
              const color = regionOf.get(key) ?? panel.color
              const inPreview = preview?.has(key)
              return (
                <rect
                  key={key}
                  className="grided__cell"
                  x={gutter + c * cellPx} y={gutter + r * cellPx}
                  width={cellPx} height={cellPx}
                  fill={present ? (color ? tint(color, 0.68) : '#dfe7f1') : '#1b2430'}
                  stroke={inPreview ? '#4c8dff' : '#7d8ba0'}
                  strokeWidth={inPreview ? 1.8 : 0.4}
                  onPointerDown={() => setDrag({ from: [c, r], to: [c, r] })}
                  onPointerEnter={() => setDrag((d) => (d ? { ...d, to: [c, r] } : null))}
                  onPointerUp={() => {
                    if (drag) applyRect(drag.from, [c, r])
                    setDrag(null)
                  }}
                />
              )
            }),
          )}
        </svg>
      </div>

      <RangeApply cols={cols} rows={rows} onApply={applyRect} disabled={mode === 'region' && !region} />

      <p className="grided__hint">
        {mode === 'plates'
          ? 'Clique para tirar ou repor a placa; arraste para um trecho. Os números agem na coluna ou linha inteira.'
          : region
            ? `Pintando ${region.name || 'a repartição'}. Clique, arraste ou use os números das réguas.`
            : 'Crie uma repartição para começar a pintar.'}
      </p>
      <p className="grided__count">
        {m.activeCount} de {cols * rows} placas · {cols}×{rows} posições
      </p>
    </div>
  )
}

/**
 * Seleção por intervalo. Em painéis largos digitar "colunas 3 a 46" é mais
 * rápido e mais exato do que arrastar sobre dezenas de células.
 */
function RangeApply({
  cols, rows, onApply, disabled,
}: {
  cols: number
  rows: number
  onApply: (from: [number, number], to: [number, number]) => void
  disabled?: boolean
}) {
  const [c0, setC0] = useState(1)
  const [c1, setC1] = useState(cols)
  const [r0, setR0] = useState(1)
  const [r1, setR1] = useState(rows)

  const clampCol = (v: number) => Math.max(1, Math.min(cols, Math.round(v) || 1))
  const clampRow = (v: number) => Math.max(1, Math.min(rows, Math.round(v) || 1))

  return (
    <div className="range">
      <span className="range__label">Intervalo</span>
      <span className="range__group">
        col
        <input type="number" value={c0} min={1} max={cols} onChange={(e) => setC0(clampCol(+e.target.value))} />
        a
        <input type="number" value={c1} min={1} max={cols} onChange={(e) => setC1(clampCol(+e.target.value))} />
      </span>
      <span className="range__group">
        lin
        <input type="number" value={r0} min={1} max={rows} onChange={(e) => setR0(clampRow(+e.target.value))} />
        a
        <input type="number" value={r1} min={1} max={rows} onChange={(e) => setR1(clampRow(+e.target.value))} />
      </span>
      <button
        type="button"
        className="chip"
        disabled={disabled}
        onClick={() => onApply([c0 - 1, r0 - 1], [c1 - 1, r1 - 1])}
      >
        Aplicar
      </button>
    </div>
  )
}
