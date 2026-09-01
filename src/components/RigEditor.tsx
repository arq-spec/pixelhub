import { useMemo, useRef, useState, type Dispatch } from 'react'
import { RIG_LABELS, type Project, type Rig, type RigItem, type RigKind, type Sheet } from '../types'
import type { Action } from '../lib/store'
import { rigBounds, rigFaces } from '../lib/rigScene'
import {
  dragToScene, faceBounds, projectFaces, resolvesDepth, VIEWS, VIEW_LABELS,
  type Camera, type DragAxis, type ViewId,
} from '../lib/scene3d'
import { meters, num } from '../lib/format'
import { Button, Field, NumberInput, Section, TextInput, Toggle } from './ui'

/** Passo de encaixe do arrasto, em mm — mantém as peças alinhadas. */
const SNAP = 50

/**
 * Vista da montagem.
 *
 * Arrastar o fundo gira a câmera; arrastar uma peça a move. No piso o
 * deslocamento resolve X e Z; com Shift, a altura. A vista frontal não carrega
 * profundidade, então lá o arrasto no piso só resolve X — o aviso na barra diz
 * isso, para não parecer que a peça travou.
 */
function Viewport({
  project, rig, cam, onCam, selectedId, onSelect, dispatch,
}: {
  project: Project
  rig: Rig
  cam: Camera
  onCam: (c: Camera) => void
  selectedId: string | null
  onSelect: (id: string | null) => void
  dispatch: Dispatch<Action>
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const gesture = useRef<
    | { kind: 'orbit'; x: number; y: number; az: number; el: number }
    | { kind: 'move'; itemId: string; x: number; y: number; ox: number; oy: number; oz: number; axis: DragAxis }
    | null
  >(null)

  const faces = useMemo(() => rigFaces(project, rig), [project, rig])
  const projected = useMemo(() => projectFaces(faces, cam), [faces, cam])
  const b = useMemo(() => faceBounds(projected), [projected])

  if (!faces.length) {
    return <p className="hint">Adicione peças para ver a montagem.</p>
  }

  const span = Math.max(b.x1 - b.x0, b.y1 - b.y0) || 1
  const pad = span * 0.06
  const vb = `${b.x0 - pad} ${b.y0 - pad} ${b.x1 - b.x0 + pad * 2} ${b.y1 - b.y0 + pad * 2}`

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
      gesture.current = {
        kind: 'move', itemId, x: p.x, y: p.y,
        ox: item.x, oy: item.y, oz: item.z,
        axis: e.shiftKey ? 'height' : 'ground',
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
    const p = at(e)
    const d = dragToScene(p.x - g.x, p.y - g.y, cam, g.axis)
    const snap = (v: number) => Math.round(v / SNAP) * SNAP
    dispatch({
      type: 'patchRigItem', rigId: rig.id, itemId: g.itemId,
      patch: { x: snap(g.ox + d.x), y: Math.max(0, snap(g.oy + d.y)), z: snap(g.oz + d.z) },
    })
  }

  const end = () => { gesture.current = null }

  return (
    <svg
      ref={svgRef}
      className="rig3d__svg"
      viewBox={vb}
      preserveAspectRatio="xMidYMid meet"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      {projected.map((f, i) => {
        const selected = !!f.itemId && f.itemId === selectedId
        return (
          <polygon
            key={i}
            data-item={f.itemId}
            className={f.itemId ? 'rig3d__face' : undefined}
            points={f.pts.map((p) => `${p.x},${p.y}`).join(' ')}
            fill={f.fill}
            stroke={selected ? '#f34136' : f.stroke}
            strokeWidth={span / (selected ? 320 : 900)}
            strokeLinejoin="round"
          />
        )
      })}
    </svg>
  )
}

export function RigEditor({
  project, sheet, index, dispatch,
}: { project: Project; sheet: Sheet; index: number; dispatch: Dispatch<Action> }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [zoomRigId, setZoomRigId] = useState<string | null>(null)
  // O ângulo livre é da tela; a folha usa a vista escolhida na montagem.
  const [cam, setCam] = useState<Camera>(VIEWS.isometrica)

  const rigs = project.rigs
  const selected =
    rigs.flatMap((r) => r.items).find((i) => i.id === selectedId) ?? null
  const zoomRig = rigs.find((r) => r.id === zoomRigId) ?? null

  return (
    <Section
      title={`Montagens (${sheet.activeRigIds.length}/${rigs.length})`}
      collapsible
      storageKey="pixelhub.ui.rigs"
      summary={rigs.length ? `${rigs.length} no projeto` : 'nenhuma'}
      action={
        <Button variant="primary" onClick={() => dispatch({ type: 'addRig' })}>
          + Montagem
        </Button>
      }
    >
      {rigs.length === 0 ? (
        <div className="empty">
          <strong>Ambiente 3D</strong>
          <p>
            Monte a composição do evento — o painel sobre praticáveis, escorado por mãos
            francesas — e leve a vista isométrica, frontal, lateral ou superior para a folha.
          </p>
          <Button variant="primary" onClick={() => dispatch({ type: 'addRig' })}>
            Criar montagem 3D
          </Button>
        </div>
      ) : (
        <p className="hint">
          A montagem reúne o painel e o que o sustenta — praticáveis, mãos francesas, volumes.
          Marcada na folha, ela entra na prancha como uma vista, ao lado dos painéis.
        </p>
      )}

      {rigs.map((rig) => {
        const active = sheet.activeRigIds.includes(rig.id)
        const isOpen = openId === rig.id
        const dims = rigBounds(rigFaces(project, rig))
        return (
          <div key={rig.id} className={`pcard${active ? '' : ' pcard--off'}`}>
            <header className="pcard__head">
              <label className="pcard__check" title="Nesta folha">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) =>
                    dispatch({
                      type: 'toggleRig', index, rigId: rig.id, active: e.target.checked,
                    })
                  }
                />
              </label>
              <button
                type="button"
                className="pcard__summary"
                onClick={() => setOpenId(isOpen ? null : rig.id)}
              >
                <strong>{rig.name || 'MONTAGEM'}</strong>
                <small>
                  {rig.items.length} peça{rig.items.length === 1 ? '' : 's'} ·{' '}
                  {meters(dims.wMm)}×{meters(dims.hMm)}×{meters(dims.dMm)}m ·{' '}
                  {VIEW_LABELS[rig.view]}
                </small>
              </button>
              <span className="pcard__actions">
                <Button variant="icon" onClick={() => setOpenId(isOpen ? null : rig.id)}>
                  {isOpen ? '▾' : '▸'}
                </Button>
                <Button
                  variant="icon" title="Excluir montagem"
                  onClick={() => dispatch({ type: 'removeRig', rigId: rig.id })}
                >
                  ✕
                </Button>
              </span>
            </header>

            {isOpen ? (
              <div className="pcard__body">
                <Field label="Nome" wide>
                  <TextInput
                    value={rig.name}
                    upper
                    onChange={(v) => dispatch({ type: 'patchRig', rigId: rig.id, patch: { name: v } })}
                  />
                </Field>

                <div className="rig3d">
                  <Viewport
                    project={project}
                    rig={rig}
                    cam={cam}
                    onCam={setCam}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    dispatch={dispatch}
                  />
                  <span className="rig3d__angle">
                    az {num(cam.az, 0)}° · el {num(cam.el, 0)}°
                  </span>
                  {selected ? (
                    <span className="rig3d__sel">
                      {selected.name || RIG_LABELS[selected.kind]} · X {meters(selected.x)} · Y{' '}
                      {meters(selected.y)} · Z {meters(selected.z)}
                    </span>
                  ) : null}
                </div>
                <div className="shape__modes">
                  <Button onClick={() => setZoomRigId(rig.id)} title="Editar em tela cheia">
                    Ampliar 3D
                  </Button>
                </div>
                <p className="hint">
                  Arraste uma peça para movê-la no piso; com <strong>Shift</strong>, na altura.
                  Arrastando o fundo, a vista gira. As posições encaixam de 5 em 5 cm.
                  {resolvesDepth(cam)
                    ? null
                    : ' Nesta vista a tela não mostra profundidade, então o arrasto só resolve a largura.'}
                </p>

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
                      }}
                    >
                      {VIEW_LABELS[v]}
                    </button>
                  ))}
                </div>
                <p className="hint">
                  Arraste a vista para girar. A vista marcada é a que sai na folha.
                </p>

                <Toggle
                  checked={rig.showGround}
                  onChange={(v) => dispatch({ type: 'patchRig', rigId: rig.id, patch: { showGround: v } })}
                  label="Mostrar o piso"
                />
                <Toggle
                  checked={rig.showDimensions}
                  onChange={(v) => dispatch({ type: 'patchRig', rigId: rig.id, patch: { showDimensions: v } })}
                  label="Cotar medidas e alturas"
                />

                <div className="regions__head">
                  <span>Peças ({rig.items.length})</span>
                </div>
                <div className="chips">
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

                {rig.items.map((item) => (
                  <RigItemCard
                    key={item.id}
                    rigId={rig.id}
                    item={item}
                    project={project}
                    dispatch={dispatch}
                    selected={item.id === selectedId}
                    onSelect={() => setSelectedId(item.id)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        )
      })}

      {zoomRig ? (
        <div className="overlay" role="dialog" aria-label="Montagem em tela cheia">
          <div className="overlay__panel">
            <header className="overlay__head">
              <strong>{zoomRig.name || 'MONTAGEM'}</strong>
              <span>{VIEW_LABELS[zoomRig.view]} · az {num(cam.az, 0)}° · el {num(cam.el, 0)}°</span>
              <Button onClick={() => setZoomRigId(null)}>Fechar</Button>
            </header>
            <div className="overlay__body">
              <div className="rig3d rig3d--full">
                <Viewport
                  project={project}
                  rig={zoomRig}
                  cam={cam}
                  onCam={setCam}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  dispatch={dispatch}
                />
                {selected ? (
                  <span className="rig3d__sel">
                    {selected.name || RIG_LABELS[selected.kind]} · X {meters(selected.x)} · Y{' '}
                    {meters(selected.y)} · Z {meters(selected.z)}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="chips">
              {(Object.keys(VIEWS) as ViewId[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`chip${zoomRig.view === v ? ' is-on' : ''}`}
                  onClick={() => {
                    dispatch({ type: 'patchRig', rigId: zoomRig.id, patch: { view: v } })
                    setCam(VIEWS[v])
                  }}
                >
                  {VIEW_LABELS[v]}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </Section>
  )
}

function RigItemCard({
  rigId, item, project, dispatch, selected, onSelect,
}: {
  rigId: string
  item: RigItem
  project: Project
  dispatch: Dispatch<Action>
  selected: boolean
  onSelect: () => void
}) {
  const set = (patch: Partial<RigItem>) =>
    dispatch({ type: 'patchRigItem', rigId, itemId: item.id, patch })
  const panel = project.panels.find((p) => p.id === item.panelId) ?? null

  return (
    <div className={`rigitem${selected ? ' is-selected' : ''}`} onPointerDown={onSelect}>
      <header className="rigitem__head">
        <strong>{RIG_LABELS[item.kind]}</strong>
        <input
          className="region__name"
          value={item.name}
          onChange={(e) => set({ name: e.target.value })}
        />
        <Button
          variant="icon" title="Duplicar peça"
          onClick={() => dispatch({ type: 'duplicateRigItem', rigId, itemId: item.id })}
        >
          ⧉
        </Button>
        <Button
          variant="icon" title="Remover peça"
          onClick={() => dispatch({ type: 'removeRigItem', rigId, itemId: item.id })}
        >
          ✕
        </Button>
      </header>

      {item.kind === 'painel' ? (
        <Field label="Painel do projeto" wide>
          <select
            className="input"
            value={item.panelId ?? ''}
            onChange={(e) => set({ panelId: e.target.value || null })}
          >
            <option value="">— escolher —</option>
            {project.panels.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </Field>
      ) : null}

      <div className="grid3">
        <Field label="X (largura)"><NumberInput value={item.x / 1000} step={0.1} min={-1000} suffix="m" onChange={(v) => set({ x: v * 1000 })} /></Field>
        <Field label="Y (altura)"><NumberInput value={item.y / 1000} step={0.1} min={-1000} suffix="m" onChange={(v) => set({ y: v * 1000 })} /></Field>
        <Field label="Z (fundo)"><NumberInput value={item.z / 1000} step={0.1} min={-1000} suffix="m" onChange={(v) => set({ z: v * 1000 })} /></Field>
      </div>

      {item.kind === 'painel' ? (
        <p className="hint">
          {panel
            ? `Largura e altura vêm do painel: ${meters(panel.widthMm)}×${meters(panel.heightMm)}m.`
            : 'Escolha um painel do projeto.'}
        </p>
      ) : (
        <div className="grid3">
          <Field label="Largura"><NumberInput value={item.wMm / 1000} step={0.1} min={0.01} suffix="m" onChange={(v) => set({ wMm: v * 1000 })} /></Field>
          <Field label={item.kind === 'maoFrancesa' ? 'Cateto vert.' : 'Altura'}>
            <NumberInput value={item.hMm / 1000} step={0.1} min={0.01} suffix="m" onChange={(v) => set({ hMm: v * 1000 })} />
          </Field>
          <Field label={item.kind === 'maoFrancesa' ? 'Cateto horiz.' : 'Profundidade'}>
            <NumberInput value={item.dMm / 1000} step={0.1} min={0.01} suffix="m" onChange={(v) => set({ dMm: v * 1000 })} />
          </Field>
        </div>
      )}

      <div className="grid3">
        {item.kind === 'praticavel' ? (
          <Field label="Perna (regulagem)">
            <NumberInput value={item.legMm / 1000} step={0.05} min={0} suffix="m" onChange={(v) => set({ legMm: v * 1000 })} />
          </Field>
        ) : null}
        <Field label="Repetições"><NumberInput value={item.count} step={1} min={1} onChange={(v) => set({ count: Math.round(v) })} /></Field>
        {item.count > 1 ? (
          <Field label="Passo"><NumberInput value={item.stepMm / 1000} step={0.1} min={0.01} suffix="m" onChange={(v) => set({ stepMm: v * 1000 })} /></Field>
        ) : null}
      </div>
    </div>
  )
}
