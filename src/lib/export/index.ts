import JSZip from 'jszip'
import type { Project } from '../../types'
import { buildSheetLayout, sheetNumber, type SheetLayout } from '../layout'
import { slug } from '../format'
import { downloadBlob, downloadText } from './download'
import { sheetToPdfBlob, sheetsToPdfBlob } from './pdf'
import { renderSvgFile } from './svg'
import { renderDxf } from './dxf'

export type ExportFormat = 'pdf' | 'svg' | 'dxf'

const MIME: Record<ExportFormat, string> = {
  pdf: 'application/pdf',
  svg: 'image/svg+xml',
  dxf: 'application/dxf',
}

function baseName(project: Project, index: number): string {
  const sheet = project.sheets[index]
  const event = slug(project.eventName, 'PROJETO')
  const title = slug(sheet.title, 'PIXELMAP')
  return `${event}_${title}_FOLHA-${slug(sheetNumber(sheet, index), String(index + 1))}`
}

const projectName = (project: Project) => slug(project.eventName, 'PROJETO')

function layoutsOf(project: Project): SheetLayout[] {
  return project.sheets.map((sheet, i) => buildSheetLayout(project, sheet, i))
}

/** Conteúdo de uma folha no formato pedido. */
async function sheetContent(
  project: Project,
  index: number,
  format: ExportFormat,
): Promise<Blob | string> {
  const layout = buildSheetLayout(project, project.sheets[index], index)
  if (format === 'svg') return renderSvgFile(layout)
  if (format === 'dxf') return renderDxf(layout)
  return sheetToPdfBlob(layout, baseName(project, index))
}

/** Baixa uma folha isolada. */
export async function exportSheet(project: Project, index: number, format: ExportFormat) {
  const content = await sheetContent(project, index, format)
  const filename = `${baseName(project, index)}.${format}`
  if (typeof content === 'string') downloadText(content, filename, MIME[format])
  else downloadBlob(content, filename)
}

/** Todas as folhas em um único PDF de várias páginas. */
export async function exportAllAsSinglePdf(project: Project) {
  const blob = await sheetsToPdfBlob(layoutsOf(project), projectName(project))
  downloadBlob(blob, `${projectName(project)}_PIXELMAP.pdf`)
}

/** Todas as folhas como arquivos separados dentro de um .zip. */
export async function exportAllAsZip(project: Project, format: ExportFormat) {
  const zip = new JSZip()
  for (let i = 0; i < project.sheets.length; i++) {
    const content = await sheetContent(project, i, format)
    zip.file(`${baseName(project, i)}.${format}`, content)
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(blob, `${projectName(project)}_${format.toUpperCase()}.zip`)
}

/** Backup do projeto inteiro, para retomar a edição depois. */
export function exportProjectJson(project: Project) {
  downloadText(
    JSON.stringify(project, null, 2),
    `${projectName(project)}_pixelhub.json`,
    'application/json',
  )
}
