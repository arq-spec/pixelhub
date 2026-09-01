import { useEffect, useMemo, useRef, useState, type Dispatch } from 'react'
import { RIG_LABELS, type Project, type Rig, type RigKind, type Sheet } from '../types'
import type { Action } from '../lib/store'
import { rigBounds, rigFaces, resolvedDimensions } from '../lib/rigScene'
import {
  dragToScene, faceBounds, project as project3d, projectFaces, resolvesDepth,
  VIEWS, VIEW_LABELS, type Camera, type DragAxis, type ViewId, type Vec3,
} from '../lib/scene3d'
import { meters, num } from '../lib/format'
import { Button, Toggle } from './ui'
import { RigItemCard } from './RigEditor'

/** Passo de encaixe do arrasto, em mm — mantém as peças alinhadas. */
const SNAP = 50

/** Limites do zoom da tela. O 1 é o enquadramento automático. */
const ZOOM = { min: 0.35, max: 6 }

/**
 * O eixo da cena que mais se parece com a direção apontada na tela.
 *
 * A seta anda no sentido em que se olha, mas o passo sai inteiro sobre um eixo
 * — assim a peça continua encaixada na malha de 5 em 5 cm, em vez de parar em
 * 3,5 cm de cada lado por causa da diagonal da isometria.
 */
function screenAxis(dx: number, dy: number, cam: Camera): Vec3 {
  const options: Vec3[] = [
    { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 },
  ]
  let best = options[0]
  let score = -Infinity
  for (const v of options) {
    const q = project3d(v, cam)
    const dot = q.x * dx + q.y * dy
    if (dot > score) { score = dot; best = v }
  }
  return best
}

type Gesture =
  | { kind: 'orbit'; x: number; y: number; az: number; el: number }
  | { kind: 'pan'; x: number; y: number; px: number; py: number; scale: number }
  | {
      kind: 'move'; itemId: string
      x: number; y: number; ox: number; oy: number; oz: number; axis: DragAxis
    }

/**
 * Ambiente 3D — a segunda vista do projeto, ao lado da folha técnica.
 *
 * A montagem é composta aqui: as peças entram pela paleta, são posicionadas no
 * arrasto e conferidas nas cotas. A vista marcada é a que a folha desenha, de
 * modo que o que se vê aqui é o que sai impresso.
 */
export function Studio3D({
  project, sheet, index, dispatch, rigId, onRigId,
}: {
  project: Project
  sheet: Sheet
  index: number
  dispatch: Dispatch<Action>
  rigId: string | null
  onRigId: (id: string | null) => void
}) {
  const rigs = project.rigs
  const rig = rigs.find((r) => r.id === rigId) ?? rigs[0] ?? null
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [cam, setCam] = useState<Camera>(VIEWS.isometrica)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })

  const fit = () => { setZoom(1); setPan({ x: 0, y: 0 }) }

  // Trocar de montagem sem reenquadrar deixaria a peça nova fora da tela.
  useEffect(() => { fit(); setSelectedId(null) }, [rig?.id])

  const selected = rig?.items.find((i) => i.id === selectedId) ?? null

  /**
   * Teclado sobre a peça selecionada.
   *
   * As setas andam no sentido da tela, não dos eixos da cena: com a vista
   * girada, "para a direita" continua sendo para a direita. A profundidade só
   * responde quando a vista a mostra — numa frontal, não há para onde ir.
   */
  const keys = (e: React.KeyboardEvent) => {
    if (!rig || !selected) return
    const far = e.shiftKey ? SNAP * 10 : SNAP
    const move = (d: Vec3) => {
      dispatch({
        type: 'patchRigItem', rigId: rig.id, itemId: selected.id,
        patch: {
          x: selected.x + d.x * far,
          y: Math.max(0, selected.y + d.y * far),
          z: selected.z + d.z * far,
        },
      })
      e.preventDefault()
    }
    const vertical = (sign: number): Vec3 =>
      e.altKey || !resolvesDepth(cam)
        ? { x: 0, y: sign, z: 0 }
        : screenAxis(0, -sign, cam)
    switch (e.key) {
      case 'ArrowLeft': return move(screenAxis(-1, 0, cam))
      case 'ArrowRight': return move(screenAxis(1, 0, cam))
      case 'ArrowUp': return move(vertical(1))
      case 'ArrowDown': return move(vertical(-1))
      case 'Delete':
      case 'Backspace':
        dispatch({ type: 'removeRigItem', rigId: rig.id, itemId: selected.id })
        setSelectedId(null)
        return e.preventDefault()
      case 'Escape':
        return setSelectedId(null)
      default:
        return
    }
  }
  const dims = useMemo(
    () => (rig ? rigBounds(rigFaces(project, rig, cam)) : { wMm: 0, hMm: 0, dMm: 0 }),
    [project, rig, cam],
  )

  if (!rig) {
    return (
      <div className="studio">
        <div className="studio__bar">
          <span className="studio__title">Ambiente 3D</span>
        </div>
        <div className="studio__stage studio__stage--empty">
          <div className="empty">
            <strong>Nenhuma montagem no projeto</strong>
            <p>
              A montagem reúne o painel e o que o sustenta — praticáveis de altura regulável,
              mãos francesas, volumes de palco. Depois de composta, a vista isométrica, frontal,
              lateral ou superior entra na folha como desenho, com cotas e lista de materiais.
            </p>
            <Button variant="primary" onClick={() => dispatch({ type: 'addRig' })}>
              Criar montagem 3D
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const active = sheet.activeRigIds.includes(rig.id)

  return (
    <div className="studio">
      <div className="studio__bar">
        <div className="chips">
          {rigs.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`chip${r.id === rig.id ? ' is-on' : ''}`}
              onClick={() => onRigId(r.id)}
            >
              {r.name || 'MONTAGEM'}
            </button>
          ))}
          <button
            type="button"
            className="chip"
            title="Nova montagem"
            onClick={() => dispatch({ type: 'addRig' })}
          >
            + Montagem
          </button>
        </div>
        <span className="studio__size">
          {meters(dims.wMm)} × {meters(dims.hMm)} × {meters(dims.dMm)} m ·{' '}
          {rig.items.length} peça{rig.items.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="studio__tools">
        <div className="chips">
          {(Object.keys(VIEWS) as ViewId[]).map((v) => (
            <button
              key={v}
              type="button"
              className={`chip${rig.view === v ? ' is-on' : ''}`}
              title="Define a vista da folha e leva a tela para ela"
              onClick={() => {
                dispatch({ type: 'patchRig', rigId: rig.id, patch: { view: v } })
                setCam(VIEWS[v])
                fit()
              }}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>
        <div className="studio__tools-end">
          <Toggle
            checked={rig.showGround}
            onChange={(v) => dispatch({ type: 'patchRig', rigId: rig.id, patch: { showGround: v } })}
            label="Piso"
          />
          <Toggle
            checked={rig.showDimensions}
            onChange={(v) =>
              dispatch({ type: 'patchRig', rigId: rig.id, patch: { showDimensions: v } })
            }
            label="Cotas"
          />
          <Toggle
            checked={active}
            onChange={(v) => dispatch({ type: 'toggleRig', index, rigId: rig.id, active: v })}
            label="Nesta folha"
          />
          <Button onClick={() => setZoom((z) => Math.max(ZOOM.min, z / 1.25))} title="Afastar">
            −
          </Button>
          <Button onClick={() => setZoom((z) => Math.min(ZOOM.max, z * 1.25))} title="Aproximar">
            +
          </Button>
          <Button onClick={fit}>Enquadrar</Button>
        </div>
      </div>

      <div
        className="studio__stage"
        tabIndex={0}
        onKeyDown={keys}
        onPointerDown={(e) => (e.currentTarget as HTMLElement).focus()}
      >
        <Stage
          project={project}
          rig={rig}
          cam={cam}
          onCam={setCam}
          zoom={zoom}
          onZoom={setZoom}
          pan={pan}
          onPan={setPan}
          selectedId={selectedId}
          onSelect={setSelectedId}
          dispatch={dispatch}
        />

        <div className="studio__palette">
          <span className="studio__label">Adicionar</span>
          {(Object.keys(RIG_LABELS) as RigKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              className="chip"
              onClick={() =>
                dispatch({
                  type: 'addRigItem', rigId: rig.id, kind,
                  panelId: kind === 'painel' ? project.panels[0]?.id : undefined,
                })
              }
            >
              + {RIG_LABELS[kind]}
            </button>
          ))}
        </div>

        {selected ? (
          <div className="studio__float">
            <RigItemCard
              rigId={rig.id}
              item={selected}
              project={project}
              dispatch={dispatch}
              selected
              onSelect={() => setSelectedId(selected.id)}
            />
          </div>
        ) : null}

        <span className="studio__hud">
          az {num(cam.az, 0)}° · el {num(cam.el, 0)}° · {num(zoom * 100, 0)}%
        </span>
        <p className="studio__hint">
          Arraste uma peça para movê-la no piso; com <strong>Shift</strong>, na altura.
          Arrastando o fundo, a vista gira; com <strong>Shift</strong>, ela desliza. A roda
          aproxima. Com a peça selecionada, as <strong>setas</strong> a empurram de 5 em 5 cm
          — <strong>Alt</strong> muda a altura, <strong>Shift</strong> anda meio metro e{' '}
          <strong>Delete</strong> remove.
          {resolvesDepth(cam)
            ? null
            : ' Nesta vista a tela não mostra profundidade, então o arrasto só resolve a largura.'}
        </p>
      </div>
    </div>
  )
}

/**
 * A tela em si.
 *
 * O enquadramento acompanha a montagem, mas congela enquanto uma peça está
 * sendo arrastada: mover a peça muda a envoltória, a envoltória mudaria o
 * enquadramento e o desenho fugiria debaixo do cursor.
 */
function Stage({
  project, rig, cam, onCam, zoom, onZoom, pan, onPan, selectedId, onSelect, dispatch,
}: {
  project: Project
  rig: Rig
  cam: Camera
  onCam: (c: Camera) => void
  zoom: number
  onZoom: (z: number) => void
  pan: { x: number; y: number }
  onPan: (p: { x: number; y: number }) => void
  selectedId: string | null
  onSelect: (id: string | null) => void
  dispatch: Dispatch<Action>
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const [frozen, setFrozen] = useState<string | null>(null)

  const faces = useMemo(() => rigFaces(project, rig, cam), [project, rig, cam])
  const projected = useMemo(() => projectFaces(faces, cam), [faces, cam])
  const b = useMemo(() => faceBounds(projected), [projected])
  const dims = useMemo(
    () => (rig.showDimensions ? resolvedDimensions(project, rig, cam) : []),
    [project, rig, cam],
  )

  // As cotas saem do desenho: sem elas na envoltória, escapariam da tela.
  const box = useMemo(() => {
    const out = { ...b }
    for (const d of dims) {
      for (const v of [d.a, d.b]) {
        const q = project3d({ x: v.x + d.off.x, y: v.y + d.off.y, z: v.z + d.off.z }, cam)
        out.x0 = Math.min(out.x0, q.x); out.x1 = Math.max(out.x1, q.x)
        out.y0 = Math.min(out.y0, q.y); out.y1 = Math.max(out.y1, q.y)
      }
    }
    return out
  }, [b, dims, cam])

  const spanW = (box.x1 - box.x0) || 1
  const spanH = (box.y1 - box.y0) || 1
  const span = Math.max(spanW, spanH)
  const viewW = (spanW + span * 0.14) / zoom
  const viewH = (spanH + span * 0.14) / zoom
  const cx = (box.x0 + box.x1) / 2 + pan.x
  const cy = (box.y0 + box.y1) / 2 + pan.y
  const live = `${cx - viewW / 2} ${cy - viewH / 2} ${viewW} ${viewH}`
  const vb = frozen ?? live

  /** Espessura de traço constante na tela, seja qual for o zoom. */
  const hair = Math.max(viewW, viewH) / 900

  if (!faces.length) {
    return (
      <div className="studio__none">
        <p className="hint">Nenhuma peça na montagem. Use a paleta para adicionar a primeira.</p>
      </div>
    )
  }

  /** Ponto do evento em unidades da cena projetada. */
  const at = (e: React.PointerEvent) => {
    const svg = svgRef.current
    const ctm = svg?.getScreenCTM()
    if (!svg || !ctm) return { x: 0, y: 0 }
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const p = pt.matrixTransform(ctm.inverse())
    return { x: p.x, y: p.y }
  }

  const down = (e: React.PointerEvent) => {
    const itemId = (e.target as SVGElement).dataset?.item
    const p = at(e)
    if (itemId) {
      const item = rig.items.find((i) => i.id === itemId)
      if (!item) return
      onSelect(itemId)
      setFrozen(live)
      gesture.current = {
        kind: 'move', itemId, x: p.x, y: p.y,
        ox: item.x, oy: item.y, oz: item.z,
        axis: e.shiftKey ? 'height' : 'ground',
      }
    } else if (e.shiftKey) {
      const rect = svgRef.current?.getBoundingClientRect()
      const scale = rect && rect.width ? viewW / rect.width : 1
      gesture.current = {
        kind: 'pan', x: e.clientX, y: e.clientY, px: pan.x, py: pan.y, scale,
      }
    } else {
      onSelect(null)
      gesture.current = { kind: 'orbit', x: e.clientX, y: e.clientY, az: cam.az, el: cam.el }
    }
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
  }

  const move = (e: React.PointerEvent) => {
    const g = gesture.current
    if (!g) return
    if (g.kind === 'orbit') {
      onCam({
        az: g.az + (e.clientX - g.x) * 0.5,
        el: Math.max(-89, Math.min(89, g.el - (e.clientY - g.y) * 0.5)),
      })
      return
    }
    if (g.kind === 'pan') {
      onPan({
        x: g.px - (e.clientX - g.x) * g.scale,
        y: g.py - (e.clientY - g.y) * g.scale,
      })
      return
    }
    const p = at(e)
    const d = dragToScene(p.x - g.x, p.y - g.y, cam, g.axis)
    const snap = (v: number) => Math.round(v / SNAP) * SNAP
    dispatch({
      type: 'patchRigItem', rigId: rig.id, itemId: g.itemId,
      patch: { x: snap(g.ox + d.x), y: Math.max(0, snap(g.oy + d.y)), z: snap(g.oz + d.z) },
    })
  }

  const end = () => { gesture.current = null; setFrozen(null) }

  // O passo acompanha a intensidade da rolagem: um giro largo de trackpad
  // aproxima de uma vez, em vez de exigir vinte.
  const wheel = (e: React.WheelEvent) => {
    const step = Math.exp(-Math.max(-600, Math.min(600, e.deltaY)) * 0.0016)
    onZoom(Math.max(ZOOM.min, Math.min(ZOOM.max, zoom * step)))
  }

  return (
    <svg
      ref={svgRef}
      className="studio__svg"
      viewBox={vb}
      preserveAspectRatio="xMidYMid meet"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onWheel={wheel}
    >
      {projected.map((f, i) => {
        const on = !!f.itemId && f.itemId === selectedId
        return (
          <g key={i}>
            <polygon
              data-item={f.itemId}
              className={f.itemId ? 'studio__face' : undefined}
              points={f.pts.map((p) => `${p.x},${p.y}`).join(' ')}
              fill={f.fill}
              stroke={on ? '#f34136' : f.stroke}
              strokeWidth={on ? hair * 3 : hair}
              strokeLinejoin="round"
            />
            {(f.lines ?? []).map((w, j) => (
              <polyline
                key={j}
                points={w.pts.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={w.stroke}
                strokeWidth={hair * 0.7}
              />
            ))}
          </g>
        )
      })}

      {dims.map((d, i) => {
        const to2d = (v: { x: number; y: number; z: number }) => project3d(v, cam)
        const a = to2d(d.a)
        const bb = to2d(d.b)
        const ao = to2d({ x: d.a.x + d.off.x, y: d.a.y + d.off.y, z: d.a.z + d.off.z })
        const bo = to2d({ x: d.b.x + d.off.x, y: d.b.y + d.off.y, z: d.b.z + d.off.z })
        return (
          <g key={`d${i}`} className="studio__dim">
            <line x1={a.x} y1={a.y} x2={ao.x} y2={ao.y} strokeWidth={hair} />
            <line x1={bb.x} y1={bb.y} x2={bo.x} y2={bo.y} strokeWidth={hair} />
            <line x1={ao.x} y1={ao.y} x2={bo.x} y2={bo.y} strokeWidth={hair * 1.4} />
            <text
              x={(ao.x + bo.x) / 2}
              y={(ao.y + bo.y) / 2 - span * 0.006}
              fontSize={span * 0.017}
              textAnchor="middle"
            >
              {d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
