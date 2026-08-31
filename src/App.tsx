import { useProject } from './lib/store'
import { Toolbar } from './components/Toolbar'
import { ProjectPanel } from './components/ProjectPanel'
import { SheetList } from './components/SheetList'
import { PanelInspector } from './components/PanelInspector'
import { SheetPreview } from './components/SheetPreview'
import { sheetNumber } from './lib/layout'

export default function App() {
  const { project, dispatch, active } = useProject()
  const index = project.activeIndex

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
            <span>
              Folha <strong>{sheetNumber(active, index)}</strong> de {project.sheets.length}
            </span>
            <span className="preview__format">A3 paisagem · 420 × 297 mm</span>
          </div>
          <div className="preview__stage">
            <SheetPreview project={project} sheet={active} index={index} />
          </div>
        </main>

        <aside className="panel panel--right">
          <PanelInspector project={project} sheet={active} index={index} dispatch={dispatch} />
        </aside>
      </div>
    </div>
  )
}
