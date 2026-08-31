import { useMemo, useState, type Dispatch } from 'react'
import type { PanelConfig } from '../types'
import type { Action } from '../lib/store'
import {
  cellKey, computeMetrics, cutAbove, cutLeft, derivedRegions, hasPlate,
} from '../lib/calc'
import { tint } from '../lib/layout'

export type GridMode = 'plates' | 'cuts'

const MIN_PX = 8
const MAX_PX = 44

/**
 * Grade do painel.
 *
 * Em *Placas* define-se onde há painel; em *Divisões*, clicar sobre a linha
 * entre duas placas corta o painel ali. A primeira vez o corte atravessa a
 * grade de ponta a ponta — é a divisão reta que a folha mostra tracejada;
 * clicar de novo sobre um trecho já cortado remove só aquele trecho.
 *
 * As repartições não são desenhadas à mão: são o que sobra quando os cortes
 * separam as placas.
 */
export function GridEditor({
  panel, mode, onModeChange, dispatch, expanded,
}: {
  panel: PanelConfig
  mode: GridMode
  onModeChange: (m: GridMode) => void
  dispatch: Dispatch<Action>
  expanded?: boolean
}) {
  const m = useMemo(() => computeMetrics(panel), [panel])
  const regions = useMemo(() => derivedRegions(panel, m), [panel, m])
  const cols = m.cols.total
  const rows = m.rows.total

  const [cellPx, setCellPx] = useState(() =>
    Math.max(MIN_PX, Math.min(expanded ? 32 : 22, Math.floor((expanded ? 1050 : 260) / Math.max(cols, 1)))),
  )

  const cutSet = useMemo(() => new Set(panel.cuts), [panel.cuts])
  const colorOf = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of regions) for (const key of r.cells) map.set(key, r.color)
    return map
  }, [regions])

  const setCuts = (cuts: string[], on: boolean) =>
    dispatch({ type: 'setCuts', panelId: panel.id, cuts, on })

  /**
   * Corte horizontal na aresta superior da linha `row`. Se aquele trecho ainda
   * não está cortado, corta a linha inteira; se está, tira só o trecho.
   */
  const toggleH = (col: number, row: number) => {
    if (cutSet.has(cutAbove(col, row))) {
      setCuts([cutAbove(col, row)], false)
      return
    }
    setCuts(Array.from({ length: cols }, (_, c) => cutAbove(c, row)), true)
  }

  const toggleV = (col: number, row: number) => {
    if (cutSet.has(cutLeft(col, row))) {
      setCuts([cutLeft(col, row)], false)
      return
    }
    setCuts(Array.from({ length: rows }, (_, r) => cutLeft(col, r)), true)
  }

  const togglePlate = (col: number, row: number) =>
    dispatch({
      type: 'setCells', panelId: panel.id,
      cells: [cellKey(col, row)], present: !hasPlate(panel, col, row),
    })

  const setLine = (cells: string[], present: boolean) =>
    dispatch({ type: 'setCells', panelId: panel.id, cells, present })

  /** A régua age na coluna ou na linha inteira. */
  const applyColumn = (c: number) => {
    const cells = Array.from({ length: rows }, (_, r) => cellKey(c, r))
    setLine(cells, !hasPlate(panel, c, 0))
  }
  const applyRow = (r: number) => {
    const cells = Array.from({ length: cols }, (_, c) => cellKey(c, r))
    setLine(cells, !hasPlate(panel, 0, r))
  }

  const gutter = Math.max(14, Math.min(20, cellPx))
  const w = gutter + cols * cellPx
  const h = gutter + rows * cellPx
  const tick = Math.max(6, Math.min(9, cellPx * 0.5))
  const grab = Math.max(5, Math.min(9, cellPx * 0.45))

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
            className={`chip${mode === 'cuts' ? ' is-on' : ''}`}
            onClick={() => onModeChange('cuts')}
          >
            Divisões
          </button>
          {panel.cuts.length ? (
            <button
              type="button" className="chip"
              onClick={() => dispatch({ type: 'clearCuts', panelId: panel.id })}
            >
              Limpar divisões
            </button>
          ) : null}
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

      <div className={`grided__scroll${expanded ? ' is-expanded' : ''}`}>
        <svg className="grided__svg" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          {/* Réguas: agem na coluna ou na linha inteira. */}
          {Array.from({ length: cols }, (_, c) => (
            <g key={`c${c}`} className="grided__ruler" onClick={() => applyColumn(c)}>
              <rect x={gutter + c * cellPx} y={0} width={cellPx} height={gutter} />
              {cellPx >= 14 || c % 5 === 0 ? (
                <text x={gutter + c * cellPx + cellPx / 2} y={gutter - 4} fontSize={tick}>{c + 1}</text>
              ) : null}
            </g>
          ))}
          {Array.from({ length: rows }, (_, r) => (
            <g key={`r${r}`} className="grided__ruler" onClick={() => applyRow(r)}>
              <rect x={0} y={gutter + r * cellPx} width={gutter} height={cellPx} />
              {cellPx >= 14 || r % 5 === 0 ? (
                <text x={gutter / 2} y={gutter + r * cellPx + cellPx / 2 + tick / 3} fontSize={tick}>{r + 1}</text>
              ) : null}
            </g>
          ))}

          {/* Placas */}
          {Array.from({ length: rows }, (_, r) =>
            Array.from({ length: cols }, (_, c) => {
              const present = hasPlate(panel, c, r)
              const color = colorOf.get(cellKey(c, r)) ?? panel.color
              return (
                <rect
                  key={cellKey(c, r)}
                  className={mode === 'plates' ? 'grided__cell' : 'grided__cell is-locked'}
                  x={gutter + c * cellPx} y={gutter + r * cellPx}
                  width={cellPx} height={cellPx}
                  fill={present ? (color ? tint(color, 0.68) : '#dfe7f1') : '#1b2430'}
                  stroke="#7d8ba0" strokeWidth={0.4}
                  onClick={mode === 'plates' ? () => togglePlate(c, r) : undefined}
                />
              )
            }),
          )}

          {/* Cortes já colocados */}
          {panel.cuts.map((key) => {
            const horizontal = key.startsWith('h')
            const [c, r] = key.slice(1).split(',').map(Number)
            const x = gutter + c * cellPx
            const y = gutter + r * cellPx
            return horizontal ? (
              <line
                key={key} className="grided__cut"
                x1={x} y1={y} x2={x + cellPx} y2={y}
              />
            ) : (
              <line
                key={key} className="grided__cut"
                x1={x} y1={y} x2={x} y2={y + cellPx}
              />
            )
          })}

          {/* Alvos de clique sobre as linhas internas da grade */}
          {mode === 'cuts' ? (
            <g className="grided__edges">
              {Array.from({ length: rows - 1 }, (_, i) =>
                Array.from({ length: cols }, (_, c) => (
                  <rect
                    key={`eh${c},${i + 1}`}
                    x={gutter + c * cellPx} y={gutter + (i + 1) * cellPx - grab / 2}
                    width={cellPx} height={grab}
                    onClick={() => toggleH(c, i + 1)}
                  />
                )),
              )}
              {Array.from({ length: cols - 1 }, (_, i) =>
                Array.from({ length: rows }, (_, r) => (
                  <rect
                    key={`ev${i + 1},${r}`}
                    x={gutter + (i + 1) * cellPx - grab / 2} y={gutter + r * cellPx}
                    width={grab} height={cellPx}
                    onClick={() => toggleV(i + 1, r)}
                  />
                )),
              )}
            </g>
          ) : null}
        </svg>
      </div>

      <RangeApply
        cols={cols} rows={rows}
        onApply={(from, to) => {
          const cells: string[] = []
          for (let r = from[1]; r <= to[1]; r++) for (let c = from[0]; c <= to[0]; c++) cells.push(cellKey(c, r))
          setLine(cells, !hasPlate(panel, from[0], from[1]))
        }}
        disabled={mode !== 'plates'}
      />

      <p className="grided__hint">
        {mode === 'plates'
          ? 'Clique numa placa para tirá-la ou repô-la. Os números das réguas agem na coluna ou linha inteira.'
          : 'Clique sobre a linha entre duas placas para dividir o painel ali — o corte atravessa a grade. Clicar num trecho já cortado remove só aquele trecho.'}
      </p>
      <p className="grided__count">
        {m.activeCount} de {cols * rows} placas · {regions.length}{' '}
        {regions.length === 1 ? 'repartição' : 'repartições'}
      </p>
    </div>
  )
}

/** Seleção por intervalo, para painéis largos onde mirar não é prático. */
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

  if (disabled) return null

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
        type="button" className="chip"
        onClick={() =>
          onApply(
            [Math.min(c0, c1) - 1, Math.min(r0, r1) - 1],
            [Math.max(c0, c1) - 1, Math.max(r0, r1) - 1],
          )
        }
      >
        Aplicar
      </button>
    </div>
  )
}
