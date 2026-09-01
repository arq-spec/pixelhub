import { type Dispatch } from 'react'
import type { Project, Sheet } from '../types'
import type { Action } from '../lib/store'
import { rigBounds, rigFaces } from '../lib/rigScene'
import { VIEW_LABELS } from '../lib/scene3d'
import { meters } from '../lib/format'
import { Button, Section } from './ui'

/**
 * As montagens do projeto, do ponto de vista da folha.
 *
 * Aqui só se decide o que a prancha desenha: a composição em si, as peças e as
 * cotas são assunto do ambiente 3D, e cada linha leva até lá.
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
            Ela se compõe na aba <strong>Ambiente 3D</strong>, no alto da área de desenho.
          </p>
          <Button variant="primary" onClick={() => dispatch({ type: 'addRig' })}>
            Criar montagem 3D
          </Button>
        </div>
      ) : (
        <p className="hint">
          A caixa de seleção decide se a montagem entra <strong>nesta</strong> folha. Para
          compor, cotar ou mexer nas peças, abra o ambiente 3D.
        </p>
      )}

      {rigs.map((rig) => {
        const active = sheet.activeRigIds.includes(rig.id)
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
                onClick={() => onOpenStudio(rig.id)}
              >
                <strong>{rig.name || 'MONTAGEM'}</strong>
                <small>
                  {rig.items.length} peça{rig.items.length === 1 ? '' : 's'} ·{' '}
                  {meters(dims.wMm)}×{meters(dims.hMm)}×{meters(dims.dMm)}m ·{' '}
                  {VIEW_LABELS[rig.view]}
                </small>
              </button>
              <span className="pcard__actions">
                <Button onClick={() => onOpenStudio(rig.id)} title="Abrir no ambiente 3D">
                  Abrir 3D
                </Button>
              </span>
            </header>
          </div>
        )
      })}
    </Section>
  )
}
