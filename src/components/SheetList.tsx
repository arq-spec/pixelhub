import type { Dispatch } from 'react'
import type { Project } from '../types'
import type { Action } from '../lib/store'
import { sheetNumber } from '../lib/layout'
import { meters } from '../lib/format'
import { SheetThumb } from './SheetPreview'
import { Button, Section } from './ui'

export function SheetList({
  project, dispatch,
}: { project: Project; dispatch: Dispatch<Action> }) {
  const hasOverrides = project.sheets.some((s) => s.numberOverride !== null)

  return (
    <Section
      title={`Folhas (${project.sheets.length})`}
      action={
        <Button variant="primary" onClick={() => dispatch({ type: 'addSheet' })} title="Nova folha">
          + Folha
        </Button>
      }
    >
      <ol className="sheets">
        {project.sheets.map((sheet, i) => {
          const active = i === project.activeIndex
          const auto = sheet.numberOverride === null
          return (
            <li key={sheet.id} className={`sheets__item${active ? ' is-active' : ''}`}>
              <button
                type="button"
                className="sheets__open"
                onClick={() => dispatch({ type: 'select', index: i })}
              >
                <span className="sheets__thumb">
                  <SheetThumb project={project} sheet={sheet} index={i} />
                </span>
                <span className="sheets__meta">
                  <strong>{sheet.title || 'SEM TÍTULO'}</strong>
                  <small>
                    {sheet.panels.length > 1
                      ? `${sheet.panels.length} painéis · ${sheet.panels[0].pitch}`
                      : `${sheet.panels[0].name} · ${meters(sheet.panels[0].widthMm)}×${meters(sheet.panels[0].heightMm)}m · ${sheet.panels[0].pitch}`}
                  </small>
                </span>
              </button>

              <div className="sheets__row">
                <label className="numbox" title="Numeração desta folha">
                  <span>FOLHA</span>
                  <input
                    type="text"
                    value={sheetNumber(sheet, i)}
                    className={auto ? 'numbox__input is-auto' : 'numbox__input'}
                    onChange={(e) =>
                      dispatch({
                        type: 'patchSheet',
                        index: i,
                        patch: { numberOverride: e.target.value },
                      })
                    }
                  />
                </label>
                {auto ? (
                  <span className="tag tag--auto">auto</span>
                ) : (
                  <button
                    type="button"
                    className="tag tag--manual"
                    title="Voltar para a numeração automática"
                    onClick={() =>
                      dispatch({ type: 'patchSheet', index: i, patch: { numberOverride: null } })
                    }
                  >
                    manual ✕
                  </button>
                )}

                <span className="sheets__spacer" />

                <Button
                  variant="icon"
                  title="Mover para cima"
                  disabled={i === 0}
                  onClick={() => dispatch({ type: 'moveSheet', index: i, delta: -1 })}
                >
                  ↑
                </Button>
                <Button
                  variant="icon"
                  title="Mover para baixo"
                  disabled={i === project.sheets.length - 1}
                  onClick={() => dispatch({ type: 'moveSheet', index: i, delta: 1 })}
                >
                  ↓
                </Button>
                <Button
                  variant="icon"
                  title="Duplicar folha"
                  onClick={() => dispatch({ type: 'duplicateSheet', index: i })}
                >
                  ⧉
                </Button>
                <Button
                  variant="icon"
                  title="Excluir folha"
                  disabled={project.sheets.length <= 1}
                  onClick={() => dispatch({ type: 'removeSheet', index: i })}
                >
                  ✕
                </Button>
              </div>
            </li>
          )
        })}
      </ol>

      <p className="hint">
        A numeração segue a ordem da lista. Digite no campo <strong>FOLHA</strong> para fixar um
        número só naquela folha — ela deixa de acompanhar a sequência.
      </p>
      {hasOverrides ? (
        <Button onClick={() => dispatch({ type: 'clearOverrides' })}>
          Renumerar todas em sequência
        </Button>
      ) : null}
    </Section>
  )
}
