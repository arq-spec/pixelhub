import { useState, type Dispatch } from 'react'
import {
  FIELD_LABELS, FIELD_ORDER, PITCHES, POWER_KVA_PER_M2, WEIGHT_KG_PER_M2,
  type PanelConfig, type PitchId, type Project, type Sheet,
} from '../types'
import { sheetPanels, syncPitchNote, type Action } from '../lib/store'
import { computeMetrics, snapToModule, type Metrics } from '../lib/calc'
import { meters, num } from '../lib/format'
import { Button, Field, NumberInput, Section, TextInput, Toggle } from './ui'

const MODULE_PRESETS = [
  { label: '500 × 500', w: 500, h: 500 },
  { label: '500 × 1000', w: 500, h: 1000 },
  { label: '480 × 485', w: 480, h: 485 },
  { label: '600 × 337,5', w: 600, h: 337.5 },
]

export function PanelInspector({
  project, sheet, index, dispatch,
}: { project: Project; sheet: Sheet; index: number; dispatch: Dispatch<Action> }) {
  // Recolher é estado de tela, não do documento: some ao recarregar de
  // propósito, para a lista sempre abrir no mesmo estado conhecido.
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    project.panels.length === 1 ? { [project.panels[0].id]: true } : {},
  )

  const setSheet = (patch: Partial<Omit<Sheet, 'activePanelIds'>>) =>
    dispatch({ type: 'patchSheet', index, patch })

  const active = sheetPanels(project, sheet)
  const totals = active.reduce(
    (acc, p) => {
      const m = computeMetrics(p)
      return {
        area: acc.area + m.areaM2,
        weight: acc.weight + m.weightKg,
        power: acc.power + m.powerKva,
        modules: acc.modules + m.moduleCount,
      }
    },
    { area: 0, weight: 0, power: 0, modules: 0 },
  )

  const allOpen = project.panels.every((p) => expanded[p.id])
  const toggleAll = () =>
    setExpanded(
      allOpen ? {} : Object.fromEntries(project.panels.map((p) => [p.id, true])),
    )

  return (
    <>
      <Section title="Folha">
        <Field label="Título da folha (carimbo)" wide>
          <TextInput value={sheet.title} onChange={(v) => setSheet({ title: v })} upper />
        </Field>
        <Toggle
          checked={sheet.showDimensions}
          onChange={(v) => setSheet({ showDimensions: v })}
          label="Mostrar cotas de largura e altura"
        />
      </Section>

      <Section
        title={`Painéis do projeto (${active.length}/${project.panels.length})`}
        action={
          <span className="rowactions">
            <Button onClick={toggleAll} title={allOpen ? 'Recolher todos' : 'Expandir todos'}>
              {allOpen ? 'Recolher' : 'Expandir'}
            </Button>
            <Button variant="primary" onClick={() => dispatch({ type: 'addPanel' })}>
              + Painel
            </Button>
          </span>
        }
      >
        <p className="hint">
          O painel pertence ao projeto: editar aqui vale para <strong>todas</strong> as folhas
          que o usam. A caixa de seleção decide se ele aparece <strong>nesta</strong> folha —
          desmarcar não apaga nada.
        </p>

        {project.panels.map((panel) => (
          <PanelCard
            key={panel.id}
            panel={panel}
            project={project}
            index={index}
            isActive={sheet.activePanelIds.includes(panel.id)}
            isOpen={!!expanded[panel.id]}
            onToggleOpen={() =>
              setExpanded((e) => ({ ...e, [panel.id]: !e[panel.id] }))
            }
            dispatch={dispatch}
            onPitchNote={(label) => setSheet({ notes: syncPitchNote(sheet.notes, label) })}
          />
        ))}

        {active.length > 1 ? (
          <dl className="metrics metrics--totals">
            <Metric label="Área somada" value={`${num(totals.area, 2)} m²`} />
            <Metric label="Peso somado" value={`${num(totals.weight, 1)} kg`} />
            <Metric label="Consumo somado" value={`${num(totals.power, 2)} kVA`} />
            <Metric label="Módulos somados" value={`${totals.modules}`} />
          </dl>
        ) : null}

        {active.length === 0 ? (
          <p className="note note--warn">
            Nenhum painel ativo nesta folha — a prancha sai vazia, só com legendas e carimbo.
          </p>
        ) : null}
      </Section>

      <Section title="Informações na folha">
        <p className="hint">
          Cada item ligado vira uma linha do quadro de dados, abaixo de todo desenho da folha.
        </p>
        <div className="fieldlist">
          {FIELD_ORDER.map((id) => (
            <Toggle
              key={id}
              checked={sheet.fields[id] !== false}
              onChange={(v) => dispatch({ type: 'toggleField', index, field: id, value: v })}
              label={FIELD_LABELS[id]}
            />
          ))}
        </div>
      </Section>

      <Section title="Observações (legendas)">
        <textarea
          className="input input--area"
          rows={5}
          value={sheet.notes.join('\n')}
          placeholder="Uma observação por linha"
          onChange={(e) => setSheet({ notes: e.target.value.split('\n') })}
        />
        {active.length ? (
          <Button
            onClick={() =>
              setSheet({ notes: syncPitchNote(sheet.notes, PITCHES[active[0].pitch].label, true) })
            }
          >
            + Inserir pitch nas observações
          </Button>
        ) : null}
      </Section>
    </>
  )
}

function PanelCard({
  panel, project, index, isActive, isOpen, onToggleOpen, dispatch, onPitchNote,
}: {
  panel: PanelConfig
  project: Project
  index: number
  isActive: boolean
  isOpen: boolean
  onToggleOpen: () => void
  dispatch: Dispatch<Action>
  onPitchNote: (label: string) => void
}) {
  const m = computeMetrics(panel)
  const at = project.panels.findIndex((p) => p.id === panel.id)
  const setPanel = (patch: Partial<PanelConfig>) =>
    dispatch({ type: 'patchPanel', panelId: panel.id, patch })

  /** Em quantas folhas este painel aparece — editar aqui alcança todas elas. */
  const usedIn = project.sheets.filter((s) => s.activePanelIds.includes(panel.id)).length

  return (
    <div className={`pcard${isActive ? '' : ' pcard--off'}`}>
      <header className="pcard__head">
        <label className="pcard__check" title="Ativo nesta folha">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) =>
              dispatch({
                type: 'togglePanel', index, panelId: panel.id, active: e.target.checked,
              })
            }
          />
        </label>

        <button type="button" className="pcard__summary" onClick={onToggleOpen}>
          <strong>{panel.name || `PAINEL ${at + 1}`}</strong>
          <small>
            {meters(panel.widthMm)}×{meters(panel.heightMm)}m · {panel.pitch} ·{' '}
            {m.moduleCount} mód.
            {usedIn > 1 ? ` · em ${usedIn} folhas` : ''}
          </small>
        </button>

        <span className="pcard__actions">
          <Button variant="icon" title={isOpen ? 'Recolher' : 'Expandir'} onClick={onToggleOpen}>
            {isOpen ? '▾' : '▸'}
          </Button>
          <Button
            variant="icon" title="Mover para cima" disabled={at === 0}
            onClick={() => dispatch({ type: 'movePanel', panelId: panel.id, delta: -1 })}
          >
            ↑
          </Button>
          <Button
            variant="icon" title="Mover para baixo" disabled={at === project.panels.length - 1}
            onClick={() => dispatch({ type: 'movePanel', panelId: panel.id, delta: 1 })}
          >
            ↓
          </Button>
          <Button
            variant="icon" title="Duplicar painel no projeto"
            onClick={() => dispatch({ type: 'duplicatePanel', panelId: panel.id })}
          >
            ⧉
          </Button>
          <Button
            variant="icon" title="Excluir do projeto (sai de todas as folhas)"
            disabled={project.panels.length <= 1}
            onClick={() => dispatch({ type: 'removePanel', panelId: panel.id })}
          >
            ✕
          </Button>
        </span>
      </header>

      {isOpen ? (
        <div className="pcard__body">
          <Field label="Nome do painel" wide>
            <TextInput
              value={panel.name}
              onChange={(v) => setPanel({ name: v })}
              placeholder="PAINEL PRINCIPAL"
              upper
            />
          </Field>

          <div className="grid2">
            <Field label="Largura" hint={`${num(panel.widthMm, 0)} mm`}>
              <NumberInput
                value={panel.widthMm / 1000} step={0.01} min={0.01} suffix="m"
                onChange={(v) => setPanel({ widthMm: v * 1000 })}
              />
            </Field>
            <Field label="Altura" hint={`${num(panel.heightMm, 0)} mm`}>
              <NumberInput
                value={panel.heightMm / 1000} step={0.01} min={0.01} suffix="m"
                onChange={(v) => setPanel({ heightMm: v * 1000 })}
              />
            </Field>
          </div>

          <Field label="Pitch" wide>
            <div className="segmented">
              {(Object.keys(PITCHES) as PitchId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`segmented__btn${panel.pitch === id ? ' is-on' : ''}`}
                  onClick={() => {
                    setPanel({ pitch: id })
                    onPitchNote(PITCHES[id].label)
                  }}
                >
                  <strong>{id}</strong>
                  <small>{PITCHES[id].pixelsPerMeter} px/m</small>
                </button>
              ))}
            </div>
          </Field>

          <Field label="Módulo (gabinete)" wide>
            <div className="grid2">
              <NumberInput
                value={panel.moduleWMm} step={5} min={10} suffix="mm"
                onChange={(v) => setPanel({ moduleWMm: v })}
              />
              <NumberInput
                value={panel.moduleHMm} step={5} min={10} suffix="mm"
                onChange={(v) => setPanel({ moduleHMm: v })}
              />
            </div>
          </Field>
          <div className="chips">
            {MODULE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className={`chip${panel.moduleWMm === preset.w && panel.moduleHMm === preset.h ? ' is-on' : ''}`}
                onClick={() => setPanel({ moduleWMm: preset.w, moduleHMm: preset.h })}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {m.rows.hasFiller ? (
            <p className="note note--ok">
              A sobra de altura fecha em {m.fillerCount} placa{m.fillerCount > 1 ? 's' : ''} de{' '}
              {meters(m.fillerSizeMm)}×{meters(m.fillerSizeMm)}m, na fileira superior.
            </p>
          ) : null}

          {m.hasCut ? (
            <div className="warn">
              <p>O painel não fecha em placas inteiras — o recorte aparece tracejado.</p>
              <Button
                onClick={() =>
                  setPanel({
                    widthMm: snapToModule(panel.widthMm, panel.moduleWMm),
                    heightMm: snapToModule(panel.heightMm, panel.moduleHMm),
                  })
                }
              >
                Ajustar para {meters(snapToModule(panel.widthMm, panel.moduleWMm))}×
                {meters(snapToModule(panel.heightMm, panel.moduleHMm))}m
              </Button>
            </div>
          ) : null}

          <PanelMetrics m={m} />
        </div>
      ) : null}
    </div>
  )
}

function PanelMetrics({ m }: { m: Metrics }) {
  return (
    <dl className="metrics">
      <Metric label="Área total" value={`${num(m.areaM2, 2)} m²`} />
      <Metric label="Peso" value={`${num(m.weightKg, 1)} kg`} note={`${WEIGHT_KG_PER_M2} kg/m²`} />
      <Metric
        label="Consumo" value={`${num(m.powerKva, 2)} kVA`}
        note={`${num(POWER_KVA_PER_M2, 1)} kVA/m²`}
      />
      <Metric
        label="Resolução" value={`${m.pixelsW} × ${m.pixelsH} px`}
        note={`${num(m.pixelsTotal, 0)} px totais`}
      />
      <Metric
        label="Módulos" value={`${m.cols.total} × ${m.rows.total}`}
        note={`${m.moduleCount} unidades`}
      />
      <Metric
        label="Px por módulo" value={`${m.cols.pixelsPerModule} × ${m.rows.pixelsPerModule}`}
        note={`${m.pitchLabel} · ${m.pixelsPerMeter} px/m`}
      />
    </dl>
  )
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="metrics__item">
      <dt>{label}</dt>
      <dd>
        {value}
        {note ? <small>{note}</small> : null}
      </dd>
    </div>
  )
}
