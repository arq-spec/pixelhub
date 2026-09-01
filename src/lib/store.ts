import { useEffect, useMemo, useReducer } from 'react'
import {
  DEFAULT_FIELDS, DEFAULT_MODULE_MM, PITCHES,
  type FieldId, type PanelConfig, type Project, type RegionStyle, type Rig,
  type RigItem, type RigKind, type RigMark, type RigPoint, type Sheet,
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
    cuts: [],
    regionStyles: {},
    color: null,
    showInLegend: true,
    ...partial,
  }
}

/** Peça nova, com medidas usuais do que o mercado aluga. */
export function makeRigItem(kind: RigKind, partial?: Partial<RigItem>): RigItem {
  const base: RigItem = {
    id: uid('i'), kind, name: '',
    x: 0, y: 0, z: 0,
    wMm: 1000, hMm: 1000, dMm: 1000,
    panelId: null, legMm: 600, count: 1, stepMm: 2000,
    color: null,
  }
  const presets: Record<RigKind, Partial<RigItem>> = {
    painel: { name: 'PAINEL', dMm: 100 },
    // Praticável de palco: tampo de 2,00 x 1,00 m com pernas reguláveis.
    praticavel: { name: 'PRATICÁVEL', wMm: 2000, hMm: 200, dMm: 1000, legMm: 600, stepMm: 2000 },
    // Mão francesa: cateto vertical junto ao painel, cateto no chão.
    maoFrancesa: { name: 'MÃO FRANCESA', wMm: 60, hMm: 2000, dMm: 1200, stepMm: 2000 },
    volume: { name: 'VOLUME', wMm: 1000, hMm: 1000, dMm: 1000 },
  }
  return { ...base, ...presets[kind], ...partial }
}

export function makeRig(partial?: Partial<Rig>): Rig {
  return {
    id: uid('g'),
    name: 'MONTAGEM',
    items: [],
    view: 'isometrica',
    showGround: true,
    // A cota automática mede a montagem inteira e nem sempre é a medida que
    // interessa. Quem cota é o desenhista, marcando os vértices.
    showDimensions: false,
    marks: [],
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
    showMaterials: false,
    activePanelIds: [],
    activeRigIds: [],
    ...partial,
    fields: { ...DEFAULT_FIELDS, ...(partial?.fields ?? {}) },
  }
}

export function makeProject(): Project {
  const panel = makePanel()
  return {
    brand: { name: '', logoDataUri: DEFAULT_LOGO_DATA_URI },
    panels: [panel],
    rigs: [],
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
  /** Montagens: catálogo do projeto e seleção por folha. */
  | { type: 'addRig' }
  | { type: 'removeRig'; rigId: string }
  | { type: 'patchRig'; rigId: string; patch: Partial<Omit<Rig, 'items'>> }
  | { type: 'toggleRig'; index: number; rigId: string; active: boolean }
  | { type: 'addRigItem'; rigId: string; kind: RigKind; panelId?: string }
  | { type: 'duplicateRigItem'; rigId: string; itemId: string }
  | { type: 'removeRigItem'; rigId: string; itemId: string }
  | { type: 'patchRigItem'; rigId: string; itemId: string; patch: Partial<RigItem> }
  /** Cota marcada à mão, de vértice a vértice. */
  | { type: 'addRigMark'; rigId: string; a: RigPoint; b: RigPoint }
  | { type: 'removeRigMark'; rigId: string; markId: string }
  | { type: 'clearRigMarks'; rigId: string }
  /** Liga ou desliga placas do painel (formato livre). */
  | { type: 'setCells'; panelId: string; cells: string[]; present: boolean }
  /** Coloca ou tira linhas de corte, que definem as repartições. */
  | { type: 'setCuts'; panelId: string; cuts: string[]; on: boolean }
  | { type: 'clearCuts'; panelId: string }
  /** Nome e cor de uma repartição, pela âncora. */
  | { type: 'styleRegion'; panelId: string; anchor: string; patch: RegionStyle }
  | { type: 'clearOverrides' }
  | { type: 'load'; project: Project }
  | { type: 'reset' }

const clampIndex = (i: number, len: number) => Math.max(0, Math.min(i, len - 1))

/** Aplica uma transformação ao painel do catálogo, mantendo o resto intacto. */
function mapPanel(state: Project, panelId: string, fn: (p: PanelConfig) => PanelConfig): Project {
  return { ...state, panels: state.panels.map((p) => (p.id === panelId ? fn(p) : p)) }
}

/** Aplica uma transformação a uma montagem do catálogo. */
function mapRig(state: Project, rigId: string, fn: (r: Rig) => Rig): Project {
  return { ...state, rigs: state.rigs.map((r) => (r.id === rigId ? fn(r) : r)) }
}

/** Onde uma peça nova cabe sem cair sobre as que já estão na montagem. */
function nextFreeX(state: Project, rig: Rig): number {
  let right = 0
  for (const i of rig.items) {
    const panel = i.panelId ? state.panels.find((p) => p.id === i.panelId) : null
    const w = panel ? panel.widthMm : i.wMm
    const runs = Math.max(1, Math.round(i.count)) - 1
    right = Math.max(right, i.x + runs * i.stepMm + w)
  }
  return right ? right + 500 : 0
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

    case 'setCuts': {
      const cuts = new Set(action.cuts)
      return mapPanel(state, action.panelId, (p) => ({
        ...p,
        cuts: action.on
          ? [...new Set([...p.cuts, ...action.cuts])]
          : p.cuts.filter((key) => !cuts.has(key)),
      }))
    }

    case 'clearCuts':
      return mapPanel(state, action.panelId, (p) => ({ ...p, cuts: [], regionStyles: {} }))

    case 'styleRegion':
      return mapPanel(state, action.panelId, (p) => ({
        ...p,
        regionStyles: {
          ...p.regionStyles,
          [action.anchor]: { ...p.regionStyles[action.anchor], ...action.patch },
        },
      }))

    case 'togglePanel':
      return mapSheet(state, action.index, (s) => ({
        ...s,
        activePanelIds: action.active
          ? [...new Set([...s.activePanelIds, action.panelId])]
          : s.activePanelIds.filter((id) => id !== action.panelId),
      }))

    case 'addRig': {
      const rig = makeRig({ name: `MONTAGEM ${state.rigs.length + 1}` })
      const withRig = { ...state, rigs: [...state.rigs, rig] }
      return mapSheet(withRig, state.activeIndex, (s) => ({
        ...s,
        activeRigIds: [...s.activeRigIds, rig.id],
      }))
    }

    case 'removeRig':
      return {
        ...state,
        rigs: state.rigs.filter((r) => r.id !== action.rigId),
        sheets: state.sheets.map((s) => ({
          ...s,
          activeRigIds: s.activeRigIds.filter((id) => id !== action.rigId),
        })),
      }

    case 'patchRig':
      return {
        ...state,
        rigs: state.rigs.map((r) => (r.id === action.rigId ? { ...r, ...action.patch } : r)),
      }

    case 'toggleRig':
      return mapSheet(state, action.index, (s) => ({
        ...s,
        activeRigIds: action.active
          ? [...new Set([...s.activeRigIds, action.rigId])]
          : s.activeRigIds.filter((id) => id !== action.rigId),
      }))

    case 'addRigItem':
      return mapRig(state, action.rigId, (r) => ({
        ...r,
        items: [
          ...r.items,
          makeRigItem(action.kind, {
            panelId: action.panelId ?? null,
            // A peça nova entra ao lado do que já existe. Nascer na origem
            // esconderia a peça dentro da anterior, e o primeiro gesto no
            // ambiente seria sempre arrastá-la para fora.
            x: nextFreeX(state, r),
          }),
        ],
      }))

    case 'duplicateRigItem':
      return mapRig(state, action.rigId, (r) => {
        const at = r.items.findIndex((i) => i.id === action.itemId)
        if (at < 0) return r
        const source = r.items[at]
        // A cópia entra ao lado da original, não sobre ela: depois de uma
        // fila de repetições, começa onde a fila termina.
        const offset =
          source.count > 1 ? source.count * source.stepMm : source.wMm
        const items = [...r.items]
        items.splice(at + 1, 0, {
          ...source,
          id: uid('i'),
          x: source.x + offset,
        })
        return { ...r, items }
      })

    case 'addRigMark':
      return mapRig(state, action.rigId, (r) => ({
        ...r,
        marks: [...r.marks, { id: uid('c'), a: action.a, b: action.b }],
      }))

    case 'removeRigMark':
      return mapRig(state, action.rigId, (r) => ({
        ...r,
        marks: r.marks.filter((m) => m.id !== action.markId),
      }))

    case 'clearRigMarks':
      return mapRig(state, action.rigId, (r) => ({ ...r, marks: [] }))

    case 'removeRigItem':
      return mapRig(state, action.rigId, (r) => ({
        ...r,
        items: r.items.filter((i) => i.id !== action.itemId),
        // Cota presa à peça que saiu não tem mais o que medir.
        marks: r.marks.filter(
          (m) => m.a.itemId !== action.itemId && m.b.itemId !== action.itemId,
        ),
      }))

    case 'patchRigItem':
      return mapRig(state, action.rigId, (r) => ({
        ...r,
        items: r.items.map((i) => (i.id === action.itemId ? { ...i, ...action.patch } : i)),
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

/** Painel como pode vir do armazenamento, incluindo os formatos anteriores. */
type StoredPanelShape = Partial<PanelConfig> & {
  regions?: Array<{ id?: string; name?: string; color?: string; cells?: string[] }>
}

/**
 * Converte as repartições pintadas do formato anterior em linhas de corte:
 * onde duas placas vizinhas pertenciam a partes diferentes, nasce um corte.
 * As divisões desenhadas continuam valendo depois da mudança de modelo.
 */
function migratePanel(stored: StoredPanelShape): StoredPanelShape {
  const legacy = stored.regions
  if (!Array.isArray(legacy) || !legacy.length || stored.cuts) return stored

  const owner = new Map<string, string>()
  for (const region of legacy) {
    for (const key of region.cells ?? []) owner.set(key, region.id ?? region.name ?? '')
  }
  const cuts = new Set<string>()
  const styles: Record<string, RegionStyle> = { ...(stored.regionStyles ?? {}) }
  for (const [key, id] of owner) {
    const [c, r] = key.split(',').map(Number)
    if (owner.get(`${c},${r - 1}`) !== id && owner.has(`${c},${r - 1}`)) cuts.add(`h${c},${r}`)
    if (owner.get(`${c - 1},${r}`) !== id && owner.has(`${c - 1},${r}`)) cuts.add(`v${c},${r}`)
  }
  // O nome e a cor seguem para a âncora da parte, que é a placa superior esquerda.
  for (const region of legacy) {
    const cells = (region.cells ?? []).slice().sort((a, b) => {
      const [ca, ra] = a.split(',').map(Number)
      const [cb, rb] = b.split(',').map(Number)
      return ra - rb || ca - cb
    })
    if (cells.length) styles[cells[0]] = { name: region.name, color: region.color }
  }
  return { ...stored, cuts: [...cuts], regionStyles: styles }
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
  type StoredPanel = StoredPanelShape
  type StoredSheet = Omit<Partial<Sheet>, 'activePanelIds'> & {
    activeRigIds?: string[]
    panel?: StoredPanel
    panels?: StoredPanel[]
    activePanelIds?: string[]
  }
  type StoredProject = Omit<Partial<Project>, 'sheets' | 'panels' | 'rigs'> & {
    sheets?: StoredSheet[]
    panels?: StoredPanel[]
    rigs?: Array<Partial<Rig> & { items?: Array<Partial<RigItem> & { kind?: RigKind }> }>
  }
  const data = raw as StoredProject
  if (!Array.isArray(data.sheets) || data.sheets.length === 0) return null
  const base = makeProject()

  const catalog: PanelConfig[] = (data.panels ?? []).map((p) => makePanel(migratePanel(p)))
  const byKey = new Map(catalog.map((p) => [panelKey(p), p.id]))

  /** Devolve o id do painel no catálogo, criando a entrada se preciso. */
  const adopt = (stored: StoredPanel): string => {
    const panel = makePanel(migratePanel(stored))
    const key = panelKey(panel)
    const existing = byKey.get(key)
    if (existing) return existing
    catalog.push(panel)
    byKey.set(key, panel.id)
    return panel.id
  }

  const rigs = (data.rigs ?? []).map((r) =>
    makeRig({
      ...r,
      items: (r.items ?? []).map((i) => makeRigItem(i.kind ?? 'volume', i)),
      // Montagens gravadas antes das cotas manuais não têm a lista.
      marks: (r.marks ?? []).filter((m): m is RigMark => !!m?.a && !!m?.b),
    }),
  )
  const sheets = data.sheets.map((s) => {
    const legacy = s.panels ?? (s.panel ? [s.panel] : [])
    const activePanelIds = s.activePanelIds ?? legacy.map(adopt)
    return makeSheet({ ...s, activePanelIds, activeRigIds: s.activeRigIds ?? [] })
  })

  if (catalog.length === 0) catalog.push(...base.panels)

  return {
    ...base,
    ...data,
    panels: catalog,
    rigs,
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
