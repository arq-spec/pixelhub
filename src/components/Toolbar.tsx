import { useState, type ChangeEvent, type Dispatch } from 'react'
import type { Project } from '../types'
import type { Action } from '../lib/store'
import { hydrate } from '../lib/store'
import {
  exportAllAsSinglePdf, exportAllAsZip, exportProjectJson, exportSheet,
  type ExportFormat,
} from '../lib/export'

export function Toolbar({
  project, dispatch,
}: { project: Project; dispatch: Dispatch<Action> }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  /** Serializa as exportações: gerar PDF é pesado e não deve empilhar. */
  const run = async (key: string, task: () => Promise<void> | void) => {
    if (busy) return
    setBusy(key)
    setError(null)
    try {
      await task()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao exportar.')
    } finally {
      setBusy(null)
    }
  }

  const one = (format: ExportFormat) =>
    run(`one-${format}`, () => exportSheet(project, project.activeIndex, format))
  const all = (format: ExportFormat) => run(`all-${format}`, () => exportAllAsZip(project, format))

  const openJson = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const loaded = hydrate(JSON.parse(String(reader.result)))
        if (!loaded) throw new Error('Arquivo sem folhas válidas.')
        dispatch({ type: 'load', project: loaded })
        setError(null)
      } catch {
        setError('Não foi possível ler este arquivo de projeto.')
      }
    }
    reader.readAsText(file)
  }

  const label = (key: string, text: string) => (busy === key ? 'Gerando…' : text)
  const total = project.sheets.length

  return (
    <header className="toolbar">
      <div className="toolbar__brand">
        <span className="toolbar__mark" aria-hidden="true" />
        <div>
          <strong>PixelHub</strong>
          <small>Folhas técnicas de painel de LED</small>
        </div>
      </div>

      <div className="toolbar__group">
        <span className="toolbar__title">Folha atual</span>
        <button className="btn btn--primary" disabled={!!busy} onClick={() => one('pdf')}>
          {label('one-pdf', 'PDF')}
        </button>
        <button className="btn btn--ghost" disabled={!!busy} onClick={() => one('svg')}>
          {label('one-svg', 'SVG')}
        </button>
        <button className="btn btn--ghost" disabled={!!busy} onClick={() => one('dxf')}>
          {label('one-dxf', 'DXF')}
        </button>
      </div>

      <div className="toolbar__group">
        <span className="toolbar__title">Todas ({total})</span>
        <button
          className="btn btn--primary"
          disabled={!!busy}
          onClick={() => run('all-pdf-single', () => exportAllAsSinglePdf(project))}
        >
          {label('all-pdf-single', 'PDF único')}
        </button>
        <button className="btn btn--ghost" disabled={!!busy} onClick={() => all('pdf')}>
          {label('all-pdf', 'PDF .zip')}
        </button>
        <button className="btn btn--ghost" disabled={!!busy} onClick={() => all('svg')}>
          {label('all-svg', 'SVG .zip')}
        </button>
        <button className="btn btn--ghost" disabled={!!busy} onClick={() => all('dxf')}>
          {label('all-dxf', 'DXF .zip')}
        </button>
      </div>

      <div className="toolbar__group toolbar__group--end">
        <button className="btn btn--ghost" onClick={() => exportProjectJson(project)}>
          Salvar projeto
        </button>
        <label className="btn btn--ghost">
          Abrir
          <input type="file" accept="application/json,.json" hidden onChange={openJson} />
        </label>
        <button
          className="btn btn--danger"
          onClick={() => {
            if (window.confirm('Descartar o projeto atual e começar do zero?')) {
              dispatch({ type: 'reset' })
            }
          }}
        >
          Novo
        </button>
      </div>

      {error ? <p className="toolbar__error" role="alert">{error}</p> : null}
    </header>
  )
}
