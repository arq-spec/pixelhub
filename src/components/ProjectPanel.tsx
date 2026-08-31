import type { ChangeEvent, Dispatch } from 'react'
import type { Project } from '../types'
import type { Action } from '../lib/store'
import { PLACEHOLDER_DATE } from '../lib/format'
import { Button, Field, Section, TextInput } from './ui'

const MAX_LOGO_BYTES = 1_500_000

export function ProjectPanel({
  project, dispatch,
}: { project: Project; dispatch: Dispatch<Action> }) {
  const patch = (p: Partial<Project>) => dispatch({ type: 'patchProject', patch: p })

  const onLogo = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_LOGO_BYTES) {
      window.alert('Logotipo muito grande. Use um arquivo de até 1,5 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () =>
      dispatch({ type: 'patchBrand', patch: { logoDataUri: String(reader.result) } })
    reader.readAsDataURL(file)
  }

  return (
    <Section title="Projeto">
      <Field label="Evento" wide>
        <TextInput
          value={project.eventName}
          onChange={(v) => patch({ eventName: v })}
          placeholder="NOME DO EVENTO"
          upper
        />
      </Field>

      <Field label="Desenhista" wide>
        <TextInput
          value={project.desenhista}
          onChange={(v) => patch({ desenhista: v })}
          placeholder="NOME"
          upper
        />
      </Field>

      <div className="grid2">
        <Field
          label="Data do evento"
          hint={project.eventDate ? undefined : `Em branco → “${PLACEHOLDER_DATE}”`}
        >
          <input
            className="input"
            type="date"
            value={project.eventDate}
            onChange={(e) => patch({ eventDate: e.target.value })}
          />
        </Field>

        <Field label="Emissão">
          <input
            className="input"
            type="date"
            value={project.issueDate}
            onChange={(e) => patch({ issueDate: e.target.value })}
          />
        </Field>
      </div>

      {project.eventDate ? (
        <Button onClick={() => patch({ eventDate: '' })}>Limpar data do evento</Button>
      ) : null}

      <hr className="rule" />

      <Field label="Assinatura / marca" hint="Impressa acima do carimbo, no lugar do logotipo.">
        <TextInput
          value={project.brand.name}
          onChange={(v) => dispatch({ type: 'patchBrand', patch: { name: v } })}
          placeholder="Sua marca"
        />
      </Field>

      <div className="logo">
        {project.brand.logoDataUri ? (
          <img className="logo__preview" src={project.brand.logoDataUri} alt="Logotipo" />
        ) : (
          <span className="logo__empty">Sem logotipo</span>
        )}
        <div className="logo__actions">
          <label className="btn btn--ghost">
            Enviar logotipo
            <input type="file" accept="image/png,image/jpeg,image/svg+xml" hidden onChange={onLogo} />
          </label>
          {project.brand.logoDataUri ? (
            <Button
              variant="danger"
              onClick={() => dispatch({ type: 'patchBrand', patch: { logoDataUri: null } })}
            >
              Remover
            </Button>
          ) : null}
        </div>
      </div>
      <p className="hint">
        PNG com fundo transparente dá o melhor resultado no PDF.
      </p>
    </Section>
  )
}
