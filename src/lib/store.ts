import { useEffect, useMemo, useReducer } from 'react'
import { DEFAULT_MODULE_MM, PITCHES, type PanelConfig, type Project, type Sheet } from '../types'
import { todayIso } from './format'

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

const STORAGE_KEY = 'pixelhub.project.v1'

export const DEFAULT_NOTES = ['Painel de LED - P2.9mm', 'Arquivos Vídeo .Mov - DXV3.']

let seq = 0
const uid = () => `s${Date.now().toString(36)}${(seq++).toString(36)}`

export function makeSheet(partial?: Partial<Sheet>): Sheet {
  const panel: PanelConfig = {
    name: 'PAINEL PRINCIPAL',
    widthMm: 4000,
    heightMm: 2500,
    pitch: 'P2.9',
    moduleWMm: DEFAULT_MODULE_MM.w,
    moduleHMm: DEFAULT_MODULE_MM.h,
    ...partial?.panel,
  }
  return {
    id: uid(),
    title: 'PIXELMAP',
    notes: [...DEFAULT_NOTES],
    numberOverride: null,
    scaleDenominator: null,
    showDimensions: false,
    ...partial,
    panel,
  }
}

export function makeProject(): Project {
  return {
    brand: { name: '', logoDataUri: null },
    eventName: 'NOME DO EVENTO',
    desenhista: '',
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
  | { type: 'patchSheet'; index: number; patch: Partial<Omit<Sheet, 'panel'>> }
  | { type: 'patchPanel'; index: number; patch: Partial<PanelConfig> }
  | { type: 'clearOverrides' }
  | { type: 'load'; project: Project }
  | { type: 'reset' }

const clampIndex = (i: number, len: number) => Math.max(0, Math.min(i, len - 1))

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
      // Uma folha nova herda o painel da folha atual: na prática as folhas de
      // um mesmo projeto são variações, não configurações do zero.
      const sheet = makeSheet(
        source
          ? {
              title: source.title,
              notes: [...source.notes],
              panel: { ...source.panel },
              scaleDenominator: source.scaleDenominator,
              showDimensions: source.showDimensions,
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
        panel: { ...source.panel },
        scaleDenominator: source.scaleDenominator,
        showDimensions: source.showDimensions,
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

    case 'patchSheet': {
      const sheets = state.sheets.map((s, i) => (i === action.index ? { ...s, ...action.patch } : s))
      return { ...state, sheets }
    }

    case 'patchPanel': {
      const sheets = state.sheets.map((s, i) => {
        if (i !== action.index) return s
        const panel = { ...s.panel, ...action.patch }
        // Trocar o pitch reescreve a observação correspondente, se houver.
        const notes =
          action.patch.pitch && action.patch.pitch !== s.panel.pitch
            ? syncPitchNote(s.notes, PITCHES[action.patch.pitch].label)
            : s.notes
        return { ...s, panel, notes }
      })
      return { ...state, sheets }
    }

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
  const data = raw as Partial<Project>
  if (!Array.isArray(data.sheets) || data.sheets.length === 0) return null
  const base = makeProject()
  const sheets = data.sheets.map((s) => makeSheet(s as Partial<Sheet>))
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
