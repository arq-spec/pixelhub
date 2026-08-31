import type { Dispatch } from 'react'
import {
  FIELD_LABELS, FIELD_ORDER, PITCHES, POWER_KVA_PER_M2, WEIGHT_KG_PER_M2,
  type PanelConfig, type PitchId, type Project, type Sheet,
} from '../types'
import { syncPitchNote, type Action } from '../lib/store'
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
  sheet, index, dispatch,
}: { project: Project; sheet: Sheet; index: number; dispatch: Dispatch<Action> }) {
  const setSheet = (patch: Partial<Omit<Sheet, 'panels'>>) =>
    dispatch({ type: 'patchSheet', index, patch })

  const totals = sheet.panels.reduce(
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
        title={`Painéis nesta folha (${sheet.panels.length})`}
        action={
          <Button variant="primary" onClick={() => dispatch({ type: 'addPanel', index })}>
            + Painel
          </Button>
        }
      >
        {sheet.panels.map((panel, pi) => (
          <PanelCard
            key={pi}
            panel={panel}
            panelIndex={pi}
            total={sheet.panels.length}
            index={index}
            dispatch={dispatch}
            onPitchNote={(label) => setSheet({ notes: syncPitchNote(sheet.notes, label) })}
          />
        ))}
        {sheet.panels.length > 1 ? (
          <dl className="metrics metrics--totals">
            <Metric label="Área somada" value={`${num(totals.area, 2)} m²`} />
            <Metric label="Peso somado" value={`${num(totals.weight, 1)} kg`} />
            <Metric label="Consumo somado" value={`${num(totals.power, 2)} kVA`} />
            <Metric label="Módulos somados" value={`${totals.modules}`} />
          </dl>
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
        <Button
          onClick={() =>
            setSheet({
              notes: syncPitchNote(sheet.notes, PITCHES[sheet.panels[0].pitch].label, true),
            })
          }
        >
          + Inserir pitch nas observações
        </Button>
      </Section>
    </>
  )
}

function PanelCard({
  panel, panelIndex, total, index, dispatch, onPitchNote,
}: {
  panel: PanelConfig
  panelIndex: number
  total: number
  index: number
  dispatch: Dispatch<Action>
  onPitchNote: (label: string) => void
}) {
  const m = computeMetrics(panel)
  const setPanel = (patch: Partial<PanelConfig>) =>
    dispatch({ type: 'patchPanel', index, panelIndex, patch })

  return (
    <div className="pcard">
      <header className="pcard__head">
        <strong>{panel.name || `PAINEL ${panelIndex + 1}`}</strong>
        <span className="pcard__actions">
          <Button
            variant="icon" title="Mover para cima"
            disabled={panelIndex === 0}
            onClick={() => dispatch({ type: 'movePanel', index, panelIndex, delta: -1 })}
          >
            ↑
          </Button>
          <Button
            variant="icon" title="Mover para baixo"
            disabled={panelIndex === total - 1}
            onClick={() => dispatch({ type: 'movePanel', index, panelIndex, delta: 1 })}
          >
            ↓
          </Button>
          <Button
            variant="icon" title="Duplicar painel"
            onClick={() => dispatch({ type: 'duplicatePanel', index, panelIndex })}
          >
            ⧉
          </Button>
          <Button
            variant="icon" title="Remover painel"
            disabled={total <= 1}
            onClick={() => dispatch({ type: 'removePanel', index, panelIndex })}
          >
            ✕
          </Button>
        </span>
      </header>

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
            value={panel.widthMm / 1000}
            step={0.01} min={0.01} suffix="m"
            onChange={(v) => setPanel({ widthMm: v * 1000 })}
          />
        </Field>
        <Field label="Altura" hint={`${num(panel.heightMm, 0)} mm`}>
          <NumberInput
            value={panel.heightMm / 1000}
            step={0.01} min={0.01} suffix="m"
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
        {MODULE_PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            className={`chip${panel.moduleWMm === p.w && panel.moduleHMm === p.h ? ' is-on' : ''}`}
            onClick={() => setPanel({ moduleWMm: p.w, moduleHMm: p.h })}
          >
            {p.label}
          </button>
        ))}
      </div>

      {m.rows.hasFiller ? (
        <p className="note note--ok">
          A sobra de altura fecha em {m.fillerCount} placa{m.fillerCount > 1 ? 's' : ''} de{' '}
          {meters(m.fillerSizeMm)}×{meters(m.fillerSizeMm)}m, desenhadas na fileira superior.
        </p>
      ) : null}

      {m.hasCut ? (
        <div className="warn">
          <p>O painel não fecha em placas inteiras — o recorte aparece tracejado no desenho.</p>
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
  )
}

function PanelMetrics({ m }: { m: Metrics }) {
  return (
    <dl className="metrics">
      <Metric label="Área total" value={`${num(m.areaM2, 2)} m²`} />
      <Metric label="Peso" value={`${num(m.weightKg, 1)} kg`} note={`${WEIGHT_KG_PER_M2} kg/m²`} />
      <Metric
        label="Consumo"
        value={`${num(m.powerKva, 2)} kVA`}
        note={`${num(POWER_KVA_PER_M2, 1)} kVA/m²`}
      />
      <Metric
        label="Resolução"
        value={`${m.pixelsW} × ${m.pixelsH} px`}
        note={`${num(m.pixelsTotal, 0)} px totais`}
      />
      <Metric
        label="Módulos"
        value={`${m.cols.total} × ${m.rows.total}`}
        note={`${m.moduleCount} unidades`}
      />
      <Metric
        label="Px por módulo"
        value={`${m.cols.pixelsPerModule} × ${m.rows.pixelsPerModule}`}
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
