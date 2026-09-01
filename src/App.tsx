import { useState } from 'react'
import { useProject } from './lib/store'
import { Toolbar } from './components/Toolbar'
import { ProjectPanel } from './components/ProjectPanel'
import { SheetList } from './components/SheetList'
import { PanelInspector } from './components/PanelInspector'
import { SheetPreview } from './components/SheetPreview'
import { Studio3D } from './components/Studio3D'
import { RigInspector } from './components/RigInspector'
import { sheetNumber } from './lib/layout'

/** As duas vistas do projeto: a prancha e a montagem. */
type Workspace = 'folha' | 'ambiente'

export default function App() {
  const { project, dispatch, active } = useProject()
  const index = project.activeIndex
  const [workspace, setWorkspace] = useState<Workspace>('folha')
  // Estado do ambiente 3D, compartilhado entre a tela e a coluna da direita:
  // selecionar uma peça num lado a marca no outro.
  const [studioRigId, setStudioRigId] = useState<string | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [marking, setMarking] = useState(false)

  const openStudio = (rigId: string) => {
    setStudioRigId(rigId)
    setWorkspace('ambiente')
  }

  const show = (next: Workspace) => {
    setWorkspace(next)
    if (next === 'folha') setMarking(false)
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
                onClick={() => show('folha')}
              >
                Folha técnica
              </button>
              <button
                type="button"
                className={`tab${workspace === 'ambiente' ? ' is-on' : ''}`}
                onClick={() => show('ambiente')}
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
              selectedId={selectedItemId}
              onSelect={setSelectedItemId}
              marking={marking}
              onMarking={setMarking}
            />
          )}
        </main>

        {/* A coluna da direita segue a aba: cada ambiente tem os seus controles. */}
        <aside className="panel panel--right">
          {workspace === 'folha' ? (
            <PanelInspector
              project={project}
              sheet={active}
              index={index}
              dispatch={dispatch}
              onOpenStudio={openStudio}
            />
          ) : (
            <RigInspector
              project={project}
              sheet={active}
              index={index}
              dispatch={dispatch}
              rigId={studioRigId}
              onRigId={setStudioRigId}
              selectedId={selectedItemId}
              onSelect={setSelectedItemId}
              marking={marking}
              onMarking={setMarking}
            />
          )}
        </aside>
      </div>
    </div>
  )
}
