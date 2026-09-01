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
  /**
   * Linhas de corte entre placas, que dividem o painel em repartições.
   * `h<col>,<row>` corta acima da placa; `v<col>,<row>` corta à esquerda dela.
   */
  cuts: string[]
  /** Nome e cor de cada repartição, por âncora (a placa superior esquerda). */
  regionStyles: Record<string, RegionStyle>
  /** Cor de identificação do painel na folha. */
  color: string | null
  /** Lista este painel e suas cores no quadro de legendas. */
  showInLegend: boolean
}

/** Rótulo e cor que o usuário deu a uma repartição. */
export interface RegionStyle {
  name?: string
  color?: string
}

/**
 * Uma repartição de conteúdo: o trecho do painel que recebe um sinal ou uma
 * peça de arte própria.
 *
 * Não é editada diretamente — é o que sobra quando as linhas de corte separam
 * as placas. Um corte reto no meio de um pórtico já devolve três repartições,
 * porque o vão central separa as duas pernas por si só.
 */
export interface PanelRegion {
  /** Âncora: a placa superior esquerda, que dá identidade estável à parte. */
  id: string
  name: string
  cells: string[]
  /** `null` enquanto nenhuma cor for atribuída: o painel nasce incolor. */
  color: string | null
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
  /** Montagens que esta folha desenha, por id. */
  activeRigIds: string[]
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
  /** Lista de materiais no quadro de legendas. */
  showMaterials: boolean
}

/** Tipos de peça que compõem uma montagem. */
export type RigKind = 'painel' | 'praticavel' | 'maoFrancesa' | 'volume'

export const RIG_LABELS: Record<RigKind, string> = {
  painel: 'Painel de LED',
  praticavel: 'Praticável',
  maoFrancesa: 'Mão francesa',
  volume: 'Volume',
}

/**
 * Uma peça da montagem, posicionada em milímetros.
 * X é a largura, Y a altura a partir do chão e Z a profundidade.
 */
export interface RigItem {
  id: string
  kind: RigKind
  name: string
  x: number
  y: number
  z: number
  /** Largura, altura e profundidade. No painel, largura e altura vêm dele. */
  wMm: number
  hMm: number
  dMm: number
  /** Painel do catálogo representado por esta peça, quando `kind` é painel. */
  panelId: string | null
  /** Altura das pernas do praticável — o que a regulagem muda. */
  legMm: number
  /** Repetições ao longo de X, para enfileirar praticáveis ou mãos francesas. */
  count: number
  /** Distância entre repetições, de eixo a eixo. */
  stepMm: number
  color: string | null
}

/** Uma montagem: o painel e o que o sustenta, vistos em conjunto. */
export interface Rig {
  id: string
  name: string
  items: RigItem[]
  /** Projeção usada quando a montagem entra na folha. */
  view: 'isometrica' | 'frontal' | 'lateral' | 'superior'
  /** Desenha o piso de referência sob a montagem. */
  showGround: boolean
  /** Cota as medidas gerais e as alturas de montagem. */
  showDimensions: boolean
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
  /** Catálogo de montagens do projeto. */
  rigs: Rig[]
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
