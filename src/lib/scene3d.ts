/**
 * Cena tridimensional da montagem, em milímetros.
 *
 * Não há renderizador 3D aqui: a cena é projetada ortogonalmente para as
 * mesmas primitivas vetoriais que a folha usa. É o que permite a vista
 * isométrica sair no PDF e no DXF como geometria, e não como imagem.
 *
 * Eixos: X para a direita (largura), Y para cima (altura), Z para o fundo
 * (profundidade). A origem fica no chão, no canto frontal esquerdo.
 */

export interface Vec3 { x: number; y: number; z: number }

/** Câmera ortogonal: azimute gira em torno da vertical, elevação inclina. */
export interface Camera { az: number; el: number }

export const VIEWS = {
  frontal: { az: 0, el: 0 },
  lateral: { az: 90, el: 0 },
  superior: { az: 0, el: 89.9 },
  /** Isometria verdadeira: 45° de azimute e 35,264° de elevação. */
  isometrica: { az: 45, el: 35.264 },
} as const

export type ViewId = keyof typeof VIEWS

export const VIEW_LABELS: Record<ViewId, string> = {
  isometrica: 'Isométrica',
  frontal: 'Frontal',
  lateral: 'Lateral',
  superior: 'Superior',
}

const rad = (deg: number) => (deg * Math.PI) / 180

/** Projeta um ponto da cena no plano do desenho. */
export function project(p: Vec3, cam: Camera): { x: number; y: number } {
  const a = rad(cam.az)
  const e = rad(cam.el)
  const px = p.x * Math.cos(a) - p.z * Math.sin(a)
  const pz = p.x * Math.sin(a) + p.z * Math.cos(a)
  return { x: px, y: -(p.y * Math.cos(e) - pz * Math.sin(e)) }
}

/** Profundidade de um ponto: quanto maior, mais longe do observador. */
export function depthOf(p: Vec3, cam: Camera): number {
  const a = rad(cam.az)
  const e = rad(cam.el)
  return p.x * Math.sin(a) * Math.cos(e) - p.y * Math.sin(e) + p.z * Math.cos(a) * Math.cos(e)
}

export interface Face {
  pts: Vec3[]
  fill: string
  stroke: string
  width: number
  /** Faces sem preenchimento não escondem o que está atrás. */
  wire?: boolean
}

/** Caixa alinhada aos eixos, a partir do canto de menor coordenada. */
export function box(
  x: number, y: number, z: number,
  w: number, h: number, d: number,
  style: { fill: string; stroke: string; width?: number },
): Face[] {
  const x1 = x + w, y1 = y + h, z1 = z + d
  const p = (px: number, py: number, pz: number): Vec3 => ({ x: px, y: py, z: pz })
  const s = { fill: style.fill, stroke: style.stroke, width: style.width ?? 0.3 }
  return [
    { pts: [p(x, y, z), p(x1, y, z), p(x1, y1, z), p(x, y1, z)], ...s },       // frente
    { pts: [p(x, y, z1), p(x1, y, z1), p(x1, y1, z1), p(x, y1, z1)], ...s },   // fundo
    { pts: [p(x, y, z), p(x, y, z1), p(x, y1, z1), p(x, y1, z)], ...s },       // esquerda
    { pts: [p(x1, y, z), p(x1, y, z1), p(x1, y1, z1), p(x1, y1, z)], ...s },   // direita
    { pts: [p(x, y1, z), p(x1, y1, z), p(x1, y1, z1), p(x, y1, z1)], ...s },   // topo
    { pts: [p(x, y, z), p(x1, y, z), p(x1, y, z1), p(x, y, z1)], ...s },       // base
  ]
}

/**
 * Cunha triangular — a mão francesa. O triângulo fica no plano YZ, com o
 * cateto vertical junto ao painel, e é extrudado ao longo de X pela espessura.
 */
export function wedge(
  x: number, y: number, z: number,
  thickness: number, height: number, depth: number,
  style: { fill: string; stroke: string; width?: number },
): Face[] {
  const x1 = x + thickness
  const s = { fill: style.fill, stroke: style.stroke, width: style.width ?? 0.3 }
  const p = (px: number, py: number, pz: number): Vec3 => ({ x: px, y: py, z: pz })
  // Vértices do triângulo: base no chão, cateto vertical em z, hipotenusa.
  const tri = (px: number): Vec3[] => [
    p(px, y, z), p(px, y + height, z), p(px, y, z + depth),
  ]
  const [a0, b0, c0] = tri(x)
  const [a1, b1, c1] = tri(x1)
  return [
    { pts: [a0, b0, c0], ...s },
    { pts: [a1, b1, c1], ...s },
    { pts: [a0, b0, b1, a1], ...s },   // face vertical, contra o painel
    { pts: [a0, c0, c1, a1], ...s },   // base
    { pts: [b0, c0, c1, b1], ...s },   // hipotenusa
  ]
}

export interface ProjectedFace {
  pts: Array<{ x: number; y: number }>
  fill: string
  stroke: string
  width: number
  depth: number
  wire?: boolean
}

/**
 * Projeta e ordena as faces do fundo para a frente. Sem cálculo de linhas
 * ocultas: as faces preenchidas cobrem o que está atrás, que é o suficiente
 * para volumes convexos como caixas, praticáveis e mãos francesas.
 */
export function projectFaces(faces: Face[], cam: Camera): ProjectedFace[] {
  return faces
    .map((f) => {
      let depth = 0
      for (const p of f.pts) depth += depthOf(p, cam)
      return {
        pts: f.pts.map((p) => project(p, cam)),
        fill: f.fill,
        stroke: f.stroke,
        width: f.width,
        wire: f.wire,
        depth: depth / f.pts.length,
      }
    })
    .sort((a, b) => b.depth - a.depth)
}

export interface Bounds { x0: number; y0: number; x1: number; y1: number }

export function faceBounds(faces: ProjectedFace[]): Bounds {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const f of faces) {
    for (const p of f.pts) {
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x)
      y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y)
    }
  }
  if (!Number.isFinite(x0)) return { x0: 0, y0: 0, x1: 1, y1: 1 }
  return { x0, y0, x1, y1 }
}
