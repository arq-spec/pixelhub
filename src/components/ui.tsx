import { useEffect, useState, type ReactNode } from 'react'

/**
 * Estado de recolher/expandir guardado no navegador. É preferência de tela, não
 * do documento: fica fora do projeto, mas persiste entre recargas para a
 * escolha não se perder a cada abertura.
 */
function usePersistentToggle(key: string, initial: boolean) {
  const [open, setOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored === null ? initial : stored === '1'
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, open ? '1' : '0')
    } catch {
      // Sem armazenamento a seção ainda recolhe, só não lembra na próxima vez.
    }
  }, [key, open])
  return [open, setOpen] as const
}

export function Field({
  label, hint, children, wide,
}: { label: string; hint?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`field${wide ? ' field--wide' : ''}`}>
      <span className="field__label">{label}</span>
      {children}
      {hint ? <span className="field__hint">{hint}</span> : null}
    </label>
  )
}

export function TextInput({
  value, onChange, placeholder, upper,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  upper?: boolean
}) {
  return (
    <input
      className={`input${upper ? ' input--upper' : ''}`}
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

/**
 * Campo numérico tolerante ao teclado brasileiro: aceita vírgula ou ponto e
 * só devolve o valor quando ele é utilizável, para não zerar o desenho
 * enquanto a pessoa ainda está digitando.
 */
export function NumberInput({
  value, onChange, step = 1, min = 0, suffix,
}: {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  suffix?: string
}) {
  const handle = (raw: string) => {
    const parsed = Number(raw.replace(',', '.'))
    if (Number.isFinite(parsed) && parsed >= min) onChange(parsed)
  }
  return (
    <span className="numwrap">
      <input
        className="input"
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        value={Number.isFinite(value) ? Number(value.toFixed(4)) : ''}
        onChange={(e) => handle(e.target.value)}
      />
      {suffix ? <span className="numwrap__suffix">{suffix}</span> : null}
    </span>
  )
}

export function Section({
  title, action, children, collapsible, storageKey, defaultOpen = true, summary,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  /** Permite recolher o corpo da seção pelo próprio cabeçalho. */
  collapsible?: boolean
  /** Chave de persistência do estado recolhido. */
  storageKey?: string
  defaultOpen?: boolean
  /** Resumo mostrado ao lado do título quando a seção está recolhida. */
  summary?: ReactNode
}) {
  const [open, setOpen] = usePersistentToggle(
    storageKey ?? `pixelhub.ui.${title}`,
    defaultOpen,
  )
  const isOpen = collapsible ? open : true

  return (
    <section className="section">
      <header className="section__head">
        {collapsible ? (
          <button
            type="button"
            className="section__toggle"
            aria-expanded={isOpen}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="section__chev" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
            <h2>{title}</h2>
            {!isOpen && summary ? <span className="section__summary">{summary}</span> : null}
          </button>
        ) : (
          <h2>{title}</h2>
        )}
        {action}
      </header>
      {isOpen ? <div className="section__body">{children}</div> : null}
    </section>
  )
}

export function Button({
  children, onClick, variant = 'ghost', title, disabled,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'ghost' | 'primary' | 'danger' | 'icon'
  title?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className={`btn btn--${variant}`}
      onClick={onClick}
      title={title}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

export function Toggle({
  checked, onChange, label,
}: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}
