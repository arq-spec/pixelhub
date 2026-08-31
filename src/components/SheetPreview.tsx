import { useMemo } from 'react'
import type { Project, Sheet } from '../types'
import { buildSheetLayout } from '../lib/layout'
import { renderSvg } from '../lib/export/svg'

/**
 * A pré-visualização usa exatamente o mesmo SVG que vai para o arquivo — o que
 * aparece na tela é o que sai no PDF, no SVG e (com a mesma geometria) no DXF.
 */
export function SheetPreview({
  project, sheet, index,
}: { project: Project; sheet: Sheet; index: number }) {
  const markup = useMemo(
    () => renderSvg(buildSheetLayout(project, sheet, index)),
    [project, sheet, index],
  )
  return (
    <div className="preview__paper" dangerouslySetInnerHTML={{ __html: markup }} />
  )
}

export function SheetThumb({
  project, sheet, index,
}: { project: Project; sheet: Sheet; index: number }) {
  const markup = useMemo(
    () => renderSvg(buildSheetLayout(project, sheet, index)),
    [project, sheet, index],
  )
  return <div className="thumb__paper" dangerouslySetInnerHTML={{ __html: markup }} />
}
