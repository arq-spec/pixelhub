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
}

/** Linhas do quadro de dados que podem ser ligadas ou desligadas na folha. */
export type FieldId =
  | 'dimensao'
  | 'pixels'
  | 'modulos'
  | 'area'
  | 'peso'
  | 'consumo'
  | 'escala'

export const FIELD_ORDER: FieldId[] = [
  'dimensao', 'pixels', 'modulos', 'area', 'peso', 'consumo', 'escala',
]

export const FIELD_LABELS: Record<FieldId, string> = {
  dimensao: 'Dimensão do painel',
  pixels: 'Pixels',
  modulos: 'Módulos',
  area: 'Área total',
  peso: 'Peso',
  consumo: 'Consumo',
  escala: 'Escala (ESC. 1:x)',
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
}

export interface Sheet {
  id: string
  /** Título impresso no carimbo, ex.: "PIXELMAP". */
  title: string
  /** Painéis desenhados nesta folha. A folha comporta mais de um. */
  panels: PanelConfig[]
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
}

export interface Brand {
  /** Assinatura impressa acima do carimbo quando não há logotipo. */
  name: string
  /** Logotipo do escritório embutido como data URI (PNG, JPG ou SVG). */
  logoDataUri: string | null
}

export interface Project {
  brand: Brand
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
