import type { ReactNode } from 'react'

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
  title, action, children,
}: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      <header className="section__head">
        <h2>{title}</h2>
        {action}
      </header>
      <div className="section__body">{children}</div>
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
