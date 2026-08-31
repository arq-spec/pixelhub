import type { Dispatch } from 'react'
import {
  PITCHES, POWER_KVA_PER_M2, WEIGHT_KG_PER_M2,
  type PanelConfig, type PitchId, type Project, type Sheet,
} from '../types'
import { syncPitchNote, type Action } from '../lib/store'
import { computeMetrics, snapToModule } from '../lib/calc'
import { buildSheetLayout } from '../lib/layout'
import { meters, num } from '../lib/format'
import { SCALE_LADDER } from '../lib/sheetSpec'
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
  const panel = sheet.panel
  const m = computeMetrics(panel)
  const layout = buildSheetLayout(project, sheet, index)

  const setPanel = (patch: Partial<PanelConfig>) =>
    dispatch({ type: 'patchPanel', index, patch })
  const setSheet = (patch: Partial<Omit<Sheet, 'panel'>>) =>
    dispatch({ type: 'patchSheet', index, patch })

  const snap = () =>
    setPanel({
      widthMm: snapToModule(panel.widthMm, panel.moduleWMm),
      heightMm: snapToModule(panel.heightMm, panel.moduleHMm),
    })

  return (
    <>
      <Section title="Painel de LED">
        <Field label="Título da folha (carimbo)" wide>
          <TextInput value={sheet.title} onChange={(v) => setSheet({ title: v })} upper />
        </Field>

        <Field label="Nome do painel (título do desenho)" wide>
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
              step={0.01}
              min={0.01}
              suffix="m"
              onChange={(v) => setPanel({ widthMm: v * 1000 })}
            />
          </Field>
          <Field label="Altura" hint={`${num(panel.heightMm, 0)} mm`}>
            <NumberInput
              value={panel.heightMm / 1000}
              step={0.01}
              min={0.01}
              suffix="m"
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
                onClick={() => setPanel({ pitch: id })}
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
              value={panel.moduleWMm}
              step={5}
              min={10}
              suffix="mm"
              onChange={(v) => setPanel({ moduleWMm: v })}
            />
            <NumberInput
              value={panel.moduleHMm}
              step={5}
              min={10}
              suffix="mm"
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

        {m.hasPartial ? (
          <div className="warn">
            <p>
              O painel não fecha em módulos inteiros — o recorte aparece tracejado no desenho.
            </p>
            <Button onClick={snap}>
              Ajustar para {meters(snapToModule(panel.widthMm, panel.moduleWMm))}×
              {meters(snapToModule(panel.heightMm, panel.moduleHMm))}m
            </Button>
          </div>
        ) : null}
      </Section>

      <Section title="Resultado">
        <dl className="metrics">
          <Metric label="Área total" value={`${num(m.areaM2, 2)} m²`} />
          <Metric
            label="Peso"
            value={`${num(m.weightKg, 1)} kg`}
            note={`${WEIGHT_KG_PER_M2} kg/m²`}
          />
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
      </Section>

      <Section title="Desenho">
        <Field label="Escala" wide>
          <select
            className="input"
            value={sheet.scaleDenominator ?? ''}
            onChange={(e) =>
              setSheet({ scaleDenominator: e.target.value ? Number(e.target.value) : null })
            }
          >
            <option value="">Automática (1:{num(layout.scaleDenominator, layout.scaleDenominator % 1 ? 1 : 0)})</option>
            {SCALE_LADDER.map((s) => (
              <option key={s} value={s}>
                1:{num(s, s % 1 ? 1 : 0)}
              </option>
            ))}
          </select>
        </Field>

        <Toggle
          checked={sheet.showDimensions}
          onChange={(v) => setSheet({ showDimensions: v })}
          label="Mostrar cotas de largura e altura"
        />
      </Section>

      <Section title="Observações (legendas)">
        <textarea
          className="input input--area"
          rows={5}
          value={sheet.notes.join('\n')}
          placeholder={'Uma observação por linha'}
          onChange={(e) => setSheet({ notes: e.target.value.split('\n') })}
        />
        <Button onClick={() => setSheet({ notes: syncPitchNote(sheet.notes, m.pitchLabel, true) })}>
          + Inserir pitch nas observações
        </Button>
      </Section>
    </>
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
