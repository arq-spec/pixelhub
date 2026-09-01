import { useState, type Dispatch } from 'react'
import { RIG_LABELS, type Project, type RigItem, type RigKind, type Sheet } from '../types'
import type { Action } from '../lib/store'
import { rigBounds, rigFaces } from '../lib/rigScene'
import { VIEWS, VIEW_LABELS, type ViewId } from '../lib/scene3d'
import { meters } from '../lib/format'
import { Button, Field, NumberInput, Section, TextInput, Toggle } from './ui'

/**
 * Lista das montagens do projeto.
 *
 * Aqui ficam os números — quais peças a montagem tem, de que tamanho, a que
 * altura. A composição em si é feita no ambiente 3D, para onde cada cartão
 * leva.
 */
export function RigEditor({
  project, sheet, index, dispatch, onOpenStudio,
}: {
  project: Project
  sheet: Sheet
  index: number
  dispatch: Dispatch<Action>
  onOpenStudio: (rigId: string) => void
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const rigs = project.rigs

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
          <p>Ela abre na aba <strong>Ambiente 3D</strong>, no alto da área de desenho.</p>
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

                <div className="shape__modes">
                  <Button variant="primary" onClick={() => onOpenStudio(rig.id)}>
                    Abrir no ambiente 3D
                  </Button>
                </div>
                <p className="hint">
                  No ambiente 3D a montagem é composta no arrasto: as peças andam pelo piso,
                  a vista gira e as cotas conferem as alturas.
                </p>

                <div className="chips">
                  {(Object.keys(VIEWS) as ViewId[]).map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={`chip${rig.view === v ? ' is-on' : ''}`}
                      title="Define a vista que a folha desenha"
                      onClick={() => dispatch({ type: 'patchRig', rigId: rig.id, patch: { view: v } })}
                    >
                      {VIEW_LABELS[v]}
                    </button>
                  ))}
                </div>
                <p className="hint">A vista marcada é a que sai na folha.</p>

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

    </Section>
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
