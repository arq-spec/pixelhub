/** Dispara o download de um arquivo gerado no próprio navegador. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // O revoke imediato cancela o download em alguns navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function downloadText(content: string, filename: string, mime: string) {
  downloadBlob(new Blob([content], { type: `${mime};charset=utf-8` }), filename)
}
