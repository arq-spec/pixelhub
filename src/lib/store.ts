import { useEffect, useMemo, useReducer } from 'react'
import {
  DEFAULT_FIELDS, DEFAULT_MODULE_MM, PITCHES, REGION_COLORS,
  type FieldId, type PanelConfig, type PanelRegion, type Project, type Sheet,
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
const uid = (prefix: string) => `${prefix}${Date.now().toString(36)}${(seq++).toString(36)}`

export function makePanel(partial?: Partial<PanelConfig>): PanelConfig {
  return {
    id: uid('p'),
    name: 'PAINEL PRINCIPAL',
    widthMm: 4000,
    heightMm: 2500,
    pitch: 'P2.9',
    moduleWMm: DEFAULT_MODULE_MM.w,
    moduleHMm: DEFAULT_MODULE_MM.h,
    removedCells: [],
    regions: [],
    color: null,
    showInLegend: true,
    ...partial,
  }
}

export function makeSheet(partial?: Partial<Sheet>): Sheet {
  return {
    id: uid('s'),
    title: 'PIXELMAP',
    notes: [...DEFAULT_NOTES],
    numberOverride: null,
    showDimensions: false,
    showColorLegend: true,
    activePanelIds: [],
    ...partial,
    fields: { ...DEFAULT_FIELDS, ...(partial?.fields ?? {}) },
  }
}

export function makeProject(): Project {
  const panel = makePanel()
  return {
    brand: { name: '', logoDataUri: DEFAULT_LOGO_DATA_URI },
    panels: [panel],
    eventName: 'NOME DO EVENTO',
    desenhista: 'GABRIEL',
    eventDate: '',
    issueDate: todayIso(),
    sheets: [makeSheet({ activePanelIds: [panel.id] })],
    activeIndex: 0,
  }
}

/** Painéis que a folha desenha, na ordem do catálogo do projeto. */
export function sheetPanels(project: Project, sheet: Sheet): PanelConfig[] {
  return project.panels.filter((p) => sheet.activePanelIds.includes(p.id))
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
  /** Cria um painel no projeto e já o ativa na folha aberta. */
  | { type: 'addPanel' }
  | { type: 'duplicatePanel'; panelId: string }
  | { type: 'removePanel'; panelId: string }
  | { type: 'movePanel'; panelId: string; delta: number }
  | { type: 'patchPanel'; panelId: string; patch: Partial<PanelConfig> }
  /** Liga ou desliga um painel do projeto nesta folha. */
  | { type: 'togglePanel'; index: number; panelId: string; active: boolean }
  /** Liga ou desliga placas do painel (formato livre). */
  | { type: 'setCells'; panelId: string; cells: string[]; present: boolean }
  | { type: 'addRegion'; panelId: string }
  | { type: 'removeRegion'; panelId: string; regionId: string }
  | { type: 'patchRegion'; panelId: string; regionId: string; patch: Partial<PanelRegion> }
  /** Inclui ou retira posições de uma repartição. */
  | { type: 'setRegionCells'; panelId: string; regionId: string; cells: string[]; inside: boolean }
  | { type: 'clearOverrides' }
  | { type: 'load'; project: Project }
  | { type: 'reset' }

const clampIndex = (i: number, len: number) => Math.max(0, Math.min(i, len - 1))

/** Aplica uma transformação ao painel do catálogo, mantendo o resto intacto. */
function mapPanel(state: Project, panelId: string, fn: (p: PanelConfig) => PanelConfig): Project {
  return { ...state, panels: state.panels.map((p) => (p.id === panelId ? fn(p) : p)) }
}

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
              activePanelIds: [...source.activePanelIds],
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
        activePanelIds: [...source.activePanelIds],
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

    case 'addPanel': {
      const last = state.panels[state.panels.length - 1]
      const panel = makePanel({ ...last, id: undefined, name: `PAINEL ${state.panels.length + 1}` })
      const withPanel = { ...state, panels: [...state.panels, panel] }
      // O painel novo já entra ativo na folha que está aberta.
      return mapSheet(withPanel, state.activeIndex, (s) => ({
        ...s,
        activePanelIds: [...s.activePanelIds, panel.id],
      }))
    }

    case 'duplicatePanel': {
      const at = state.panels.findIndex((p) => p.id === action.panelId)
      if (at < 0) return state
      const copy = makePanel({ ...state.panels[at], id: undefined })
      const panels = [...state.panels]
      panels.splice(at + 1, 0, copy)
      return mapSheet({ ...state, panels }, state.activeIndex, (s) => ({
        ...s,
        activePanelIds: [...s.activePanelIds, copy.id],
      }))
    }

    case 'removePanel': {
      if (state.panels.length <= 1) return state
      return {
        ...state,
        panels: state.panels.filter((p) => p.id !== action.panelId),
        // Sai do catálogo e, com ele, de todas as folhas.
        sheets: state.sheets.map((s) => ({
          ...s,
          activePanelIds: s.activePanelIds.filter((id) => id !== action.panelId),
        })),
      }
    }

    case 'movePanel': {
      const at = state.panels.findIndex((p) => p.id === action.panelId)
      const to = at + action.delta
      if (at < 0 || to < 0 || to >= state.panels.length) return state
      const panels = [...state.panels]
      const [moved] = panels.splice(at, 1)
      panels.splice(to, 0, moved)
      return { ...state, panels }
    }

    case 'patchPanel': {
      const current = state.panels.find((p) => p.id === action.panelId)
      if (!current) return state
      const panels = state.panels.map((p) =>
        p.id === action.panelId ? { ...p, ...action.patch } : p,
      )
      // Trocar o pitch reescreve a observação correspondente nas folhas que
      // desenham este painel.
      const changedPitch = action.patch.pitch && action.patch.pitch !== current.pitch
      const sheets = changedPitch
        ? state.sheets.map((s) =>
            s.activePanelIds.includes(action.panelId)
              ? { ...s, notes: syncPitchNote(s.notes, PITCHES[action.patch.pitch!].label) }
              : s,
          )
        : state.sheets
      return { ...state, panels, sheets }
    }

    case 'setCells': {
      const cells = new Set(action.cells)
      return mapPanel(state, action.panelId, (p) => ({
        ...p,
        removedCells: action.present
          ? p.removedCells.filter((key) => !cells.has(key))
          : [...new Set([...p.removedCells, ...action.cells])],
      }))
    }

    case 'addRegion':
      return mapPanel(state, action.panelId, (p) => ({
        ...p,
        regions: [
          ...p.regions,
          {
            id: uid('r'),
            name: `PARTE ${p.regions.length + 1}`,
            cells: [],
            color: REGION_COLORS[p.regions.length % REGION_COLORS.length],
          },
        ],
      }))

    case 'removeRegion':
      return mapPanel(state, action.panelId, (p) => ({
        ...p,
        regions: p.regions.filter((r) => r.id !== action.regionId),
      }))

    case 'patchRegion':
      return mapPanel(state, action.panelId, (p) => ({
        ...p,
        regions: p.regions.map((r) =>
          r.id === action.regionId ? { ...r, ...action.patch } : r,
        ),
      }))

    case 'setRegionCells': {
      const cells = new Set(action.cells)
      return mapPanel(state, action.panelId, (p) => ({
        ...p,
        regions: p.regions.map((r) => {
          if (r.id !== action.regionId) {
            // Uma posição pertence a uma repartição de cada vez.
            return action.inside
              ? { ...r, cells: r.cells.filter((key) => !cells.has(key)) }
              : r
          }
          return {
            ...r,
            cells: action.inside
              ? [...new Set([...r.cells, ...action.cells])]
              : r.cells.filter((key) => !cells.has(key)),
          }
        }),
      }))
    }

    case 'togglePanel':
      return mapSheet(state, action.index, (s) => ({
        ...s,
        activePanelIds: action.active
          ? [...new Set([...s.activePanelIds, action.panelId])]
          : s.activePanelIds.filter((id) => id !== action.panelId),
      }))

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

/** Assinatura de conteúdo de um painel, para unificar duplicatas na migração. */
const panelKey = (p: Omit<PanelConfig, 'id'> & { id?: string }) =>
  [p.name, p.widthMm, p.heightMm, p.pitch, p.moduleWMm, p.moduleHMm].join('|')

/**
 * Reidrata o projeto salvo, tolerando os formatos anteriores:
 * - `sheet.panel` (um painel por folha);
 * - `sheet.panels` (vários painéis, mas copiados por folha).
 *
 * Nos dois casos os painéis sobem para o catálogo do projeto. Painéis
 * idênticos em folhas diferentes viram uma entrada só, que é justamente o
 * comportamento que o catálogo passa a garantir daqui em diante.
 */
export function hydrate(raw: unknown): Project | null {
  if (!raw || typeof raw !== 'object') return null
  type StoredPanel = Partial<PanelConfig>
  type StoredSheet = Omit<Partial<Sheet>, 'activePanelIds'> & {
    panel?: StoredPanel
    panels?: StoredPanel[]
    activePanelIds?: string[]
  }
  type StoredProject = Omit<Partial<Project>, 'sheets' | 'panels'> & {
    sheets?: StoredSheet[]
    panels?: StoredPanel[]
  }
  const data = raw as StoredProject
  if (!Array.isArray(data.sheets) || data.sheets.length === 0) return null
  const base = makeProject()

  const catalog: PanelConfig[] = (data.panels ?? []).map((p) => makePanel(p))
  const byKey = new Map(catalog.map((p) => [panelKey(p), p.id]))

  /** Devolve o id do painel no catálogo, criando a entrada se preciso. */
  const adopt = (stored: StoredPanel): string => {
    const panel = makePanel(stored)
    const key = panelKey(panel)
    const existing = byKey.get(key)
    if (existing) return existing
    catalog.push(panel)
    byKey.set(key, panel.id)
    return panel.id
  }

  const sheets = data.sheets.map((s) => {
    const legacy = s.panels ?? (s.panel ? [s.panel] : [])
    const activePanelIds = s.activePanelIds ?? legacy.map(adopt)
    return makeSheet({ ...s, activePanelIds })
  })

  if (catalog.length === 0) catalog.push(...base.panels)

  return {
    ...base,
    ...data,
    panels: catalog,
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
