# Nome e logo (v2, minimalista)

A primeira rodada (Cover Story e logos detalhadas) está em `design/v1/`, descartada.

## Nome

Verificação em 2026-10-13: busca por id e name no `community-plugins.json` (obsidian-releases, master) e buscas na web.

| Nome | Por que | Verificação |
| --- | --- | --- |
| **Lintel** (recomendado) | A verga, a viga sobre a porta ou janela. É literalmente o que fica no alto da abertura, como a capa fica no alto da página. Duas sílabas, sonoro, sem trocadilho. | Livre na lista da comunidade. Na web só há projetos pequenos (um controle de acesso no GitHub, um app de orçamento de reforma) e a peça de construção. |
| Atrium | Átrio, a entrada do espaço. Soa bem em PT e EN. | Livre na lista. Nome muito usado por empresas (por exemplo, redes de saúde), risco de marca maior. |
| Vela | Vela/vela de barco em PT, constelação em EN. Curto. | Livre na lista. Sem sentido ligado ao produto. Web não pesquisada a fundo. |
| Plume | Pluma, leve. | Livre na lista. Nome comum de apps e marcas. |
| Eave | Beiral, borda superior do telhado. | Livre na lista. Difícil de pronunciar em PT. |
| Brim | Borda. Curto. | Livre na lista. Existe um app conhecido (Brim, análise de logs) e uma empresa financeira. |
| Cornice | Cornija, moldura do topo. | Livre na lista. Longo e pouco usual. |

Descartados por colisão na lista: Halo, Veil, Verso, Folio, Prologue, Lumen, Banners e similares. Crest foi evitado por ser marca conhecida. Marca registrada (USPTO/INPI) não foi consultada.

### Manifest sugerido para Lintel
- id: `lintel`
- name: `Lintel`
- description (EN): `Notion-style page covers and icons for your notes.`
- descrição (PT-BR): `Capas e ícones de página no estilo Notion para suas notas.`

## Logo

Todas em grade de 64, cores: violeta `#6E56CF` e um amarelo de destaque `#F5B83D`. Versões `-mono` usam só `currentColor`. Sem degradês, sem fontes, SVG válido.

- **B. Lintel** (`logo-b-lintel*.svg`): uma viga e dois pilares. Ligada ao nome, mas lembra um "pi" ou uma mesa.
- **C. Moldura** (`logo-c-moldura*.svg`): quadrado de contorno com faixa de capa cheia no topo. Clara, porém genérica e mais pesada.
- **D. Bloco** (`logo-d-bloco*.svg`): faixa de capa separada de um bloco com um furo circular que faz o papel do ícone. Uma forma só, sem anel.
- A. Faixa e ponto foi descartada: a 16 px vira um traço e um pingo sem leitura (em `v1/`).

**Favorita: D.** Em 16 px ainda se lê como página com capa e ícone, e o furo circular deixa a marca com personalidade sem nenhum detalhe fino. Funciona nos dois fundos e, em mono, mantém a mesma silhueta.

`preview.html` compara B, C e D, em cor e mono, a 16, 32, 64 e 256 px, em fundo claro e escuro.

## Em aberto
- Escolha do nome (Lintel vs. Atrium) e da logo (D vs. B).
- Consulta de marca registrada.
- Se adotar o nome, atualizar `manifest.json`, `package.json` e README (não alterados).
