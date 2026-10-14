# Nome e logo (v3, a partir das referências)

Rodadas anteriores: `v1/` (Cover Story, logos detalhadas) e `v2/` (Lintel, formas de contorno). `v2/nome-e-logo.md` guarda as notas de nome da rodada 2.

## Nome (em aberto)

Lintel segue como recomendação provisória (livre em `community-plugins.json`, conferido em 2026-10-13). Candidatos e verificações completos em `v2/nome-e-logo.md`: Lintel, Atrium, Vela, Plume, Eave, Brim, Cornice. Manifest sugerido se Lintel for mantido: id `lintel`, name `Lintel`, description "Notion-style page covers and icons for your notes." (PT-BR: "Capas e ícones de página no estilo Notion para suas notas.").

## Direção das logos

Das três referências, mantive: formas cheias e sólidas, camadas deslocadas ou espaço negativo, silhueta única em quadrado de cantos bem arredondados (raio 18 em grade de 64), cores chapadas sem degradê e sem sombra. Cores: violeta `#9C82F8`/`#A58BFA`, violeta escuro `#3A2B8C`, amarelo claro `#FBE7A1`. Versões `-mono` usam só `currentColor`.

## Conceitos

- **E. Camadas** (`logo-e-camadas*.svg`), referência 1: três faixas empilhadas e levemente inclinadas (capa amarela, página violeta, bloco escuro) e um ponto branco que é o ícone. Em mono, as camadas viram faixas separadas por um vão e o ponto vira furo. Legível a 16 px nos dois fundos.
- **F. Recorte** (`logo-f-recorte*.svg`), referência 2: bloco sólido com um canto inferior direito recortado por um quadrado arredondado e girado (o ícone da página). Em mono é negativo puro. Forte e simples, mas fala menos de "capa".
- **H. Página sobre a capa** (`logo-h-pagina*.svg`): capa violeta cobrindo tudo, página escura subindo de baixo e um círculo amarelo (ícone) sobre a borda da página, como no Notion. Colorida é a mais clara de todas. A mono (silhueta tipo buraco de fechadura) fica abstrata e frágil a 16 px.
- Descartado: **G. Folha** (referência 3, página com canto virando). Em mono ficava fino demais e a 16 px o canto virado desaparecia. Está em `v3-descartados/`.

**Favorito: E.** É o único que traduz capa, página e ícone em camadas sólidas, como a referência 1, e é nítido a 16 px em cor e em mono, em fundo claro e escuro. H é a melhor opção colorida se o mono puder ser mais abstrato.

`preview.html` compara E, F e H, em cor e mono, a 16, 32, 64 e 256 px, em fundo claro e escuro.

## Em aberto
- Nome final (Lintel vs. outros) e consulta de marca registrada.
- Escolha entre E e H (ou ajustar a mono de H).
- Se adotar, atualizar `manifest.json`, `package.json` e README (não alterados).
