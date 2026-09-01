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

/**
 * Projeta um ponto da cena no plano do desenho.
 *
 * Com a câmera acima da linha do horizonte, o que está mais longe sobe na
 * tela — é daí que vem a leitura de profundidade da isométrica. O eixo
 * vertical da projeção tem de concordar com `depthOf`: se discordarem, a face
 * de cima de uma peça é ordenada como próxima mas desenhada como se fosse
 * vista por baixo, e cai por cima do que deveria estar na frente dela.
 */
export function project(p: Vec3, cam: Camera): { x: number; y: number } {
  const a = rad(cam.az)
  const e = rad(cam.el)
  const px = p.x * Math.cos(a) - p.z * Math.sin(a)
  const pz = p.x * Math.sin(a) + p.z * Math.cos(a)
  return { x: px, y: -(p.y * Math.cos(e) + pz * Math.sin(e)) }
}

/** Profundidade de um ponto: quanto maior, mais longe do observador. */
export function depthOf(p: Vec3, cam: Camera): number {
  const a = rad(cam.az)
  const e = rad(cam.el)
  return p.x * Math.sin(a) * Math.cos(e) - p.y * Math.sin(e) + p.z * Math.cos(a) * Math.cos(e)
}

/**
 * Quanto um passo de 1 mm em Z afasta o ponto do observador.
 *
 * Positivo quer dizer que o fundo da cena tem Z maior. É o que decide qual
 * das duas faces de uma peça plana está virada para a câmera.
 */
export const depthPerZ = (cam: Camera) => depthOf({ x: 0, y: 0, z: 1 }, cam)

/** Traçado sem preenchimento desenhado junto de uma face. */
export interface Wire {
  pts: Vec3[]
  stroke: string
  width: number
}

export interface Face {
  pts: Vec3[]
  fill: string
  stroke: string
  width: number
  /**
   * Traçados presos à face, desenhados logo depois dela.
   *
   * Uma linha sobre o próprio plano da face não pode ser ordenada junto com o
   * resto: coplanares empatam em profundidade e metade delas acaba coberta
   * pelo preenchimento que deveriam riscar. Presas à face, saem sempre por
   * cima dela e sempre por baixo do que estiver à frente.
   */
  lines?: Wire[]
  /**
   * Fundo de cena: desenhado antes de todo o resto, sem disputar ordem.
   *
   * O piso é uma face enorme e a ordenação olha só o centro dela: metade das
   * peças cai mais longe que esse centro e seria apagada pelo piso. Como ele é
   * pano de fundo, e não volume, sai da disputa.
   */
  back?: boolean
  /** Peça a que a face pertence, para seleção e arrasto na vista. */
  itemId?: string
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

export interface ProjectedWire {
  pts: Array<{ x: number; y: number }>
  stroke: string
  width: number
}

export interface ProjectedFace {
  pts: Array<{ x: number; y: number }>
  fill: string
  stroke: string
  width: number
  depth: number
  lines?: ProjectedWire[]
  back?: boolean
  itemId?: string
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
        lines: f.lines?.map((w) => ({
          pts: w.pts.map((p) => project(p, cam)),
          stroke: w.stroke,
          width: w.width,
        })),
        back: f.back,
        itemId: f.itemId,
        depth: depth / f.pts.length,
      }
    })
    .sort((a, b) => {
      if (!!a.back !== !!b.back) return a.back ? -1 : 1
      return b.depth - a.depth
    })
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

/** Como o arrasto na tela se traduz em deslocamento na cena. */
export type DragAxis = 'ground' | 'height'

/**
 * Converte um deslocamento no plano do desenho de volta para a cena.
 *
 * No piso, o eixo horizontal da tela dá a direção da câmera e o vertical dá a
 * profundidade — mas só quando a vista está inclinada: numa vista frontal a
 * tela não carrega informação de profundidade, e o deslocamento fica só em X.
 */
export function dragToScene(
  dx: number, dy: number, cam: Camera, axis: DragAxis,
): Vec3 {
  const a = rad(cam.az)
  const e = rad(cam.el)

  if (axis === 'height') {
    const ce = Math.cos(e)
    return { x: 0, y: Math.abs(ce) < 1e-3 ? 0 : -dy / ce, z: 0 }
  }

  const se = Math.sin(e)
  const dpz = Math.abs(se) < 0.15 ? 0 : -dy / se
  return {
    x: dx * Math.cos(a) + dpz * Math.sin(a),
    y: 0,
    z: -dx * Math.sin(a) + dpz * Math.cos(a),
  }
}

/** A vista inclina o bastante para o arrasto resolver a profundidade? */
export const resolvesDepth = (cam: Camera) => Math.abs(Math.sin(rad(cam.el))) >= 0.15
