import { useState } from 'react'
import { useProject } from './lib/store'
import { Toolbar } from './components/Toolbar'
import { ProjectPanel } from './components/ProjectPanel'
import { SheetList } from './components/SheetList'
import { PanelInspector } from './components/PanelInspector'
import { SheetPreview } from './components/SheetPreview'
import { Studio3D } from './components/Studio3D'
import { sheetNumber } from './lib/layout'

/** As duas vistas do projeto: a prancha e a montagem. */
type Workspace = 'folha' | 'ambiente'

export default function App() {
  const { project, dispatch, active } = useProject()
  const index = project.activeIndex
  const [workspace, setWorkspace] = useState<Workspace>('folha')
  const [studioRigId, setStudioRigId] = useState<string | null>(null)

  const openStudio = (rigId: string) => {
    setStudioRigId(rigId)
    setWorkspace('ambiente')
  }

  return (
    <div className="app">
      <Toolbar project={project} dispatch={dispatch} />

      <div className="app__body">
        <aside className="panel panel--left">
          <ProjectPanel project={project} dispatch={dispatch} />
          <SheetList project={project} dispatch={dispatch} />
        </aside>

        <main className="preview">
          <div className="preview__bar">
            <div className="tabs">
              <button
                type="button"
                className={`tab${workspace === 'folha' ? ' is-on' : ''}`}
                onClick={() => setWorkspace('folha')}
              >
                Folha técnica
              </button>
              <button
                type="button"
                className={`tab${workspace === 'ambiente' ? ' is-on' : ''}`}
                onClick={() => setWorkspace('ambiente')}
              >
                Ambiente 3D
              </button>
            </div>
            {workspace === 'folha' ? (
              <span>
                Folha <strong>{sheetNumber(active, index)}</strong> de {project.sheets.length} ·{' '}
                <span className="preview__format">A3 paisagem · 420 × 297 mm</span>
              </span>
            ) : (
              <span className="preview__format">
                A vista marcada é a que entra na folha
              </span>
            )}
          </div>

          {workspace === 'folha' ? (
            <div className="preview__stage">
              <SheetPreview project={project} sheet={active} index={index} />
            </div>
          ) : (
            <Studio3D
              project={project}
              sheet={active}
              index={index}
              dispatch={dispatch}
              rigId={studioRigId}
              onRigId={setStudioRigId}
            />
          )}
        </main>

        <aside className="panel panel--right">
          <PanelInspector
            project={project}
            sheet={active}
            index={index}
            dispatch={dispatch}
            onOpenStudio={openStudio}
          />
        </aside>
      </div>
    </div>
  )
}
