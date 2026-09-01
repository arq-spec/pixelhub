import { type Dispatch } from 'react'
import {
  RIG_LABELS,
  type Project, type Rig, type RigItem, type RigKind, type Sheet,
} from '../types'
import type { Action } from '../lib/store'
import { markPoint } from '../lib/rigScene'
import { VIEWS, VIEW_LABELS, type ViewId } from '../lib/scene3d'
import { meters } from '../lib/format'
import { Button, Field, NumberInput, Section, TextInput, Toggle } from './ui'

/**
 * Painel de edição do ambiente 3D.
 *
 * Enquanto a aba aberta é a do ambiente, a coluna da direita fala da montagem
 * — a folha técnica tem os controles dela e não faz falta aqui. É a mesma
 * montagem que a tela mostra: o que se seleciona lá aparece marcado aqui.
 */
export function RigInspector({
  project, sheet, index, dispatch, rigId, onRigId, selectedId, onSelect, marking, onMarking,
}: {
  project: Project
  sheet: Sheet
  index: number
  dispatch: Dispatch<Action>
  rigId: string | null
  onRigId: (id: string | null) => void
  selectedId: string | null
  onSelect: (id: string | null) => void
  marking: boolean
  onMarking: (on: boolean) => void
}) {
  const rigs = project.rigs
  const rig = rigs.find((r) => r.id === rigId) ?? rigs[0] ?? null

  if (!rig) {
    return (
      <Section title="Ambiente 3D">
        <p className="hint">
          Nenhuma montagem no projeto. Crie a primeira na área de desenho, à esquerda.
        </p>
        <Button variant="primary" onClick={() => dispatch({ type: 'addRig' })}>
          + Montagem
        </Button>
      </Section>
    )
  }

  const set = (patch: Partial<Omit<Rig, 'items'>>) =>
    dispatch({ type: 'patchRig', rigId: rig.id, patch })
  const active = sheet.activeRigIds.includes(rig.id)

  return (
    <>
      <Section
        title="Montagem"
        action={
          <Button variant="primary" onClick={() => dispatch({ type: 'addRig' })}>
            + Montagem
          </Button>
        }
      >
        {rigs.length > 1 ? (
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
          </div>
        ) : null}

        <Field label="Nome" wide>
          <TextInput value={rig.name} upper onChange={(v) => set({ name: v })} />
        </Field>

        <Field label="Vista que sai na folha" wide>
          <div className="chips">
            {(Object.keys(VIEWS) as ViewId[]).map((v) => (
              <button
                key={v}
                type="button"
                className={`chip${rig.view === v ? ' is-on' : ''}`}
                onClick={() => set({ view: v })}
              >
                {VIEW_LABELS[v]}
              </button>
            ))}
          </div>
        </Field>

        <Toggle
          checked={active}
          onChange={(v) => dispatch({ type: 'toggleRig', index, rigId: rig.id, active: v })}
          label="Desenhar esta montagem na folha aberta"
        />
        <Toggle
          checked={rig.showGround}
          onChange={(v) => set({ showGround: v })}
          label="Mostrar o piso"
        />

        <Button onClick={() => dispatch({ type: 'removeRig', rigId: rig.id })}>
          Excluir montagem
        </Button>
      </Section>

      <Section title={`Cotas (${rig.marks.length})`}>
        <p className="hint">
          A cota sai de dois vértices: clique em <strong>Cotar</strong>, na barra da tela, e
          aponte os dois pontos. Ela fica presa às peças — mover a peça leva a medida junto.
        </p>
        <Button variant={marking ? 'primary' : undefined} onClick={() => onMarking(!marking)}>
          {marking ? 'Cotando — clique nos vértices' : 'Marcar cota'}
        </Button>

        {rig.marks.map((mark, i) => {
          const a = markPoint(rig, mark.a)
          const b = markPoint(rig, mark.b)
          const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
          return (
            <div key={mark.id} className="region">
              <span className="region__size">COTA {String(i + 1).padStart(2, '0')}</span>
              <strong style={{ flex: 1, fontSize: 12 }}>{meters(len)} m</strong>
              <Button
                variant="icon" title="Remover cota"
                onClick={() => dispatch({ type: 'removeRigMark', rigId: rig.id, markId: mark.id })}
              >
                ✕
              </Button>
            </div>
          )
        })}

        {rig.marks.length ? (
          <Button onClick={() => dispatch({ type: 'clearRigMarks', rigId: rig.id })}>
            Limpar cotas
          </Button>
        ) : null}

        <hr className="rule" />
        <Toggle
          checked={rig.showDimensions}
          onChange={(v) => set({ showDimensions: v })}
          label="Cotar sozinho as medidas gerais"
        />
        <p className="hint">
          As automáticas medem a montagem inteira e as alturas do painel e do praticável.
          Ficam desligadas por padrão: quase sempre a medida que importa é outra.
        </p>
      </Section>

      <Section title={`Peças (${rig.items.length})`}>
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

        {rig.items.length === 0 ? (
          <p className="hint">Nenhuma peça ainda. Comece pelo painel de LED.</p>
        ) : null}

        {rig.items.map((item) => (
          <RigItemCard
            key={item.id}
            rigId={rig.id}
            item={item}
            project={project}
            dispatch={dispatch}
            selected={item.id === selectedId}
            onSelect={() => onSelect(item.id)}
          />
        ))}
      </Section>
    </>
  )
}

/** Cartão de uma peça: o que ela é, onde está e de que tamanho. */
export function RigItemCard({
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
