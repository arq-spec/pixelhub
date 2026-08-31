import { useEffect, useMemo, useReducer } from 'react'
import {
  DEFAULT_FIELDS, DEFAULT_MODULE_MM, PITCHES,
  type FieldId, type PanelConfig, type Project, type Sheet,
} from '../types'
import { todayIso } from './format'
import { DEFAULT_LOGO_DATA_URI } from './brandLogo'

const STORAGE_KEY = 'pixelhub.project.v2'

export const DEFAULT_NOTES = ['Painel de LED - P2.9mm', 'Arquivos Vídeo .Mov - DXV3.']

/** Reconhece a linha de observação que anuncia o pitch do painel. */
const PITCH_NOTE = /^\s*painel de led\s*-\s*p[\d.,]+\s*mm\s*$/i

export const pitchNote = (label: string) => `Painel de LED - ${label}`

/**
 * Mantém a observação do pitch coerente com o painel.
 * `addIfMissing` só é usado pela ação explícita do usuário: na troca de pitch a
 * linha é apenas atualizada, para não ressuscitar uma observação que ele apagou.
 */
export function syncPitchNote(notes: string[], label: string, addIfMissing = false): string[] {
  let found = false
  const next = notes.map((n) => {
    if (!PITCH_NOTE.test(n)) return n
    found = true
    return pitchNote(label)
  })
  if (found || !addIfMissing) return next
  return [...next.filter((n) => n.trim()), pitchNote(label)]
}

let seq = 0
const uid = () => `s${Date.now().toString(36)}${(seq++).toString(36)}`

export function makePanel(partial?: Partial<PanelConfig>): PanelConfig {
  return {
    name: 'PAINEL PRINCIPAL',
    widthMm: 4000,
    heightMm: 2500,
    pitch: 'P2.9',
    moduleWMm: DEFAULT_MODULE_MM.w,
    moduleHMm: DEFAULT_MODULE_MM.h,
    ...partial,
  }
}

export function makeSheet(partial?: Partial<Sheet>): Sheet {
  const panels = partial?.panels?.length
    ? partial.panels.map((p) => makePanel(p))
    : [makePanel()]
  return {
    id: uid(),
    title: 'PIXELMAP',
    notes: [...DEFAULT_NOTES],
    numberOverride: null,
    showDimensions: false,
    ...partial,
    panels,
    fields: { ...DEFAULT_FIELDS, ...(partial?.fields ?? {}) },
  }
}

export function makeProject(): Project {
  return {
    brand: { name: '', logoDataUri: DEFAULT_LOGO_DATA_URI },
    eventName: 'NOME DO EVENTO',
    desenhista: 'GABRIEL',
    eventDate: '',
    issueDate: todayIso(),
    sheets: [makeSheet()],
    activeIndex: 0,
  }
}

export type Action =
  | { type: 'patchProject'; patch: Partial<Omit<Project, 'sheets' | 'activeIndex'>> }
  | { type: 'patchBrand'; patch: Partial<Project['brand']> }
  | { type: 'select'; index: number }
  | { type: 'addSheet' }
  | { type: 'duplicateSheet'; index: number }
  | { type: 'removeSheet'; index: number }
  | { type: 'moveSheet'; index: number; delta: number }
  | { type: 'patchSheet'; index: number; patch: Partial<Omit<Sheet, 'panels'>> }
  | { type: 'toggleField'; index: number; field: FieldId; value: boolean }
  | { type: 'addPanel'; index: number }
  | { type: 'duplicatePanel'; index: number; panelIndex: number }
  | { type: 'removePanel'; index: number; panelIndex: number }
  | { type: 'movePanel'; index: number; panelIndex: number; delta: number }
  | { type: 'patchPanel'; index: number; panelIndex: number; patch: Partial<PanelConfig> }
  | { type: 'clearOverrides' }
  | { type: 'load'; project: Project }
  | { type: 'reset' }

const clampIndex = (i: number, len: number) => Math.max(0, Math.min(i, len - 1))

/** Aplica uma transformação à folha em `index`, mantendo o resto intacto. */
function mapSheet(state: Project, index: number, fn: (s: Sheet) => Sheet): Project {
  return { ...state, sheets: state.sheets.map((s, i) => (i === index ? fn(s) : s)) }
}

export function reducer(state: Project, action: Action): Project {
  switch (action.type) {
    case 'patchProject':
      return { ...state, ...action.patch }

    case 'patchBrand':
      return { ...state, brand: { ...state.brand, ...action.patch } }

    case 'select':
      return { ...state, activeIndex: clampIndex(action.index, state.sheets.length) }

    case 'addSheet': {
      const source = state.sheets[state.activeIndex]
      // Uma folha nova herda a configuração da atual: na prática as folhas de
      // um mesmo projeto são variações, não configurações do zero.
      const sheet = makeSheet(
        source
          ? {
              title: source.title,
              notes: [...source.notes],
              panels: source.panels.map((p) => ({ ...p })),
              showDimensions: source.showDimensions,
              fields: { ...source.fields },
            }
          : undefined,
      )
      const sheets = [...state.sheets, sheet]
      return { ...state, sheets, activeIndex: sheets.length - 1 }
    }

    case 'duplicateSheet': {
      const source = state.sheets[action.index]
      if (!source) return state
      const copy = makeSheet({
        title: source.title,
        notes: [...source.notes],
        panels: source.panels.map((p) => ({ ...p })),
        showDimensions: source.showDimensions,
        fields: { ...source.fields },
      })
      const sheets = [...state.sheets]
      sheets.splice(action.index + 1, 0, copy)
      return { ...state, sheets, activeIndex: action.index + 1 }
    }

    case 'removeSheet': {
      if (state.sheets.length <= 1) return state
      const sheets = state.sheets.filter((_, i) => i !== action.index)
      return { ...state, sheets, activeIndex: clampIndex(state.activeIndex, sheets.length) }
    }

    case 'moveSheet': {
      const to = action.index + action.delta
      if (to < 0 || to >= state.sheets.length) return state
      const sheets = [...state.sheets]
      const [moved] = sheets.splice(action.index, 1)
      sheets.splice(to, 0, moved)
      return { ...state, sheets, activeIndex: to }
    }

    case 'patchSheet':
      return mapSheet(state, action.index, (s) => ({ ...s, ...action.patch }))

    case 'toggleField':
      return mapSheet(state, action.index, (s) => ({
        ...s,
        fields: { ...s.fields, [action.field]: action.value },
      }))

    case 'addPanel':
      return mapSheet(state, action.index, (s) => {
        const last = s.panels[s.panels.length - 1]
        return {
          ...s,
          panels: [
            ...s.panels,
            makePanel({ ...last, name: `PAINEL ${s.panels.length + 1}` }),
          ],
        }
      })

    case 'duplicatePanel':
      return mapSheet(state, action.index, (s) => {
        const source = s.panels[action.panelIndex]
        if (!source) return s
        const panels = [...s.panels]
        panels.splice(action.panelIndex + 1, 0, { ...source })
        return { ...s, panels }
      })

    case 'removePanel':
      return mapSheet(state, action.index, (s) =>
        s.panels.length <= 1
          ? s
          : { ...s, panels: s.panels.filter((_, i) => i !== action.panelIndex) },
      )

    case 'movePanel':
      return mapSheet(state, action.index, (s) => {
        const to = action.panelIndex + action.delta
        if (to < 0 || to >= s.panels.length) return s
        const panels = [...s.panels]
        const [moved] = panels.splice(action.panelIndex, 1)
        panels.splice(to, 0, moved)
        return { ...s, panels }
      })

    case 'patchPanel':
      return mapSheet(state, action.index, (s) => {
        const current = s.panels[action.panelIndex]
        if (!current) return s
        const panels = s.panels.map((p, i) =>
          i === action.panelIndex ? { ...p, ...action.patch } : p,
        )
        // Trocar o pitch reescreve a observação correspondente, se houver.
        const notes =
          action.patch.pitch && action.patch.pitch !== current.pitch
            ? syncPitchNote(s.notes, PITCHES[action.patch.pitch].label)
            : s.notes
        return { ...s, panels, notes }
      })

    case 'clearOverrides':
      return { ...state, sheets: state.sheets.map((s) => ({ ...s, numberOverride: null })) }

    case 'load':
      return action.project

    case 'reset':
      return makeProject()

    default:
      return state
  }
}

/** Reidrata o projeto salvo tolerando arquivos antigos ou incompletos. */
export function hydrate(raw: unknown): Project | null {
  if (!raw || typeof raw !== 'object') return null
  // `panel` (singular) é o formato anterior à folha com vários painéis.
  type StoredSheet = Partial<Sheet> & { panel?: PanelConfig }
  const data = raw as Omit<Partial<Project>, 'sheets'> & { sheets?: StoredSheet[] }
  if (!Array.isArray(data.sheets) || data.sheets.length === 0) return null
  const base = makeProject()
  const sheets = data.sheets.map((s) =>
    // Projetos salvos antes da folha com vários painéis traziam `panel`.
    makeSheet({ ...s, panels: s.panels ?? (s.panel ? [s.panel] : undefined) }),
  )
  return {
    ...base,
    ...data,
    brand: { ...base.brand, ...(data.brand ?? {}) },
    sheets,
    activeIndex: clampIndex(data.activeIndex ?? 0, sheets.length),
  }
}

function readStorage(): Project {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const project = hydrate(JSON.parse(raw))
      if (project) return project
    }
  } catch {
    // Armazenamento indisponível (aba privada, cota cheia): começa limpo.
  }
  return makeProject()
}

export function useProject() {
  const [project, dispatch] = useReducer(reducer, undefined, readStorage)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
    } catch {
      // Persistência é conveniência; a edição continua funcionando sem ela.
    }
  }, [project])

  const active = useMemo(
    () => project.sheets[project.activeIndex] ?? project.sheets[0],
    [project],
  )

  return { project, dispatch, active }
}
