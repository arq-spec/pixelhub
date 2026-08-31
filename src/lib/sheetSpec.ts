/**
 * Geometria da folha técnica, em milímetros, medida sobre o PDF de referência
 * (Pixelmap SANKHYA CONNECTION — A3 paisagem, 420 x 297 mm).
 *
 * Todo o desenho — tela, PDF, SVG e DXF — usa este mesmo sistema de
 * coordenadas: origem no canto superior esquerdo, X para a direita,
 * Y para baixo, unidade = 1 mm.
 */
export const PAGE = { w: 420, h: 297 } as const

/** Linha vertical que separa a prancha do painel de legendas. */
export const DIVIDER = { x: 344.5, y0: 7.7, y1: 289.2, width: 0.45 } as const

/** Coluna de conteúdo da lateral direita (legendas + carimbo). */
export const SIDEBAR = { x0: 350.9, x1: 412.3 } as const
export const SIDEBAR_W = SIDEBAR.x1 - SIDEBAR.x0
export const SIDEBAR_CX = (SIDEBAR.x0 + SIDEBAR.x1) / 2

/** Bloco LEGENDAS (topo da lateral). */
export const LEGEND = {
  titleBaseline: 12.0,
  titleSize: 4.2,
  titleTracking: 0.55,
  ruleY: 16.0,
  ruleWidth: 0.5,
  obsBaseline: 29.4,
  obsSize: 2.6,
  obsTracking: 0.05,
  boxTop: 31.7,
  boxPadX: 2.4,
  /** Distância do topo da caixa até a base da primeira linha. */
  firstBaseline: 5.2,
  lineHeight: 9.2,
  bottomPad: 2.0,
  itemSize: 3.2,
} as const

/** Bloco inferior: régua, logotipo e carimbo. */
export const STAMP = {
  ruleY: 220.8,
  ruleWidth: 0.6,
  // Logotipo a 200% do tamanho original: a caixa passou de 9,4 para 18,8 mm de
  // altura, mantendo o mesmo centro entre a régua e o carimbo.
  logoTop: 224.1,
  logoBottom: 242.9,
  boxTop: 245.7,
  boxBottom: 289.2,
  boxX0: 351.0,
  boxX1: 412.3,
  radius: 3.2,
  padX: 4.0,
  /** Eixo esquerdo e direito das duas colunas internas. */
  colL: 355.0,
  colR: 385.5,
  colLEnd: 379.7,
  colREnd: 408.3,
  eventBaseline: 253.1,
  eventSize: 3.6,
  rule1Y: 256.6,
  labelSize: 2.05,
  labelTracking: 0.08,
  valueSize: 3.0,
  titleLabelBaseline: 260.7,
  titleValueBaseline: 264.2,
  rule2Y: 267.0,
  row1LabelBaseline: 271.1,
  row1ValueBaseline: 274.7,
  rule3Y: 277.3,
  row2LabelBaseline: 280.4,
  row2ValueBaseline: 283.9,
  hairWidth: 0.25,
} as const

/**
 * Área útil da prancha. Cada painel da folha ocupa uma célula dentro dela; com
 * um único painel a célula é a área inteira e reproduz o modelo de referência.
 */
export const DRAWING = {
  x0: 14,
  x1: DIVIDER.x - 14,
  y0: 68,
  y1: 262,
  /** Folga entre células quando há mais de um painel. */
  gap: 10,
  titleSize: 5.3,
  titleTracking: 0.5,
  /** Folga entre a base do título e o topo do desenho. */
  titleGap: 14.8,
  specsLineHeight: 7.7,
  specsSize: 3.5,
  /** Folga entre o separador tracejado e a primeira linha de dados. */
  specsGap: 8.5,
  /** Folga entre a base do desenho e o separador tracejado. */
  drawingGap: 14,
  scaleNoteSize: 2.6,
} as const

/** Dimensões da célula quando a folha tem um único painel. */
export const FULL_CELL = {
  w: DRAWING.x1 - DRAWING.x0,
  h: DRAWING.y1 - DRAWING.y0,
} as const

/** Paleta extraída do PDF de referência. */
export const COLORS = {
  ink: '#000000',
  navy: '#16233a',
  navyDeep: '#0e1627',
  slate: '#647389',
  slateText: '#595f6a',
  label: '#96a3b4',
  hair: '#dfe5ec',
  boxStroke: '#cfd7e1',
  moduleFill: '#f5f8fb',
  moduleStroke: '#16233a',
  accent: '#f34136',
  dash: '#c3ccd8',
  dim: '#8b97a8',
} as const

/**
 * Helvetica é usada em todo o documento: o svg2pdf mapeia a família para a
 * fonte base do PDF, mantendo o texto vetorial e selecionável.
 */
export const FONT = "Helvetica, Arial, 'Liberation Sans', sans-serif"

/** Escalas normalizadas de desenho técnico. */
export const SCALE_LADDER = [
  1, 2, 2.5, 5, 10, 12.5, 15, 20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 200, 250, 300, 400, 500,
] as const
