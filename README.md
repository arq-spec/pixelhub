# PixelHub

Plataforma para montar **pixelmaps** — as folhas técnicas de painel de LED.
Você informa o tamanho do painel e o pitch; a folha sai pronta, no mesmo padrão
do modelo de referência (A3 paisagem, 420 × 297 mm), com a representação dos
módulos, o quadro de legendas e o carimbo do evento.

## O que a folha calcula

| Grandeza | Regra |
| --- | --- |
| Peso | **28 kg/m²** |
| Consumo | **0,5 kVA/m²** |
| Resolução — P2.9 | **336 px por metro** (módulo de 500 mm → 168 px) |
| Resolução — P1.9 | **512 px por metro** (módulo de 500 mm → 256 px) |
| Área | largura × altura reais do painel |

> **Sobre o número de pixels.** A especificação foi dada como "336 px por m²"
> para P2.9 e "512 px por m²" para P1.9. Esses valores são a densidade **por
> metro linear**, que é como o pitch se traduz em pixels: 1000 mm ÷ 2,976 mm ≈
> 336 e 1000 mm ÷ 1,953 mm ≈ 512. É essa a conta usada — ela é a única que
> devolve a resolução real do painel (um painel de 4,00 × 2,50 m em P2.9 dá
> 1344 × 840 px). Se fosse lida ao pé da letra como pixels por metro
> **quadrado**, esse mesmo painel teria 3.360 pixels no total, o que não
> corresponde a nenhum painel real.

A resolução é somada por módulo (pixels inteiros por gabinete), que é como o
processador enxerga o painel.

## Recursos

- **Painel** — largura e altura em metros, pitch P1.9 ou P2.9, tamanho de
  módulo configurável (predefinições 500×500, 500×1000, 480×485, 600×337,5).
- **Painéis são do projeto, não da folha** — o projeto tem um catálogo de
  painéis e cada folha marca quais deles desenha. Editar um painel vale para
  todas as folhas que o usam; desmarcá-lo apenas o retira daquela folha, e
  ele volta com um clique. Excluir, aí sim, remove do projeto inteiro.
- **Vários painéis por folha** — uma folha desenha quantos painéis estiverem
  marcados, cada um com seu título e quadro de dados. Até três ficam lado a
  lado; acima disso a prancha ganha uma segunda fila, e a tipografia acompanha
  o tamanho da célula.
- **Lista compacta** — cada painel do catálogo recolhe numa linha só, com nome,
  medida, pitch e número de módulos, para a coluna de edição não crescer junto
  com o projeto.
- **Formato livre** — a grade é editável placa a placa, de quatro maneiras:
  clique numa posição, arraste sobre um trecho, clique no número da régua para
  agir na coluna ou na linha inteira, ou digite um intervalo (`col 3 a 48`,
  `lin 2 a 5`) e aplique. Há zoom e um modo de tela cheia, porque num painel de
  25 m são 50 colunas e a coluna de edição não dá conta. Serve para pórtico,
  escada, vão central ou qualquer recorte. A linha `PAINEL:` continua mostrando a envoltória, mas
  **área, peso e consumo passam a contar só as placas presentes** — um pórtico
  de 8,00×4,50 m com vão central tem 18 m², não 36.
- **Repartições** — não se desenham à mão: em *Divisões*, clicar sobre a linha
  entre duas placas corta o painel ali, e o corte atravessa a grade de ponta a
  ponta. As repartições são o que sobra quando os cortes separam as placas, de
  modo que num pórtico um único clique já devolve três partes — o vão central
  separa as duas pernas por si só. Clicar num trecho já cortado remove só
  aquele trecho, para divisões parciais. Cada parte recebe nome e cor e entra
  no quadro de dados com envoltória e resolução:
  `PARTE 1: 8,00x1,50m · 2688x504p`.
- **Cores** — o painel e cada repartição aceitam cor, da paleta sugerida ou
  livre. As placas saem com a cor esmaecida e o contorno na cor cheia. Um
  campo na folha lista, no quadro de legendas, a cor seguida do painel e das
  suas repartições.
- **Placas de preenchimento** — quando a altura sobra exatamente meia placa
  (um painel de 2,50 m com gabinete 500×1000), a sobra é completada com placas
  quadradas de 500×500 **na fileira superior**, desenhadas como peças reais e
  descritas no quadro: `4x2 de 0,50x1,00m + 4 de 0,50x0,50m`.
- **Recorte** — quando a sobra não fecha em placa de catálogo, ela aparece
  tracejada e um atalho sugere o tamanho que fecha.
- **Escala** — automática: escolhe a escala normalizada em que o desenho ocupa
  cerca de dois terços da célula, a mesma proporção do pixelmap de referência,
  e imprime `ESCALA: 1:xx`.
- **Informações da folha** — cada linha do quadro de dados (dimensão, pixels,
  módulos, área, peso, consumo, escala) liga e desliga individualmente. Vêm
  ligadas por padrão dimensão, pixels, peso e consumo; as demais ficam à mão
  para quando a folha pedir. O quadro sai logo abaixo do desenho, separado só
  pela linha tracejada.
- **Montagens em 3D** — a composição do evento: o painel e o que o sustenta.
  Peças disponíveis: painel de LED (puxa a forma real do catálogo, vão de
  pórtico incluso), praticável de palco com altura de perna regulável, mão
  francesa e volumes genéricos. Cada peça tem posição em X, Y e Z, e pode ser
  repetida com passo — três praticáveis em fila são uma peça só.
  Cada peça duplica com um botão — a cópia entra ao lado da original, e depois
  de uma fila de repetições começa onde a fila termina, sem sobrepor.
  As peças se posicionam **arrastando na própria vista**: arrastar uma peça a
  move no piso, com *Shift* move na altura, e arrastar o fundo gira a câmera.
  As posições encaixam de 5 em 5 cm e os campos numéricos acompanham. A vista
  sai na folha em **isométrica, frontal, lateral ou superior**, ao lado dos
  painéis, com a envoltória da montagem no quadro.

  Numa vista frontal a tela não carrega profundidade, então lá o arrasto no
  piso só resolve a largura — a dica na interface avisa, para não parecer que
  a peça travou.

  Não há renderizador 3D: a cena é projetada ortogonalmente para as mesmas
  primitivas vetoriais da folha, com as faces ordenadas do fundo para a frente.
  É o que faz a isométrica sair no PDF e no DXF como geometria — na camada
  `PH-MONTAGEM` — e não como imagem.
- **Carimbo** — evento, título da folha, desenhista, data do evento, emissão e
  número da folha. **Data do evento em branco imprime `A DEFINIR`.**
- **Legendas** — bloco de observações livre, uma por linha, com quebra
  automática. A linha do pitch acompanha o pitch selecionado.
- **Marca** — o logotipo Aerial já vem embutido acima do carimbo, a 150% do
  tamanho original. Para trocar, envie outro arquivo em *Projeto → Enviar logotipo*
  (PNG, JPG ou SVG).
- **Várias folhas** — numeradas em sequência pela ordem da lista, com a opção
  de fixar a numeração de cada folha individualmente (`01`, `05A`, `A1`…).
  Duplicar, reordenar e excluir folhas; o projeto inteiro salva em `.json`.

## Exportação

| Formato | Folha atual | Todas as folhas |
| --- | --- | --- |
| PDF | ✔ | PDF único de várias páginas **ou** `.zip` com um PDF por folha |
| SVG | ✔ | `.zip` |
| DXF (AutoCAD) | ✔ | `.zip` |

- O **PDF** é vetorial, em A3 real (420 × 297 mm), com o texto selecionável em
  Helvetica — não é uma imagem rasterizada.
- O **SVG** sai com dimensões físicas em milímetros.
- O **DXF** é AutoCAD R12 ASCII, em milímetros, com as camadas separadas —
  `PH-PAINEL`, `PH-MODULOS`, `PH-COTAS`, `PH-TEXTO`, `PH-CARIMBO`, `PH-LOGO`,
  `PH-MONTAGEM` —
  para abrir no AutoCAD, BricsCAD, LibreCAD ou QCAD. Caracteres acentuados vão
  como escapes `\U+XXXX`, que é a forma portátil no R12.

Tela, PDF, SVG e DXF são gerados a partir do mesmo modelo geométrico
(`src/lib/layout.ts`), então o que aparece na pré-visualização é o que sai no
arquivo.

## Publicação no GitHub Pages

O repositório traz o workflow `.github/workflows/deploy.yml`: todo push na `main`
constrói o projeto e publica no GitHub Pages, em

**https://arq-spec.github.io/pixelhub/**

**Confira *Settings → Pages* → `Source: GitHub Actions`.** O `configure-pages`
habilita o Pages quando ele ainda não existe, mas **não converte** um Pages já
configurado como *Deploy from a branch*. Nesse modo o site serve a raiz do
repositório em vez do build — e a raiz tem o `index.html` de origem do Vite,
com uma `<div id="root">` vazia e um `<script src="/src/main.tsx">` que não
existe no site publicado. O resultado é uma **página em branco, sem nenhum erro
no console**: o workflow aparece verde e mesmo assim nada carrega.

A publicação passa `BASE_PATH=/<repo>/`, e o build gera caminhos absolutos com
esse prefixo. Isso faz a página carregar tanto em `/pixelhub/` quanto em
`/pixelhub` — com caminho relativo, a URL sem barra final resolveria os assets
contra a raiz do domínio, dando 404 e **página em branco sem nenhum erro de
JS**. Fora da publicação o `base` continua relativo, então `dist/` também abre
direto do disco.

Servida do Pages, a aplicação roda inteiramente no navegador e **todos os
formatos baixam normalmente**, DXF e `.zip` inclusive.

## Rodando

```bash
npm install
npm run dev      # servidor de desenvolvimento
npm run build    # checagem de tipos + build de produção em dist/
npm run preview  # serve o build
```

Tudo roda no navegador: nenhum dado sai da máquina, e o projeto em edição fica
salvo no `localStorage`.

## Estrutura

```
src/
  types.ts              constantes físicas (28 kg/m², 0,5 kVA/m², pitches) e modelos
  lib/
    calc.ts             módulos, área, peso, consumo e resolução
    layout.ts           monta a folha como primitivas geométricas em mm
    scene3d.ts          projeção ortogonal da cena 3D para o plano do desenho
    rigScene.ts         monta a cena da montagem a partir das peças
    sheetSpec.ts        geometria da prancha A3, medida sobre o PDF de referência
    measure.ts          métrica da Helvetica, para centralizar texto sem DOM
    store.ts            estado do projeto, reducer e persistência
    export/
      svg.ts            primitivas -> SVG
      pdf.ts            SVG -> PDF vetorial (jsPDF + svg2pdf)
      dxf.ts            primitivas -> DXF R12
  components/           interface de edição
```
