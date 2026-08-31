import { jsPDF } from 'jspdf'
import { svg2pdf } from 'svg2pdf.js'
import type { SheetLayout } from '../layout'
import { renderSvg } from './svg'

/**
 * O PDF é gerado a partir do mesmo SVG exibido na tela: o svg2pdf converte
 * cada primitiva em geometria PDF, então o arquivo sai vetorial e com o
 * texto selecionável, não como imagem rasterizada.
 */

function createDoc(page: { w: number; h: number }) {
  return new jsPDF({
    orientation: page.w >= page.h ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [page.w, page.h],
    compress: true,
  })
}

/**
 * O svg2pdf mede texto pelo DOM, então o SVG precisa estar no documento.
 * Ele fica fora da tela e é removido ao final, inclusive em caso de erro.
 */
async function withMountedSvg<T>(
  markup: string,
  fn: (el: SVGSVGElement) => Promise<T>,
): Promise<T> {
  const host = document.createElement('div')
  host.setAttribute(
    'style',
    'position:fixed;left:-10000px;top:0;width:0;height:0;overflow:hidden;',
  )
  host.innerHTML = markup
  document.body.appendChild(host)
  try {
    const el = host.querySelector('svg')
    if (!el) throw new Error('Falha ao montar o SVG da folha.')
    return await fn(el as SVGSVGElement)
  } finally {
    host.remove()
  }
}

async function drawPage(doc: jsPDF, layout: SheetLayout) {
  const markup = renderSvg(layout, { physicalSize: true, fontFamily: 'helvetica' })
  await withMountedSvg(markup, (el) =>
    svg2pdf(el, doc, { x: 0, y: 0, width: layout.page.w, height: layout.page.h }),
  )
}

export async function sheetToPdfBlob(layout: SheetLayout, title: string): Promise<Blob> {
  const doc = createDoc(layout.page)
  doc.setProperties({ title, creator: 'PixelHub' })
  await drawPage(doc, layout)
  return doc.output('blob')
}

/** Todas as folhas em um único PDF, uma por página, na ordem do projeto. */
export async function sheetsToPdfBlob(layouts: SheetLayout[], title: string): Promise<Blob> {
  if (layouts.length === 0) throw new Error('Nenhuma folha para exportar.')
  const doc = createDoc(layouts[0].page)
  doc.setProperties({ title, creator: 'PixelHub' })
  for (let i = 0; i < layouts.length; i++) {
    if (i > 0) {
      const { w, h } = layouts[i].page
      doc.addPage([w, h], w >= h ? 'landscape' : 'portrait')
    }
    await drawPage(doc, layouts[i])
  }
  return doc.output('blob')
}
