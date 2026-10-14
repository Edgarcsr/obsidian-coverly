# Nome e logo do plugin

## Candidatos

Verificação feita em 2026-10-13 contra `community-plugins.json` (obsidian-releases, baixado do branch master) buscando por id e name, mais buscas na web.

| Nome | Justificativa | Verificação |
| --- | --- | --- |
| **Cover Story** (recomendado) | Duas palavras comuns. "Cover" é a capa, "story" é a nota. É um trocadilho conhecido (matéria de capa). Fácil em PT e EN. | Nenhum plugin com `cover-story`. A busca web não achou plugin do Obsidian com esse nome. Existem plugins parecidos (Cover Image, Get Covers, Cover Image Picker), sem conflito de nome. |
| Masthead | Topo de uma página/jornal. Elegante, curto. | Não está na lista. Existe um produto web chamado Masthead e o termo é comum em UI. "th" é difícil para falantes de português. |
| Coverleaf | Capa + folha. Soa como marca própria. | Não está na lista e a web não mostrou produto. Forma inventada, menos clara. |
| Titlecard | Cartão de título da página. | Não está na lista. Remete a vídeo/cinema. |
| Frontispiece | Ilustração de abertura de livro. | Não está na lista. Longo e difícil de pronunciar. |
| Marquee | Letreiro, destaque no topo. | Não está na lista. Termo de CSS/HTML, confuso. |
| Capa | "Cover" em português. | Não está na lista. Não diz nada para o público internacional. |

Descartados por colisão na lista da comunidade: Banners (`obsidian-banners`), Banners Reloaded, Pixel Banner, Cover Image, Folio, Prologue, Leaflet, Header Enhancer. "Notion" foi evitado por ser marca de terceiros. A checagem de marca registrada (USPTO/INPI) não foi feita e fica como pendência.

## Recomendação: Cover Story

- id: `cover-story`
- name: `Cover Story`
- description (EN): `Notion-style page covers and icons for your notes, stored in frontmatter.`
- descrição (PT-BR): `Capas e ícones de página no estilo Notion para suas notas, salvos no frontmatter.`

Observação: o id do plugin precisa mudar também no nome da pasta de teste no vault (`.obsidian/plugins/cover-story/`). Nada foi alterado no projeto.

## Logo

Arquivos:
- `logo-cover-story.svg`: principal, colorida.
- `logo-cover-story-mono.svg`: principal, monocromática com `currentColor`.
- `logo-alt-banner.svg` e `logo-alt-banner-mono.svg`: alternativa, só a faixa da capa com o ícone sobreposto.
- `preview.html`: 16, 32, 64 e 256 px, fundo claro e escuro, com o nome.

Decisões de design:
- Ideia central: uma página com a faixa da capa no topo e um ícone circular sobreposto na borda da capa, com um recorte (anel) ao redor, como no Notion. Uma linha de texto embaixo indica "nota".
- Grade de 64 unidades, cantos arredondados (raio 16), traço de 6 unidades (equivalente ao stroke 2,5 do Lucide em grade 24).
- Colorida: quadrado índigo sólido, então funciona em fundo claro e escuro. Capa em degradê lilás para rosa, ícone amarelo.
- Mono: contorno + capa preenchida, tudo em `currentColor`. O recorte usa `mask`, sem fontes nem recursos externos.
- A 16 px a leitura se mantém por três blocos: capa, círculo e linha. Sem detalhes finos.
- A alternativa banner é mais leve e deixa de ter a página inteira. Menos legível a 16 px.

## Dúvidas em aberto

- Registro de marca para "Cover Story" não consultado.
- Se o nome for adotado, atualizar `manifest.json` (id, name, description), `package.json` e o README.
