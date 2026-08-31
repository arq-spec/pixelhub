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
- **Módulo parcial** — quando o painel não fecha em gabinetes inteiros, o
  recorte aparece tracejado no desenho e um atalho sugere o tamanho que fecha.
- **Escala** — automática (escolhe a escala normalizada que melhor preenche a
  prancha) ou fixada à mão; sai impressa como `ESC. 1:xx`.
- **Carimbo** — evento, título da folha, desenhista, data do evento, emissão e
  número da folha. **Data do evento em branco imprime `A DEFINIR`.**
- **Legendas** — bloco de observações livre, uma por linha, com quebra
  automática. A linha do pitch acompanha o pitch selecionado.
- **Marca** — envie o logotipo do seu escritório (PNG, JPG ou SVG); ele entra
  acima do carimbo.
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
  `PH-PAINEL`, `PH-MODULOS`, `PH-COTAS`, `PH-TEXTO`, `PH-CARIMBO`, `PH-LOGO` —
  para abrir no AutoCAD, BricsCAD, LibreCAD ou QCAD. Caracteres acentuados vão
  como escapes `\U+XXXX`, que é a forma portátil no R12.

Tela, PDF, SVG e DXF são gerados a partir do mesmo modelo geométrico
(`src/lib/layout.ts`), então o que aparece na pré-visualização é o que sai no
arquivo.

## Publicação no GitHub Pages

O repositório traz o workflow `.github/workflows/deploy.yml`: todo push na `main`
constrói o projeto e publica no GitHub Pages, em

**https://arq-spec.github.io/pixelhub/**

A primeira execução tenta habilitar o Pages sozinha. Se o workflow parar com um
erro de permissão, abra *Settings → Pages* e defina **Source: GitHub Actions** —
depois é só reexecutar o workflow em *Actions*.

O build usa caminhos relativos (`base: './'`), então a aplicação funciona no
subdiretório do Pages sem ajuste. Servida de lá, ela roda inteiramente no
navegador e **todos os formatos baixam normalmente**, DXF e `.zip` inclusive.

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
    sheetSpec.ts        geometria da prancha A3, medida sobre o PDF de referência
    measure.ts          métrica da Helvetica, para centralizar texto sem DOM
    store.ts            estado do projeto, reducer e persistência
    export/
      svg.ts            primitivas -> SVG
      pdf.ts            SVG -> PDF vetorial (jsPDF + svg2pdf)
      dxf.ts            primitivas -> DXF R12
  components/           interface de edição
```
