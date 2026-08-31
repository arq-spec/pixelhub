/** Pitch disponível. O valor é o passo nominal em milímetros. */
export type PitchId = 'P1.9' | 'P2.9'

export interface PitchSpec {
  id: PitchId
  /** Passo nominal exibido em tela, em mm. */
  pitchMm: number
  /** Pixels por metro linear (336 p/m em P2.9, 512 p/m em P1.9). */
  pixelsPerMeter: number
  /** Rótulo usado nas observações automáticas da folha. */
  label: string
}

export const PITCHES: Record<PitchId, PitchSpec> = {
  'P1.9': { id: 'P1.9', pitchMm: 1.953, pixelsPerMeter: 512, label: 'P1.9mm' },
  'P2.9': { id: 'P2.9', pitchMm: 2.976, pixelsPerMeter: 336, label: 'P2.9mm' },
}

/** Constantes físicas pedidas na especificação. */
export const WEIGHT_KG_PER_M2 = 28
export const POWER_KVA_PER_M2 = 0.5

/** Módulo (gabinete) padrão do mercado. */
export const DEFAULT_MODULE_MM = { w: 500, h: 500 }

export interface PanelConfig {
  /**
   * Identidade do painel dentro do projeto. As folhas referenciam este id,
   * então editar o painel uma vez vale para todas as folhas que o usam.
   */
  id: string
  /** Nome exibido acima do desenho, ex.: "TOTEM", "PAINEL PRINCIPAL". */
  name: string
  /** Largura do painel em milímetros. */
  widthMm: number
  /** Altura do painel em milímetros. */
  heightMm: number
  pitch: PitchId
  /** Largura do módulo em milímetros. */
  moduleWMm: number
  /** Altura do módulo em milímetros. */
  moduleHMm: number
  /**
   * Posições sem placa, como "coluna,linha" (base 0). Permite painéis de
   * formato livre — pórtico, escada, vão central — dentro da mesma grade.
   */
  removedCells: string[]
  /** Repartições de conteúdo do painel. */
  regions: PanelRegion[]
  /** Cor de identificação do painel na folha. */
  color: string | null
  /** Lista este painel e suas cores no quadro de legendas. */
  showInLegend: boolean
}

/**
 * Uma repartição de conteúdo: o trecho do painel que recebe um sinal ou uma
 * peça de arte própria. É um conjunto de posições, não um retângulo, então
 * comporta recortes em L, pórticos e vãos.
 */
export interface PanelRegion {
  id: string
  /** Nome impresso na folha, ex.: "PARTE 1". */
  name: string
  /** Posições que compõem a repartição, como "coluna,linha". */
  cells: string[]
  /** Cor do contorno tracejado e do preenchimento. */
  color: string
}

/** Cores sugeridas para painéis e repartições. */
export const REGION_COLORS = [
  '#e5352b', '#1f6fd0', '#12946b', '#d98324', '#7d4fd1', '#c62a72',
] as const

/** Linhas do quadro de dados que podem ser ligadas ou desligadas na folha. */
export type FieldId =
  | 'dimensao'
  | 'pixels'
  | 'modulos'
  | 'area'
  | 'peso'
  | 'consumo'
  | 'escala'
  | 'reparticoes'

export const FIELD_ORDER: FieldId[] = [
  'dimensao', 'pixels', 'modulos', 'area', 'peso', 'consumo', 'escala', 'reparticoes',
]

export const FIELD_LABELS: Record<FieldId, string> = {
  dimensao: 'Dimensão do painel',
  pixels: 'Pixels',
  modulos: 'Módulos',
  area: 'Área total',
  peso: 'Peso',
  consumo: 'Consumo',
  escala: 'Escala (ESC. 1:x)',
  reparticoes: 'Repartições',
}

export type FieldVisibility = Record<FieldId, boolean>

/** Ligadas por padrão: o essencial de montagem e de carga. */
export const DEFAULT_FIELDS: FieldVisibility = {
  dimensao: true,
  pixels: true,
  modulos: false,
  area: false,
  peso: true,
  consumo: true,
  escala: false,
  reparticoes: true,
}

export interface Sheet {
  id: string
  /** Título impresso no carimbo, ex.: "PIXELMAP". */
  title: string
  /**
   * Painéis do projeto que esta folha desenha, por id. Desmarcar um painel
   * apenas o retira desta folha — ele continua no projeto e pode voltar.
   * A ordem do desenho é a do catálogo do projeto.
   */
  activePanelIds: string[]
  /** Linhas do quadro OBSERVAÇÕES. */
  notes: string[]
  /**
   * Numeração da folha. `null` = automática (sequencial pela ordem).
   * Uma string força a numeração daquela folha ("03", "A1", "05A"...).
   */
  numberOverride: string | null
  /** Cotas de largura e altura ao redor de cada desenho. */
  showDimensions: boolean
  /** Quais linhas do quadro de dados aparecem na folha. */
  fields: FieldVisibility
  /** Mostra as cores dos painéis no quadro de legendas. */
  showColorLegend: boolean
}

export interface Brand {
  /** Assinatura impressa acima do carimbo quando não há logotipo. */
  name: string
  /** Logotipo do escritório embutido como data URI (PNG, JPG ou SVG). */
  logoDataUri: string | null
}

export interface Project {
  brand: Brand
  /** Catálogo de painéis do projeto, compartilhado por todas as folhas. */
  panels: PanelConfig[]
  /** Nome do evento, no topo do carimbo. */
  eventName: string
  desenhista: string
  /** ISO yyyy-mm-dd. Vazio => "A DEFINIR" na folha. */
  eventDate: string
  /** ISO yyyy-mm-dd da emissão. */
  issueDate: string
  sheets: Sheet[]
  /** Índice da folha aberta no editor. */
  activeIndex: number
}
